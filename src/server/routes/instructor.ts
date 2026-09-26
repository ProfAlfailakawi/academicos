// Instructor loop: anonymised "where is the cohort stuck" view for one course
// assignment, plus the Clarification Room (student questions, instructor
// clarifications broadcast to every affected project).
import type { Express } from "express";
import { firestoreStore } from "../db";
import { recalculateProject } from "../project-engine";
import { createNotification } from "../notifications";
import { realtimeHub, RealtimeHub } from "../realtime";
import { buildCohortInsight } from "../cohort-insight";
import {
  answerClarification,
  applyClarificationPatch,
  openClarificationFromAmbiguity,
  type ClarificationThread,
} from "../advanced/clarification-room";
import type { AuthenticatedRequest, RouteDeps } from "./types";

/** Never expose who raised a question. */
export function publicThread(thread: ClarificationThread) {
  const { raisedBy: _raisedBy, answeredBy: _answeredBy, ...rest } = thread;
  return rest;
}

/**
 * Answer a thread, persist it, patch every affected student's Project DNA and
 * notify them. Shared by the course route and the advanced registry route.
 */
export async function publishClarification(
  tenantId: string,
  thread: ClarificationThread,
  input: { answer: string; answeredBy: string; addRequirements?: string[]; clarifyDeadline?: string },
) {
  const { thread: next, broadcast } = answerClarification(thread, input);
  await firestoreStore.saveClarificationThread(next);
  const projects = await firestoreStore.listAssignmentProjects(tenantId, thread.assignmentId);
  let patched = 0;
  for (const project of projects) {
    if (!next.dnaPatch) break;
    const { dna, changed } = applyClarificationPatch(project, next.dnaPatch);
    const withNote = {
      ...dna,
      riskFlags: [...new Set([...(dna.riskFlags || []), next.dnaPatch.note.slice(0, 400)])],
    };
    try {
      await firestoreStore.updateProject(recalculateProject(withNote), input.answeredBy, `Clarification v${next.version}`);
      if (changed) patched += 1;
    } catch {
      // A concurrent edit must not block the broadcast; the student still gets the notification.
    }
    await createNotification({
      tenantId,
      userId: project.userId,
      type: "assignment",
      priority: "important",
      title: thread.question.slice(0, 140),
      body: next.answer || "",
      targetPath: `/app/project/${encodeURIComponent(project.id)}`,
      groupKey: `clarification:${thread.id}`,
      requiresAction: false,
      channels: ["in_app"],
    }).catch(() => undefined);
  }
  realtimeHub.publish(RealtimeHub.assignmentChannel(tenantId, thread.assignmentId), "clarification_answered", broadcast);
  return { thread: next, notified: projects.length, patched };
}

export function registerInstructorRoutes(app: Express, deps: RouteDeps & { facultyRoles: string[] }) {
  const { authenticate, cleanField, canManageCourse } = deps;
  const faculty = new Set(deps.facultyRoles);

  async function context(req: AuthenticatedRequest) {
    const a = req.actor!;
    const courseId = cleanField(req.params.courseId, 180);
    const assignmentId = cleanField(req.params.assignmentId, 180);
    const [course, assignment] = await Promise.all([
      firestoreStore.getCourse(courseId, a.tenantId),
      firestoreStore.getCourseAssignment(assignmentId, courseId, a.tenantId),
    ]);
    if (!course || !assignment) return null;
    const manager = faculty.has(a.role) && canManageCourse(a, course);
    const enrolled = manager ? true : Boolean(await firestoreStore.getCourseEnrollment(courseId, a.userId, a.tenantId));
    return { a, course, assignment, manager, enrolled };
  }

  app.get(
    "/api/courses/:courseId/assignments/:assignmentId/cohort-insight",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const ctx = await context(req);
        if (!ctx || !ctx.manager)
          return res.status(404).json({ error: "Assignment not found", code: "ASSIGNMENT_NOT_FOUND" });
        const projects = await firestoreStore.listAssignmentProjects(ctx.a.tenantId, ctx.assignment.id);
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ success: true, insight: buildCohortInsight(projects) });
      } catch (e) {
        next(e);
      }
    },
  );

  app.get(
    "/api/courses/:courseId/assignments/:assignmentId/clarifications",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const ctx = await context(req);
        if (!ctx || !ctx.enrolled)
          return res.status(404).json({ error: "Assignment not found", code: "ASSIGNMENT_NOT_FOUND" });
        const threads = await firestoreStore.listClarificationThreads(ctx.a.tenantId, ctx.assignment.id);
        res.json({
          success: true,
          threads: threads
            .filter((thread) => ctx.manager || thread.status === "answered")
            .map(publicThread),
        });
      } catch (e) {
        next(e);
      }
    },
  );

  // Students ask (opens a thread); instructors send a clarification (answered immediately).
  app.post(
    "/api/courses/:courseId/assignments/:assignmentId/clarifications",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const ctx = await context(req);
        if (!ctx || !ctx.enrolled)
          return res.status(404).json({ error: "Assignment not found", code: "ASSIGNMENT_NOT_FOUND" });
        const question = cleanField(req.body?.question, 1000);
        const answer = cleanField(req.body?.answer, 4000);
        if (!question)
          return res.status(400).json({ error: "A question or topic is required", code: "CLARIFICATION_QUESTION_REQUIRED" });
        const opened = openClarificationFromAmbiguity({
          assignmentId: ctx.assignment.id,
          tenantId: ctx.a.tenantId,
          courseId: ctx.course.id,
          ambiguity: question,
          raisedBy: ctx.manager ? undefined : ctx.a.userId,
        });
        const existing = await firestoreStore.getClarificationThread(ctx.a.tenantId, opened.id);
        const thread: ClarificationThread = existing
          ? { ...existing, upvotes: existing.upvotes + (ctx.manager ? 0 : 1), updatedAt: opened.updatedAt }
          : { ...opened, origin: ctx.manager ? "ambiguity_detected" : "student_asked" };
        if (ctx.manager && answer) {
          const addRequirements = Array.isArray(req.body?.addRequirements)
            ? req.body.addRequirements.map((x: unknown) => cleanField(x, 300)).filter(Boolean).slice(0, 10)
            : [];
          const result = await publishClarification(ctx.a.tenantId, thread, {
            answer,
            answeredBy: ctx.a.userId,
            addRequirements,
            clarifyDeadline: cleanField(req.body?.clarifyDeadline, 40) || undefined,
          });
          await firestoreStore.writeAudit(ctx.a.tenantId, ctx.a.userId, "clarification.publish", ctx.assignment.id, undefined, {
            threadId: thread.id,
            notified: result.notified,
          });
          return res.status(201).json({ success: true, thread: publicThread(result.thread), notified: result.notified });
        }
        await firestoreStore.saveClarificationThread(thread);
        res.status(201).json({ success: true, thread: publicThread(thread), notified: 0 });
      } catch (e) {
        next(e);
      }
    },
  );

  app.post(
    "/api/courses/:courseId/assignments/:assignmentId/clarifications/:threadId/answer",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const ctx = await context(req);
        if (!ctx || !ctx.manager)
          return res.status(404).json({ error: "Assignment not found", code: "ASSIGNMENT_NOT_FOUND" });
        const thread = await firestoreStore.getClarificationThread(ctx.a.tenantId, cleanField(req.params.threadId, 180));
        if (!thread || thread.assignmentId !== ctx.assignment.id)
          return res.status(404).json({ error: "Thread not found", code: "NOT_FOUND" });
        const answer = cleanField(req.body?.answer, 4000);
        if (!answer) return res.status(400).json({ error: "Answer required", code: "CLARIFICATION_ANSWER_REQUIRED" });
        const result = await publishClarification(ctx.a.tenantId, thread, { answer, answeredBy: ctx.a.userId });
        await firestoreStore.writeAudit(ctx.a.tenantId, ctx.a.userId, "clarification.answer", ctx.assignment.id, undefined, {
          threadId: thread.id,
          notified: result.notified,
        });
        res.json({ success: true, thread: publicThread(result.thread), notified: result.notified });
      } catch (e) {
        next(e);
      }
    },
  );
}
