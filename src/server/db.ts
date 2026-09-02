import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type {
  ControlPlaneData,
  CourseAssignmentRecord,
  CourseEnrollmentRecord,
  CourseJoinCodeRecord,
  CourseRecord,
  CourseSubmissionRecord,
  DashboardSummary,
  FeatureFlagRecord,
  LearningEvidenceRecord,
  PassportData,
  ProjectActivityRecord,
  ProjectComment,
  ProjectDNA,
  ProjectPresenceRecord,
  ProjectEvidence,
  ProjectMemberRecord,
  ProjectVersionRecord,
  SkillEvidence,
  SubmissionAudit,
  SupportTicket,
  TenantProjectSummary,
  UserProfile,
  VivaSession,
  WorkspaceArtifact,
  WorkspaceArtifactVersion,
} from "../types";
import type { AIUsage } from "./ai";

export const COLLECTIONS = {
  users: "users",
  profiles: "profiles",
  tenants: "tenants",
  tenantMembers: "tenantMembers",
  institutions: "institutions",
  courses: "courses",
  courseSections: "courseSections",
  enrollments: "enrollments",
  courseJoinCodes: "courseJoinCodes",
  assignments: "assignments",
  assignmentPolicies: "assignmentPolicies",
  projects: "projects",
  projectMembers: "projectMembers",
  projectTasks: "projectTasks",
  deliverables: "deliverables",
  artifacts: "artifacts",
  artifactVersions: "artifactVersions",
  workspaceArtifactVersions: "workspaceArtifactVersions",
  files: "files",
  sources: "sources",
  claims: "claims",
  citations: "citations",
  datasets: "datasets",
  analysisRuns: "analysisRuns",
  graphNodes: "graphNodes",
  graphEdges: "graphEdges",
  aiRuns: "aiRuns",
  toolRuns: "toolRuns",
  comments: "comments",
  vivaSessions: "vivaSessions",
  vivaResponses: "vivaResponses",
  learningEvidence: "learningEvidence",
  projectEvidence: "projectEvidence",
  skills: "skills",
  skillEvidence: "skillEvidence",
  academicPassports: "academicPassports",
  credentials: "credentials",
  subscriptions: "subscriptions",
  plans: "plans",
  transactions: "transactions",
  usageMeters: "usageMeters",
  notifications: "notifications",
  integrations: "integrations",
  supportTickets: "supportTickets",
  securityEvents: "securityEvents",
  auditLogs: "auditLogs",
  submissionAudits: "submissionAudits",
  courseSubmissions: "courseSubmissions",
  courseSubmissionAttempts: "courseSubmissionAttempts",
  projectPresence: "projectPresence",
  featureFlags: "featureFlags",
  systemConfig: "systemConfig",
  learnCache: "learnCache",
  copilotChunks: "copilotChunks",
} as const;

function db() {
  return getFirestore();
}

function firestoreSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function syncArtifactGraph(
  artifact: WorkspaceArtifact,
  previous?: WorkspaceArtifact | null,
) {
  const database = db(),
    batch = database.batch(),
    nodeId = `artifact_${artifact.id}`;
  batch.set(
    database.collection(COLLECTIONS.graphNodes).doc(nodeId),
    {
      id: nodeId,
      tenantId: artifact.tenantId,
      projectId: artifact.projectId,
      type: "Artifact",
      label: artifact.title,
      module: artifact.module,
      status: artifact.status,
      updatedAt: artifact.updatedAt,
    },
    { merge: true },
  );
  batch.set(
    database.collection(COLLECTIONS.graphEdges).doc(`${nodeId}__project`),
    {
      id: `${nodeId}__project`,
      tenantId: artifact.tenantId,
      projectId: artifact.projectId,
      from: nodeId,
      to: `project_${artifact.projectId}`,
      relation: "belongsTo",
      updatedAt: artifact.updatedAt,
    },
    { merge: true },
  );
  const oldTargets = [
    ...(previous?.deliverableId
      ? [`deliverable_${previous.deliverableId}`]
      : []),
    ...(previous?.rubricIds || []).map((id) => `rubric_${id}`),
  ];
  const newTargets = [
    ...(artifact.deliverableId
      ? [`deliverable_${artifact.deliverableId}`]
      : []),
    ...(artifact.rubricIds || []).map((id) => `rubric_${id}`),
  ];
  for (const target of oldTargets)
    if (!newTargets.includes(target))
      batch.delete(
        database.collection(COLLECTIONS.graphEdges).doc(`${nodeId}__${target}`),
      );
  for (const target of newTargets)
    batch.set(
      database.collection(COLLECTIONS.graphEdges).doc(`${nodeId}__${target}`),
      {
        id: `${nodeId}__${target}`,
        tenantId: artifact.tenantId,
        projectId: artifact.projectId,
        from: nodeId,
        to: target,
        relation: target.startsWith("rubric_") ? "satisfies" : "supports",
        updatedAt: artifact.updatedAt,
      },
      { merge: true },
    );
  await batch.commit();
}
async function syncEvidenceGraph(evidence: ProjectEvidence) {
  const database = db(),
    batch = database.batch(),
    nodeId = `evidence_${evidence.id}`,
    base = {
      tenantId: evidence.tenantId,
      projectId: evidence.projectId,
      updatedAt: evidence.updatedAt,
    };
  batch.set(
    database.collection(COLLECTIONS.graphNodes).doc(nodeId),
    {
      id: nodeId,
      ...base,
      type: "Evidence",
      label: evidence.title,
      evidenceType: evidence.type,
      verification: evidence.verification,
    },
    { merge: true },
  );
  const links: Array<{ target: string; relation: string }> = [
    { target: `project_${evidence.projectId}`, relation: "supports" },
    ...(evidence.relatedEvidenceIds || []).map((id) => ({
      target: `evidence_${id}`,
      relation: "derivedFrom",
    })),
    ...(evidence.artifactId
      ? [{ target: `artifact_${evidence.artifactId}`, relation: "supports" }]
      : []),
    ...(evidence.deliverableId
      ? [
          {
            target: `deliverable_${evidence.deliverableId}`,
            relation: "supports",
          },
        ]
      : []),
    ...(evidence.rubricIds || []).map((id) => ({
      target: `rubric_${id}`,
      relation: "satisfies",
    })),
  ];
  for (const link of links)
    batch.set(
      database
        .collection(COLLECTIONS.graphEdges)
        .doc(`${nodeId}__${link.target}`),
      {
        id: `${nodeId}__${link.target}`,
        ...base,
        from: nodeId,
        to: link.target,
        relation: link.relation,
      },
      { merge: true },
    );
  await batch.commit();
}
function owns(project: ProjectDNA, userId: string, tenantId: string) {
  return project.userId === userId && project.tenantId === tenantId;
}
function projectSummary(project: ProjectDNA): TenantProjectSummary {
  return {
    id: project.id,
    title: project.title,
    course: project.course,
    userId: project.userId,
    status: project.status,
    progress: project.progress,
    deadline: project.deadlines.final,
    riskCount: project.riskFlags.length,
    aiPolicyLevel: project.aiPolicy.level,
    updatedAt: project.updatedAt,
  };
}

export const firestoreStore = {
  async listProjects(userId: string, tenantId: string) {
    const [ownedSnap, memberSnap] = await Promise.all([
      db()
        .collection(COLLECTIONS.projects)
        .where("tenantId", "==", tenantId)
        .where("userId", "==", userId)
        .orderBy("updatedAt", "desc")
        .limit(100)
        .get(),
      db()
        .collection(COLLECTIONS.projectMembers)
        .where("tenantId", "==", tenantId)
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .limit(100)
        .get(),
    ]);
    const items = new Map<string, ProjectDNA>();
    ownedSnap.docs.forEach((d) => items.set(d.id, d.data() as ProjectDNA));
    const memberIds: string[] = [
      ...new Set<string>(
        memberSnap.docs
          .map((d) =>
            String((d.data() as Record<string, unknown>).projectId || ""),
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ].filter((id) => !items.has(id));
    if (memberIds.length) {
      const docs = await Promise.all(
        memberIds
          .slice(0, 100)
          .map((id) => db().collection(COLLECTIONS.projects).doc(id).get()),
      );
      docs.forEach((doc) => {
        if (doc.exists) {
          const project = doc.data() as ProjectDNA;
          if (project.tenantId === tenantId) items.set(doc.id, project);
        }
      });
    }
    return [...items.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 100);
  },
  async listTenantProjects(
    tenantId: string,
    limit = 100,
  ): Promise<TenantProjectSummary[]> {
    let query: any = db().collection(COLLECTIONS.projects);
    if (tenantId && !tenantId.startsWith("individual_")) {
      query = query.where("tenantId", "==", tenantId);
    }
    const snap = await query
      .orderBy("updatedAt", "desc")
      .limit(Math.min(250, Math.max(1, limit)))
      .get();
    return snap.docs
      .map((d) => projectSummary(d.data() as ProjectDNA))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getProject(id: string, userId: string, tenantId: string) {
    const doc = await db().collection(COLLECTIONS.projects).doc(id).get();
    if (!doc.exists) return null;
    const project = doc.data() as ProjectDNA;
    if (project.tenantId !== tenantId) return null;
    if (project.userId === userId) return project;
    const member = await db()
      .collection(COLLECTIONS.projectMembers)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", id)
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .limit(1)
      .get();
    return member.empty ? null : project;
  },
  async saveProject(project: ProjectDNA) {
    const persisted: ProjectDNA = {
      ...project,
      revision: Math.max(1, Number(project.revision || 1)),
    };
    const batch = db().batch();
    batch.set(
      db().collection(COLLECTIONS.projects).doc(persisted.id),
      persisted,
    );
    const versionRef = db().collection(COLLECTIONS.artifactVersions).doc();
    batch.set(versionRef, {
      id: versionRef.id,
      projectId: persisted.id,
      tenantId: persisted.tenantId,
      userId: persisted.userId,
      actorId: persisted.userId,
      summary: "Initial project state",
      versionNumber: 1,
      snapshot: persisted,
      createdAt: persisted.createdAt,
    } satisfies ProjectVersionRecord);
    const projectNode = db()
      .collection(COLLECTIONS.graphNodes)
      .doc(`project_${project.id}`);
    batch.set(projectNode, {
      id: projectNode.id,
      tenantId: project.tenantId,
      projectId: project.id,
      type: "Project",
      label: project.title,
      createdAt: project.createdAt,
    });
    for (const d of project.deliverables) {
      const node = db()
        .collection(COLLECTIONS.graphNodes)
        .doc(`deliverable_${d.id}`);
      batch.set(node, {
        id: node.id,
        tenantId: project.tenantId,
        projectId: project.id,
        type: "Deliverable",
        label: d.title,
        createdAt: project.createdAt,
      });
      const edge = db().collection(COLLECTIONS.graphEdges).doc();
      batch.set(edge, {
        id: edge.id,
        tenantId: project.tenantId,
        projectId: project.id,
        from: `project_${project.id}`,
        to: node.id,
        relation: "requires",
        createdAt: project.createdAt,
      });
    }
    for (const r of project.rubric) {
      const node = db()
        .collection(COLLECTIONS.graphNodes)
        .doc(`rubric_${r.id}`);
      batch.set(node, {
        id: node.id,
        tenantId: project.tenantId,
        projectId: project.id,
        type: "RubricCriterion",
        label: r.title,
        createdAt: project.createdAt,
      });
      const edge = db().collection(COLLECTIONS.graphEdges).doc();
      batch.set(edge, {
        id: edge.id,
        tenantId: project.tenantId,
        projectId: project.id,
        from: `project_${project.id}`,
        to: node.id,
        relation: "measures",
        createdAt: project.createdAt,
      });
    }
    const audit = db().collection(COLLECTIONS.auditLogs).doc();
    batch.set(audit, {
      id: audit.id,
      actor: project.userId,
      action: "project.create",
      target: project.id,
      tenant: project.tenantId,
      timestamp: new Date().toISOString(),
    });
    await batch.commit();
    return persisted;
  },
  async updateProject(
    project: ProjectDNA,
    actorId: string,
    summary = "Project state updated",
  ) {
    const ref = db().collection(COLLECTIONS.projects).doc(project.id);
    let persisted: ProjectDNA = project;
    await db().runTransaction(async (tx) => {
      const currentDoc = await tx.get(ref);
      if (!currentDoc.exists)
        throw Object.assign(new Error("Project not found"), {
          status: 404,
          code: "NOT_FOUND",
        });
      const current = currentDoc.data() as ProjectDNA;
      if (
        current.tenantId !== project.tenantId ||
        current.userId !== project.userId
      )
        throw Object.assign(new Error("Project scope mismatch"), {
          status: 403,
          code: "FORBIDDEN",
        });
      const nextRevision = Math.max(1, Number(current.revision || 1)) + 1;
      persisted = { ...project, revision: nextRevision };
      const versionRef = db().collection(COLLECTIONS.artifactVersions).doc();
      const version: ProjectVersionRecord = {
        id: versionRef.id,
        projectId: persisted.id,
        tenantId: persisted.tenantId,
        userId: persisted.userId,
        actorId,
        summary,
        versionNumber: nextRevision,
        snapshot: persisted,
        createdAt: new Date().toISOString(),
      };
      tx.set(ref, persisted, { merge: true });
      tx.set(versionRef, version);
    });
    await this.writeAudit(
      project.tenantId,
      actorId,
      "project.update",
      project.id,
      undefined,
      { summary, revision: persisted.revision },
    );
    return persisted;
  },
  async listProjectVersions(
    projectId: string,
    userId: string,
    tenantId: string,
  ): Promise<ProjectVersionRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.artifactVersions)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .limit(100)
      .get();
    return snap.docs
      .map((d) => d.data() as ProjectVersionRecord)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  },
  async restoreProjectVersion(
    versionId: string,
    project: ProjectDNA,
    actorId: string,
  ) {
    const versionDoc = await db()
      .collection(COLLECTIONS.artifactVersions)
      .doc(versionId)
      .get();
    if (!versionDoc.exists) return null;
    const version = versionDoc.data() as ProjectVersionRecord;
    if (
      version.projectId !== project.id ||
      version.tenantId !== project.tenantId ||
      version.userId !== project.userId
    )
      throw Object.assign(
        new Error("Version is outside the authenticated scope"),
        { status: 403, code: "FORBIDDEN" },
      );
    const restored: ProjectDNA = {
      ...version.snapshot,
      id: project.id,
      userId: project.userId,
      tenantId: project.tenantId,
      updatedAt: new Date().toISOString(),
    };
    await this.updateProject(
      restored,
      actorId,
      `Restored version ${version.versionNumber}`,
    );
    await this.writeAudit(
      project.tenantId,
      actorId,
      "project.version.restore",
      project.id,
      undefined,
      { versionId, versionNumber: version.versionNumber },
    );
    return restored;
  },
  async heartbeatProjectPresence(presence: ProjectPresenceRecord) {
    await db()
      .collection(COLLECTIONS.projectPresence)
      .doc(`${presence.projectId}__${presence.userId}`)
      .set(presence, { merge: true });
    return presence;
  },
  async listProjectPresence(
    projectId: string,
    tenantId: string,
  ): Promise<ProjectPresenceRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.projectPresence)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .limit(100)
      .get();
    const cutoff = Date.now() - 90000;
    return snap.docs
      .map((d) => d.data() as ProjectPresenceRecord)
      .filter((x) => new Date(x.lastSeenAt).getTime() >= cutoff)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  },
  async listProjectComments(
    projectId: string,
    userId: string,
    tenantId: string,
  ): Promise<ProjectComment[]> {
    const snap = await db()
      .collection(COLLECTIONS.comments)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .limit(300)
      .get();
    return snap.docs
      .map((d) => d.data() as ProjectComment)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async saveProjectComment(comment: ProjectComment) {
    await db().collection(COLLECTIONS.comments).doc(comment.id).set(comment);
    await this.writeAudit(
      comment.tenantId,
      comment.userId,
      "comment.create",
      comment.projectId,
      undefined,
      { commentId: comment.id },
    );
    return comment;
  },
  async deleteProjectComment(
    id: string,
    projectId: string,
    userId: string,
    tenantId: string,
  ) {
    const ref = db().collection(COLLECTIONS.comments).doc(id),
      doc = await ref.get();
    if (!doc.exists) return false;
    const c = doc.data() as ProjectComment;
    if (
      c.projectId !== projectId ||
      c.userId !== userId ||
      c.tenantId !== tenantId
    )
      throw Object.assign(new Error("Comment is outside scope"), {
        status: 403,
        code: "FORBIDDEN",
      });
    await ref.delete();
    await this.writeAudit(
      tenantId,
      userId,
      "comment.delete",
      projectId,
      undefined,
      { commentId: id },
    );
    return true;
  },
  async listProjectActivity(
    projectId: string,
    tenantId: string,
  ): Promise<ProjectActivityRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.auditLogs)
      .where("tenant", "==", tenantId)
      .where("target", "==", projectId)
      .limit(200)
      .get();
    return snap.docs
      .map((d) => {
        const x = d.data();
        return {
          id: d.id,
          actor: String(x.actor || ""),
          action: String(x.action || ""),
          target: String(x.target || ""),
          timestamp: String(x.timestamp || ""),
          reason: x.reason ? String(x.reason) : undefined,
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },
  async listProjectMembers(
    projectId: string,
    tenantId: string,
  ): Promise<ProjectMemberRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.projectMembers)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .limit(100)
      .get();
    return snap.docs
      .map((d) => d.data() as ProjectMemberRecord)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async findProjectInvite(projectId: string, email: string, tenantId: string) {
    const snap = await db()
      .collection(COLLECTIONS.projectMembers)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as ProjectMemberRecord);
  },
  async listPendingInvitations(
    email: string,
    tenantId: string,
  ): Promise<ProjectMemberRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.projectMembers)
      .where("tenantId", "==", tenantId)
      .where("email", "==", email.toLowerCase())
      .where("status", "==", "pending")
      .limit(100)
      .get();
    return snap.docs
      .map((d) => d.data() as ProjectMemberRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getProjectMember(id: string) {
    const doc = await db().collection(COLLECTIONS.projectMembers).doc(id).get();
    return doc.exists ? (doc.data() as ProjectMemberRecord) : null;
  },
  async saveProjectMember(member: ProjectMemberRecord, actorId: string) {
    await db()
      .collection(COLLECTIONS.projectMembers)
      .doc(member.id)
      .set(member, { merge: true });
    await this.writeAudit(
      member.tenantId,
      actorId,
      "project.member.upsert",
      member.projectId,
      undefined,
      { memberId: member.id, status: member.status, role: member.role },
    );
    return member;
  },
  async saveAudit(
    audit: SubmissionAudit,
    project: ProjectDNA,
    actorId: string,
  ) {
    const record = firestoreSafe({
      ...audit,
      tenantId: project.tenantId,
      userId: project.userId,
    });
    await db()
      .collection(COLLECTIONS.submissionAudits)
      .doc(audit.id)
      .set(record);
    await this.writeAudit(
      project.tenantId,
      actorId,
      "submission.audit",
      project.id,
      undefined,
      { result: audit.status },
    );
    return audit;
  },
  async createCourseSubmission(input: CourseSubmissionRecord) {
    const currentId = `${input.assignmentId}__${input.studentId}`,
      ref = db().collection(COLLECTIONS.courseSubmissions).doc(currentId);
    let persisted = input;
    await db().runTransaction(async (tx) => {
      const currentDoc = await tx.get(ref),
        current = currentDoc.exists
          ? (currentDoc.data() as CourseSubmissionRecord)
          : null;
      if (
        current &&
        (current.tenantId !== input.tenantId ||
          current.courseId !== input.courseId)
      )
        throw Object.assign(new Error("Submission scope mismatch"), {
          status: 403,
          code: "SUBMISSION_SCOPE",
        });
      if (current && !["returned"].includes(current.status))
        throw Object.assign(
          new Error("This assignment already has an active submission"),
          { status: 409, code: "SUBMISSION_EXISTS" },
        );
      const attempt = Math.max(1, Number(current?.attempt || 0) + 1),
        at = new Date().toISOString(),
        receiptHash = createHash("sha256")
          .update(
            JSON.stringify({
              tenantId: input.tenantId,
              courseId: input.courseId,
              assignmentId: input.assignmentId,
              projectId: input.projectId,
              studentId: input.studentId,
              attempt,
              projectRevision: input.projectRevision,
              submittedAt: at,
              snapshot: input.snapshot,
              auditId: input.audit.id,
            }),
          )
          .digest("hex");
      persisted = firestoreSafe({
        ...input,
        id: currentId,
        attempt,
        receiptHash,
        submittedAt: at,
        updatedAt: at,
      });
      const attemptRef = db()
        .collection(COLLECTIONS.courseSubmissionAttempts)
        .doc(`${currentId}__${attempt}`);
      tx.set(ref, persisted);
      tx.set(attemptRef, persisted);
    });
    await this.writeAudit(
      persisted.tenantId,
      persisted.studentId,
      "submission.create",
      persisted.projectId,
      undefined,
      {
        submissionId: persisted.id,
        assignmentId: persisted.assignmentId,
        attempt: persisted.attempt,
        receiptHash: persisted.receiptHash,
        auditStatus: persisted.audit.status,
      },
    );
    return persisted;
  },
  async getProjectSubmission(
    projectId: string,
    studentId: string,
    tenantId: string,
  ): Promise<CourseSubmissionRecord | null> {
    const snap = await db()
      .collection(COLLECTIONS.courseSubmissions)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .where("studentId", "==", studentId)
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as CourseSubmissionRecord);
  },
  async listStudentSubmissions(
    studentId: string,
    tenantId: string,
  ): Promise<CourseSubmissionRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.courseSubmissions)
      .where("tenantId", "==", tenantId)
      .where("studentId", "==", studentId)
      .limit(200)
      .get();
    return snap.docs
      .map((d) => d.data() as CourseSubmissionRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async listAssignmentSubmissions(
    courseId: string,
    assignmentId: string,
    tenantId: string,
  ): Promise<CourseSubmissionRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.courseSubmissions)
      .where("tenantId", "==", tenantId)
      .where("courseId", "==", courseId)
      .where("assignmentId", "==", assignmentId)
      .limit(500)
      .get();
    return snap.docs
      .map((d) => d.data() as CourseSubmissionRecord)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  },
  async listTenantSubmissions(
    tenantId: string,
    limit = 500,
  ): Promise<CourseSubmissionRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.courseSubmissions)
      .where("tenantId", "==", tenantId)
      .limit(Math.min(1000, Math.max(1, limit)))
      .get();
    return snap.docs
      .map((d) => d.data() as CourseSubmissionRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async gradeCourseSubmission(
    id: string,
    tenantId: string,
    actorId: string,
    patch: Pick<CourseSubmissionRecord, "status" | "rubricGrades"> &
      Partial<
        Pick<
          CourseSubmissionRecord,
          | "totalScore"
          | "maxScore"
          | "feedback"
          | "gradedBy"
          | "gradedAt"
          | "releasedAt"
          | "returnedReason"
        >
      >,
  ) {
    const ref = db().collection(COLLECTIONS.courseSubmissions).doc(id);
    let persisted: CourseSubmissionRecord | null = null;
    await db().runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists)
        throw Object.assign(new Error("Submission not found"), {
          status: 404,
          code: "SUBMISSION_NOT_FOUND",
        });
      const current = doc.data() as CourseSubmissionRecord;
      if (current.tenantId !== tenantId)
        throw Object.assign(new Error("Submission is outside tenant scope"), {
          status: 403,
          code: "SUBMISSION_SCOPE",
        });
      persisted = firestoreSafe({
        ...current,
        ...patch,
        gradedBy: patch.gradedBy || actorId,
        updatedAt: new Date().toISOString(),
      });
      tx.set(ref, persisted, { merge: true });
    });
    await this.writeAudit(
      tenantId,
      actorId,
      "submission.grade",
      id,
      undefined,
      {
        status: persisted!.status,
        totalScore: persisted!.totalScore,
        maxScore: persisted!.maxScore,
        released: Boolean(persisted!.releasedAt),
      },
    );
    return persisted!;
  },
  async listTenantAssignments(
    tenantId: string,
  ): Promise<CourseAssignmentRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.assignments)
      .where("tenantId", "==", tenantId)
      .orderBy("updatedAt", "desc")
      .limit(250)
      .get();
    return snap.docs
      .map((d) => d.data() as CourseAssignmentRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async listCourses(tenantId: string): Promise<CourseRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.courses)
      .where("tenantId", "==", tenantId)
      .orderBy("updatedAt", "desc")
      .limit(200)
      .get();
    return snap.docs
      .map((d) => d.data() as CourseRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async listCourseEnrollments(
    courseId: string,
    tenantId: string,
  ): Promise<CourseEnrollmentRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.enrollments)
      .where("tenantId", "==", tenantId)
      .where("courseId", "==", courseId)
      .limit(500)
      .get();
    return snap.docs
      .map((d) => d.data() as CourseEnrollmentRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getCourseEnrollment(
    courseId: string,
    userId: string,
    tenantId: string,
  ): Promise<CourseEnrollmentRecord | null> {
    const doc = await db()
      .collection(COLLECTIONS.enrollments)
      .doc(`${courseId}__${userId}`)
      .get();
    if (!doc.exists) return null;
    const item = doc.data() as CourseEnrollmentRecord;
    return item.tenantId === tenantId &&
      item.courseId === courseId &&
      item.userId === userId &&
      item.status === "active"
      ? item
      : null;
  },
  async listJoinCodes(
    courseId: string,
    tenantId: string,
  ): Promise<CourseJoinCodeRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.courseJoinCodes)
      .where("tenantId", "==", tenantId)
      .where("courseId", "==", courseId)
      .limit(100)
      .get();
    const at = Date.now();
    return snap.docs
      .map((d) => {
        const x = d.data() as CourseJoinCodeRecord;
        return x.status === "active" && new Date(x.expiresAt).getTime() < at
          ? { ...x, status: "expired" as const }
          : x;
      })
      .map((x) => {
        const safe = { ...x } as any;
        delete safe.codeHash;
        return safe as CourseJoinCodeRecord;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async createJoinCode(
    courseId: string,
    tenantId: string,
    actorId: string,
    input: { maxUses: number; expiresAt: string },
  ) {
    const raw = `AOS-${randomBytes(5).toString("hex").toUpperCase()}`;
    const id = randomUUID(),
      at = new Date().toISOString();
    const prefix = raw.slice(0, 8);
    const codeHash = createHash("sha256").update(raw).digest("hex");
    const record: CourseJoinCodeRecord = {
      id,
      tenantId,
      courseId,
      prefix,
      status: "active",
      maxUses: Math.min(10000, Math.max(1, Math.floor(input.maxUses || 100))),
      useCount: 0,
      expiresAt: input.expiresAt,
      createdBy: actorId,
      createdAt: at,
      updatedAt: at,
    };
    await db()
      .collection(COLLECTIONS.courseJoinCodes)
      .doc(id)
      .set({ ...record, codeHash });
    await this.writeAudit(
      tenantId,
      actorId,
      "course.join_code.create",
      courseId,
      undefined,
      { joinCodeId: id, maxUses: record.maxUses, expiresAt: record.expiresAt },
    );
    return { record, code: raw };
  },
  async revokeJoinCode(
    id: string,
    courseId: string,
    tenantId: string,
    actorId: string,
  ) {
    const ref = db().collection(COLLECTIONS.courseJoinCodes).doc(id),
      doc = await ref.get();
    if (!doc.exists) return false;
    const x = doc.data() as CourseJoinCodeRecord;
    if (x.tenantId !== tenantId || x.courseId !== courseId) return false;
    await ref.set(
      { status: "revoked", updatedAt: new Date().toISOString() },
      { merge: true },
    );
    await this.writeAudit(
      tenantId,
      actorId,
      "course.join_code.revoke",
      courseId,
      undefined,
      { joinCodeId: id },
    );
    return true;
  },
  async redeemJoinCode(rawCode: string, tenantId: string, userId: string) {
    const code = rawCode.trim().toUpperCase();
    if (!/^AOS-[A-Z0-9]{6,12}$/.test(code))
      throw Object.assign(new Error("Join code format is invalid"), {
        status: 400,
        code: "JOIN_CODE_INVALID",
      });
    const prefix = code.slice(0, 8);
    const snap = await db()
      .collection(COLLECTIONS.courseJoinCodes)
      .where("tenantId", "==", tenantId)
      .where("prefix", "==", prefix)
      .where("status", "==", "active")
      .limit(20)
      .get();
    const digest = Buffer.from(createHash("sha256").update(code).digest("hex"));
    for (const doc of snap.docs) {
      const x = doc.data() as any,
        stored = Buffer.from(String(x.codeHash || ""));
      if (stored.length !== digest.length || !timingSafeEqual(stored, digest))
        continue;
      const enrollmentId = `${String(x.courseId)}__${userId}`;
      const enrollmentRef = db()
        .collection(COLLECTIONS.enrollments)
        .doc(enrollmentId);
      let result!: CourseEnrollmentRecord;
      await db().runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists)
          throw Object.assign(new Error("Join code no longer exists"), {
            status: 404,
            code: "JOIN_CODE_NOT_FOUND",
          });
        const c = fresh.data() as any;
        if (
          c.status !== "active" ||
          new Date(String(c.expiresAt)).getTime() < Date.now()
        )
          throw Object.assign(new Error("Join code has expired"), {
            status: 410,
            code: "JOIN_CODE_EXPIRED",
          });
        if (Number(c.useCount || 0) >= Number(c.maxUses || 0))
          throw Object.assign(
            new Error("Join code has reached its maximum uses"),
            { status: 409, code: "JOIN_CODE_MAX_USES" },
          );
        const existing = await tx.get(enrollmentRef);
        const at = new Date().toISOString();
        result = existing.exists
          ? (existing.data() as CourseEnrollmentRecord)
          : {
              id: enrollmentId,
              tenantId,
              courseId: String(c.courseId),
              userId,
              role: "student",
              status: "active",
              source: "join_code",
              createdAt: at,
              updatedAt: at,
            };
        if (!existing.exists) {
          tx.set(enrollmentRef, result);
          tx.set(
            doc.ref,
            { useCount: Number(c.useCount || 0) + 1, updatedAt: at },
            { merge: true },
          );
        }
      });
      await this.writeAudit(
        tenantId,
        userId,
        "course.enrollment.join_code",
        result.courseId,
        undefined,
        { joinCodeId: doc.id, enrollmentId: result.id },
      );
      return result;
    }
    throw Object.assign(
      new Error("Join code was not found for this institution"),
      { status: 404, code: "JOIN_CODE_NOT_FOUND" },
    );
  },
  async getCourse(id: string, tenantId: string): Promise<CourseRecord | null> {
    const doc = await db().collection(COLLECTIONS.courses).doc(id).get();
    if (!doc.exists) return null;
    const course = doc.data() as CourseRecord;
    return course.tenantId === tenantId ? course : null;
  },
  async saveCourse(course: CourseRecord, actorId: string) {
    await db()
      .collection(COLLECTIONS.courses)
      .doc(course.id)
      .set(course, { merge: true });
    await this.writeAudit(
      course.tenantId,
      actorId,
      "course.upsert",
      course.id,
      undefined,
      { status: course.status },
    );
    return course;
  },
  async listCourseAssignments(
    courseId: string,
    tenantId: string,
  ): Promise<CourseAssignmentRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.assignments)
      .where("tenantId", "==", tenantId)
      .where("courseId", "==", courseId)
      .limit(200)
      .get();
    return snap.docs
      .map((d) => d.data() as CourseAssignmentRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getCourseAssignment(
    id: string,
    courseId: string,
    tenantId: string,
  ): Promise<CourseAssignmentRecord | null> {
    const doc = await db().collection(COLLECTIONS.assignments).doc(id).get();
    if (!doc.exists) return null;
    const item = doc.data() as CourseAssignmentRecord;
    return item.tenantId === tenantId && item.courseId === courseId
      ? item
      : null;
  },
  async saveCourseAssignment(item: CourseAssignmentRecord, actorId: string) {
    await db()
      .collection(COLLECTIONS.assignments)
      .doc(item.id)
      .set(item, { merge: true });
    await this.writeAudit(
      item.tenantId,
      actorId,
      "assignment.upsert",
      item.id,
      undefined,
      { courseId: item.courseId, status: item.status },
    );
    return item;
  },
  async getProfile(
    userId: string,
    tenantId: string,
    fallback: { displayName: string; email?: string },
  ): Promise<UserProfile> {
    const ref = db().collection(COLLECTIONS.profiles).doc(userId);
    const doc = await ref.get();
    if (doc.exists) {
      const profile = doc.data() as UserProfile;
      if (
        profile.tenantId !== tenantId &&
        !tenantId.startsWith("individual_") &&
        !profile.tenantId?.startsWith("individual_")
      )
        throw Object.assign(new Error("Profile tenant mismatch"), {
          status: 403,
          code: "TENANT_MISMATCH",
        });
      return profile;
    }
    const newProfile: UserProfile = {
      userId,
      tenantId,
      displayName: fallback.displayName || "AcademicOS User",
      email: fallback.email || "",
      onboardingCompleted: false,
      updatedAt: new Date().toISOString(),
    };
    await this.saveProfile(newProfile, userId);
    return newProfile;
  },
  async saveProfile(profile: UserProfile, actorId: string) {
    const persisted = firestoreSafe(profile);
    await db()
      .collection(COLLECTIONS.profiles)
      .doc(profile.userId)
      .set(persisted, { merge: true });
    await db().collection(COLLECTIONS.users).doc(profile.userId).set(
      {
        id: profile.userId,
        tenantId: profile.tenantId,
        email: profile.email,
        displayName: profile.displayName,
        updatedAt: profile.updatedAt,
      },
      { merge: true },
    );
    await this.writeAudit(
      profile.tenantId,
      actorId,
      "profile.update",
      profile.userId,
    );
    return persisted;
  },
  async recordAIUsage(
    usage: AIUsage,
    actor: { userId: string; tenantId: string },
    projectId?: string,
  ) {
    const ref = db().collection(COLLECTIONS.aiRuns).doc();
    await ref.set({
      id: ref.id,
      ...usage,
      tenantId: actor.tenantId,
      userId: actor.userId,
      projectId: projectId || null,
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  },
  // تخزين مؤقت مُعنوَن بالمحتوى للدروس/الحلول: نفس المفتاح => نفس النتيجة (اتساق + توفير تكلفة).
  // المفتاح يُحسب من (النوع+الموضوع+اللغة+المستوى+النطاق) في طبقة الخدمة؛ هنا فقط تخزين/جلب.
  async getLearnCache(scopeId: string, key: string): Promise<any | null> {
    const snap = await db()
      .collection(COLLECTIONS.learnCache)
      .doc(`${scopeId}__${key}`)
      .get();
    return snap.exists ? (snap.data() as any)?.payload ?? null : null;
  },
  async setLearnCache(
    scopeId: string,
    key: string,
    payload: unknown,
    meta: Record<string, unknown> = {},
  ) {
    await db()
      .collection(COLLECTIONS.learnCache)
      .doc(`${scopeId}__${key}`)
      .set(
        firestoreSafe({
          id: `${scopeId}__${key}`,
          scopeId,
          key,
          payload,
          ...meta,
          createdAt: new Date().toISOString(),
        }),
      );
  },
  // ---- Project Copilot self-hosted vector store (File Search) ----
  // Vectors live in YOUR Firestore, scoped strictly by tenant + (project|course).
  // Raw files never leave to a managed third-party File Search store.
  async replaceRetrievalIndex(
    tenantId: string,
    scopeType: "project" | "course",
    scopeId: string,
    chunks: Array<Record<string, unknown> & { id: string }>,
    projectId?: string,
  ) {
    const database = db();
    const col = database.collection(COLLECTIONS.copilotChunks);
    const scopeKey = `${tenantId}__${scopeType}__${scopeId}`;
    // Delete any previous index for this scope, then write fresh (bounded batches ≤ 400).
    const existing = await col.where("scopeKey", "==", scopeKey).limit(1000).get();
    const capped = chunks.slice(0, 400);
    const ops: ReturnType<typeof database.batch>[] = [];
    let batch = database.batch();
    let count = 0;
    const push = () => { ops.push(batch); batch = database.batch(); count = 0; };
    for (const doc of existing.docs) {
      batch.delete(doc.ref);
      if (++count >= 400) push();
    }
    const at = new Date().toISOString();
    for (const chunk of capped) {
      batch.set(
        col.doc(`${scopeKey}__${chunk.id}`),
        firestoreSafe({ ...chunk, id: `${scopeKey}__${chunk.id}`, chunkId: chunk.id, tenantId, scopeType, scopeId, scopeKey, projectId: projectId || null, updatedAt: at }),
      );
      if (++count >= 400) push();
    }
    if (count > 0) push();
    for (const b of ops) await b.commit();
    return { indexed: capped.length, removed: existing.size, truncated: chunks.length > capped.length };
  },
  async listRetrievalChunks(
    tenantId: string,
    scopeType: "project" | "course",
    scopeId: string,
  ): Promise<any[]> {
    const scopeKey = `${tenantId}__${scopeType}__${scopeId}`;
    const snap = await db()
      .collection(COLLECTIONS.copilotChunks)
      .where("scopeKey", "==", scopeKey)
      .limit(1000)
      .get();
    return snap.docs.map((d) => d.data() as any);
  },
  async writeAudit(
    tenantId: string,
    actor: string,
    action: string,
    target: string,
    reason?: string,
    extra: Record<string, unknown> = {},
  ) {
    const ref = db().collection(COLLECTIONS.auditLogs).doc();
    await ref.set(
      firestoreSafe({
        id: ref.id,
        actor,
        action,
        target,
        tenant: tenantId,
        timestamp: new Date().toISOString(),
        ...(reason ? { reason } : {}),
        ...extra,
      }),
    );
  },
  async saveVivaSession(session: VivaSession) {
    await db()
      .collection(COLLECTIONS.vivaSessions)
      .doc(session.id)
      .set(session);
    await this.writeAudit(
      session.tenantId,
      session.userId,
      "viva.start",
      session.projectId,
      undefined,
      { sessionId: session.id, mode: session.mode },
    );
    return session;
  },
  async getVivaSession(
    id: string,
    projectId: string,
    userId: string,
    tenantId: string,
  ) {
    const doc = await db().collection(COLLECTIONS.vivaSessions).doc(id).get();
    if (!doc.exists) return null;
    const session = doc.data() as VivaSession;
    return session.projectId === projectId &&
      session.userId === userId &&
      session.tenantId === tenantId
      ? session
      : null;
  },
  async updateVivaSession(session: VivaSession) {
    await db()
      .collection(COLLECTIONS.vivaSessions)
      .doc(session.id)
      .set(session, { merge: true });
    return session;
  },
  async saveLearningEvidence(evidence: LearningEvidenceRecord) {
    await db()
      .collection(COLLECTIONS.learningEvidence)
      .doc(evidence.id)
      .set(evidence);
    await this.writeAudit(
      evidence.tenantId,
      evidence.userId,
      "learning_evidence.create",
      evidence.projectId,
      undefined,
      { evidenceId: evidence.id, source: evidence.source },
    );
    return evidence;
  },
  async listLearningEvidence(
    projectId: string,
    userId: string,
    tenantId: string,
  ) {
    const snap = await db()
      .collection(COLLECTIONS.learningEvidence)
      .where("tenantId", "==", tenantId)
      .where("userId", "==", userId)
      .where("projectId", "==", projectId)
      .limit(100)
      .get();
    return snap.docs
      .map((d) => d.data() as LearningEvidenceRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async listUserLearningEvidence(
    userId: string,
    tenantId: string,
  ): Promise<LearningEvidenceRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.learningEvidence)
      .where("tenantId", "==", tenantId)
      .where("userId", "==", userId)
      .limit(500)
      .get();
    return snap.docs
      .map((d) => d.data() as LearningEvidenceRecord)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async listProjectAIRuns(
    projectId: string,
    tenantId: string,
    userId?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const snap = await db()
      .collection(COLLECTIONS.aiRuns)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .limit(300)
      .get();
    return snap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((x) => !userId || String(x.userId || "") === userId)
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
  },
  async listWorkspaceArtifacts(
    projectId: string,
    tenantId: string,
    includeDeleted = false,
  ): Promise<WorkspaceArtifact[]> {
    const snap = await db()
      .collection(COLLECTIONS.artifacts)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .limit(300)
      .get();
    return snap.docs
      .map((d) => d.data() as WorkspaceArtifact)
      .filter((x) => includeDeleted || !x.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getWorkspaceArtifact(id: string) {
    const doc = await db().collection(COLLECTIONS.artifacts).doc(id).get();
    return doc.exists ? (doc.data() as WorkspaceArtifact) : null;
  },
  async saveWorkspaceArtifact(
    artifact: WorkspaceArtifact,
    actorId: string,
    expectedRevision?: number,
  ) {
    const ref = db().collection(COLLECTIONS.artifacts).doc(artifact.id);
    let persisted: WorkspaceArtifact = artifact;
    let previous: WorkspaceArtifact | null = null;
    await db().runTransaction(async (tx) => {
      const currentDoc = await tx.get(ref);
      const current = currentDoc.exists
        ? (currentDoc.data() as WorkspaceArtifact)
        : null;
      previous = current;
      if (
        current &&
        (current.tenantId !== artifact.tenantId ||
          current.projectId !== artifact.projectId)
      )
        throw Object.assign(new Error("Artifact scope mismatch"), {
          status: 403,
          code: "FORBIDDEN",
        });
      if (
        current &&
        expectedRevision !== undefined &&
        Number(current.revision || 0) !== Number(expectedRevision)
      )
        throw Object.assign(
          new Error(
            "This work item changed in another session. Reload the latest version before saving so no teammate work is overwritten.",
          ),
          {
            status: 409,
            code: "ARTIFACT_REVISION_CONFLICT",
            currentRevision: Number(current.revision || 0),
          },
        );
      const nextRevision = Math.max(0, Number(current?.revision || 0)) + 1;
      persisted = { ...artifact, revision: nextRevision };
      const versionRef = db()
        .collection(COLLECTIONS.workspaceArtifactVersions)
        .doc();
      const version: WorkspaceArtifactVersion = {
        id: versionRef.id,
        artifactId: persisted.id,
        projectId: persisted.projectId,
        tenantId: persisted.tenantId,
        actorId,
        versionNumber: nextRevision,
        snapshot: persisted,
        createdAt: new Date().toISOString(),
      };
      tx.set(ref, persisted, { merge: true });
      tx.set(versionRef, version);
    });
    await syncArtifactGraph(persisted, previous);
    await this.writeAudit(
      persisted.tenantId,
      actorId,
      "workspace.artifact.upsert",
      persisted.projectId,
      undefined,
      {
        artifactId: persisted.id,
        module: persisted.module,
        status: persisted.status,
        revision: persisted.revision,
        deliverableId: persisted.deliverableId || null,
        rubricIds: persisted.rubricIds || [],
      },
    );
    return persisted;
  },
  async listWorkspaceArtifactVersions(
    artifactId: string,
    projectId: string,
    tenantId: string,
  ): Promise<WorkspaceArtifactVersion[]> {
    const snap = await db()
      .collection(COLLECTIONS.workspaceArtifactVersions)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .where("artifactId", "==", artifactId)
      .limit(100)
      .get();
    return snap.docs
      .map((d) => d.data() as WorkspaceArtifactVersion)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  },
  async restoreWorkspaceArtifactVersion(
    versionId: string,
    project: ProjectDNA,
    artifactId: string,
    actorId: string,
  ) {
    const versionDoc = await db()
      .collection(COLLECTIONS.workspaceArtifactVersions)
      .doc(versionId)
      .get();
    if (!versionDoc.exists) return null;
    const version = versionDoc.data() as WorkspaceArtifactVersion;
    if (
      version.tenantId !== project.tenantId ||
      version.projectId !== project.id ||
      version.artifactId !== artifactId
    )
      throw Object.assign(
        new Error("Artifact version is outside the authenticated scope"),
        { status: 403, code: "FORBIDDEN" },
      );
    const current = await this.getWorkspaceArtifact(artifactId);
    if (
      !current ||
      current.projectId !== project.id ||
      current.tenantId !== project.tenantId
    )
      return null;
    const restored: WorkspaceArtifact = {
      ...version.snapshot,
      id: current.id,
      projectId: project.id,
      tenantId: project.tenantId,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    };
    const persisted = await this.saveWorkspaceArtifact(restored, actorId);
    await this.writeAudit(
      project.tenantId,
      actorId,
      "workspace.artifact.restore",
      project.id,
      undefined,
      {
        artifactId,
        versionId,
        fromVersion: version.versionNumber,
        toVersion: persisted.revision,
      },
    );
    return persisted;
  },
  async deleteWorkspaceArtifact(
    id: string,
    project: ProjectDNA,
    actorId: string,
  ) {
    const ref = db().collection(COLLECTIONS.artifacts).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    const artifact = doc.data() as WorkspaceArtifact;
    if (
      artifact.tenantId !== project.tenantId ||
      artifact.projectId !== project.id
    )
      throw Object.assign(
        new Error("Artifact is outside the authenticated scope"),
        { status: 403, code: "FORBIDDEN" },
      );
    if (artifact.createdBy !== actorId && project.userId !== actorId)
      throw Object.assign(
        new Error("Only the creator or project owner can delete this artifact"),
        { status: 403, code: "ARTIFACT_DELETE_FORBIDDEN" },
      );
    const at = new Date().toISOString();
    await ref.set(
      { deletedAt: at, deletedBy: actorId, updatedAt: at, updatedBy: actorId },
      { merge: true },
    );
    await this.writeAudit(
      project.tenantId,
      actorId,
      "workspace.artifact.recycle",
      project.id,
      undefined,
      { artifactId: id, module: artifact.module },
    );
    return true;
  },
  async restoreWorkspaceArtifact(
    id: string,
    project: ProjectDNA,
    actorId: string,
  ) {
    const ref = db().collection(COLLECTIONS.artifacts).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const artifact = doc.data() as WorkspaceArtifact;
    if (
      artifact.tenantId !== project.tenantId ||
      artifact.projectId !== project.id
    )
      throw Object.assign(
        new Error("Artifact is outside the authenticated scope"),
        { status: 403, code: "FORBIDDEN" },
      );
    if (!artifact.deletedAt) return artifact;
    const restored = {
      ...artifact,
      deletedAt: undefined,
      deletedBy: undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };
    delete restored.deletedAt;
    delete restored.deletedBy;
    await ref.set(restored);
    await this.writeAudit(
      project.tenantId,
      actorId,
      "workspace.artifact.restore_deleted",
      project.id,
      undefined,
      { artifactId: id, module: artifact.module },
    );
    return restored as WorkspaceArtifact;
  },
  async listProjectEvidence(
    projectId: string,
    userId: string,
    tenantId: string,
  ) {
    const snap = await db()
      .collection(COLLECTIONS.projectEvidence)
      .where("tenantId", "==", tenantId)
      .where("projectId", "==", projectId)
      .limit(200)
      .get();
    return snap.docs
      .map((d) => d.data() as ProjectEvidence)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async saveProjectEvidence(evidence: ProjectEvidence) {
    await db()
      .collection(COLLECTIONS.projectEvidence)
      .doc(evidence.id)
      .set(evidence);
    await syncEvidenceGraph(evidence);
    await this.writeAudit(
      evidence.tenantId,
      evidence.userId,
      "evidence.create",
      evidence.projectId,
      undefined,
      { evidenceId: evidence.id, evidenceType: evidence.type },
    );
    return evidence;
  },
  async deleteProjectEvidence(
    id: string,
    projectId: string,
    userId: string,
    tenantId: string,
  ) {
    const ref = db().collection(COLLECTIONS.projectEvidence).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    const evidence = doc.data() as ProjectEvidence;
    if (
      evidence.projectId !== projectId ||
      evidence.userId !== userId ||
      evidence.tenantId !== tenantId
    )
      throw Object.assign(
        new Error("Evidence is outside the authenticated scope"),
        { status: 403, code: "FORBIDDEN" },
      );
    const nodeId = `evidence_${id}`;
    const [outgoing, incoming] = await Promise.all([
      db()
        .collection(COLLECTIONS.graphEdges)
        .where("tenantId", "==", tenantId)
        .where("projectId", "==", projectId)
        .where("from", "==", nodeId)
        .limit(100)
        .get(),
      db()
        .collection(COLLECTIONS.graphEdges)
        .where("tenantId", "==", tenantId)
        .where("projectId", "==", projectId)
        .where("to", "==", nodeId)
        .limit(100)
        .get(),
    ]);
    const batch = db().batch();
    batch.delete(ref);
    batch.delete(db().collection(COLLECTIONS.graphNodes).doc(nodeId));
    for (const doc of [...outgoing.docs, ...incoming.docs])
      batch.delete(doc.ref);
    await batch.commit();
    await this.writeAudit(
      tenantId,
      userId,
      "evidence.delete",
      projectId,
      undefined,
      { evidenceId: id },
    );
    return true;
  },
  async listProjectGraph(projectId: string, tenantId: string) {
    const [nodes, edges] = await Promise.all([
      db()
        .collection(COLLECTIONS.graphNodes)
        .where("tenantId", "==", tenantId)
        .where("projectId", "==", projectId)
        .limit(500)
        .get(),
      db()
        .collection(COLLECTIONS.graphEdges)
        .where("tenantId", "==", tenantId)
        .where("projectId", "==", projectId)
        .limit(1000)
        .get(),
    ]);
    return {
      nodes: nodes.docs.map((d) => d.data()),
      edges: edges.docs.map((d) => d.data()),
    };
  },
  async listFeatureFlags(tenantId: string): Promise<FeatureFlagRecord[]> {
    const snap = await db()
      .collection(COLLECTIONS.featureFlags)
      .where("tenantId", "==", tenantId)
      .limit(100)
      .get();
    return snap.docs.map((d) => d.data() as FeatureFlagRecord);
  },
  async getFeatureFlag(tenantId: string, key: string, defaultValue = true) {
    const ref = db()
      .collection(COLLECTIONS.featureFlags)
      .doc(`${tenantId}__${key}`);
    const doc = await ref.get();
    return doc.exists
      ? Boolean((doc.data() as FeatureFlagRecord).enabled)
      : defaultValue;
  },
  async saveFeatureFlag(flag: FeatureFlagRecord, actorId: string) {
    await db()
      .collection(COLLECTIONS.featureFlags)
      .doc(`${flag.tenantId}__${flag.key}`)
      .set(flag, { merge: true });
    await this.writeAudit(
      flag.tenantId,
      actorId,
      "feature_flag.update",
      flag.key,
      undefined,
      { enabled: flag.enabled },
    );
    return flag;
  },
  async listMySupportTickets(
    userId: string,
    tenantId: string,
  ): Promise<SupportTicket[]> {
    const snap = await db()
      .collection(COLLECTIONS.supportTickets)
      .where("tenantId", "==", tenantId)
      .where("userId", "==", userId)
      .limit(100)
      .get();
    return snap.docs
      .map((d) => d.data() as SupportTicket)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async listTenantSupportTickets(tenantId: string): Promise<SupportTicket[]> {
    const snap = await db()
      .collection(COLLECTIONS.supportTickets)
      .where("tenantId", "==", tenantId)
      .limit(250)
      .get();
    return snap.docs
      .map((d) => d.data() as SupportTicket)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async saveSupportTicket(ticket: SupportTicket, actorId: string) {
    await db()
      .collection(COLLECTIONS.supportTickets)
      .doc(ticket.id)
      .set(ticket, { merge: true });
    await this.writeAudit(
      ticket.tenantId,
      actorId,
      "support.ticket.upsert",
      ticket.id,
      undefined,
      { status: ticket.status, priority: ticket.priority },
    );
    return ticket;
  },
  async getSupportTicket(id: string, tenantId: string) {
    const doc = await db().collection(COLLECTIONS.supportTickets).doc(id).get();
    if (!doc.exists) return null;
    const ticket = doc.data() as SupportTicket;
    return ticket.tenantId === tenantId ? ticket : null;
  },
  async countUsers(tenantId?: string) {
    let query: any = db().collection(COLLECTIONS.users);
    if (tenantId && !tenantId.startsWith("individual_")) {
      query = query.where("tenantId", "==", tenantId);
    }
    let count = 0;
    try {
      const snap = await query.count().get();
      count = snap.data().count as number;
    } catch {}
    if (count === 0) {
      try {
        const list = await getAuth().listUsers(1000);
        count = list.users.length;
      } catch {}
    }
    return count;
  },
  async getControlPlane(tenantId: string): Promise<ControlPlaneData> {
    const projects = await this.listTenantProjects(tenantId, 150);
    const isPlatformTenant = !tenantId || tenantId.startsWith("individual_");

    let auditQuery: any = db().collection(COLLECTIONS.auditLogs);
    let aiQuery: any = db().collection(COLLECTIONS.aiRuns);
    let incidentQuery: any = db().collection(COLLECTIONS.securityEvents).where("status", "==", "open");
    let supportQuery: any = db().collection(COLLECTIONS.supportTickets);

    if (!isPlatformTenant) {
      auditQuery = auditQuery.where("tenant", "==", tenantId);
      aiQuery = aiQuery.where("tenantId", "==", tenantId);
      incidentQuery = incidentQuery.where("tenantId", "==", tenantId);
      supportQuery = supportQuery.where("tenantId", "==", tenantId);
    }

    const [users, auditSnap, aiSnap, incidentSnap, supportSnap] =
      await Promise.all([
        this.countUsers(tenantId),
        auditQuery.limit(50).get(),
        aiQuery.limit(500).get(),
        incidentQuery.limit(100).get(),
        supportQuery.limit(250).get(),
      ]);
    const now = Date.now();
    const sevenDays = now + 7 * 86400000;
    const aiCostUsd = aiSnap.docs.reduce(
      (sum, d) => sum + Number(d.data().estimatedCostUsd || 0),
      0,
    );
    return {
      metrics: {
        users,
        projects: projects.length,
        activeProjects: projects.filter((p) => p.status !== "completed").length,
        dueSoon: projects.filter(
          (p) =>
            p.deadline &&
            new Date(p.deadline).getTime() >= now &&
            new Date(p.deadline).getTime() <= sevenDays,
        ).length,
        aiCostUsd: Number(aiCostUsd.toFixed(4)),
        openIncidents: incidentSnap.size,
        supportBacklog: supportSnap.docs.filter((d) =>
          ["open", "in_progress"].includes(String(d.data().status)),
        ).length,
      },
      projects,
      audit: auditSnap.docs
        .map((d) => {
          const x = d.data();
          return {
            id: d.id,
            actor: String(x.actor || ""),
            action: String(x.action || ""),
            target: String(x.target || ""),
            timestamp: String(x.timestamp || ""),
            reason: x.reason ? String(x.reason) : undefined,
          };
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      system: {},
    };
  },
};

export async function buildDashboard(
  userId: string,
  tenantId: string,
): Promise<DashboardSummary> {
  const list = await firestoreStore.listProjects(userId, tenantId);
  const now = Date.now();
  const sevenDays = now + 7 * 86400000;
  return {
    projects: list,
    stats: {
      active: list.filter((p) => p.status !== "completed").length,
      dueSoon: list.filter(
        (p) =>
          p.deadlines.final &&
          new Date(p.deadlines.final).getTime() >= now &&
          new Date(p.deadlines.final).getTime() <= sevenDays &&
          p.status !== "completed",
      ).length,
      completed: list.filter((p) => p.status === "completed").length,
      workloadHours: list.reduce(
        (s, p) => s + (p.estimatedWorkloadHours || 0),
        0,
      ),
    },
    upcoming: list
      .flatMap((p) => [
        ...(p.deadlines.final
          ? [
              {
                id: `deadline_${p.id}`,
                title: p.title,
                date: p.deadlines.final,
                type: "deadline",
                projectId: p.id,
              },
            ]
          : []),
        ...p.deadlines.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          date: m.date,
          type: "milestone",
          projectId: p.id,
        })),
      ])
      .filter((item) => new Date(item.date).getTime() >= now)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8),
    risks: list.flatMap((p) =>
      p.riskFlags.slice(0, 2).map((message) => ({
        projectId: p.id,
        projectTitle: p.title,
        message,
        severity: "important" as const,
      })),
    ),
  };
}

export async function buildSkills(
  userId: string,
  tenantId: string,
): Promise<SkillEvidence[]> {
  const projects = await firestoreStore.listProjects(userId, tenantId);
  const learningSnap = await db()
    .collection(COLLECTIONS.learningEvidence)
    .where("tenantId", "==", tenantId)
    .where("userId", "==", userId)
    .limit(500)
    .get();
  const learningCounts = new Map<string, number>();
  learningSnap.docs.forEach((doc) => {
    const projectId = String(doc.data().projectId || "");
    learningCounts.set(projectId, (learningCounts.get(projectId) || 0) + 1);
  });
  return projects.flatMap((p) => {
    const completedTasks = p.tasks.filter(
      (t) => t.status === "completed",
    ).length;
    const learning = learningCounts.get(p.id) || 0;
    if (
      !completedTasks &&
      !learning &&
      !p.deliverables.some(
        (d) => d.status === "ready" || d.status === "completed",
      )
    )
      return [];
    return p.requiredSkills.map((skill, index) => ({
      id: `${p.id}_${index}`,
      skill,
      projectId: p.id,
      projectTitle: p.title,
      course: p.course,
      date: p.updatedAt,
      verificationLevel: "project" as const,
      evidence: `مرتبط بنشاط فعلي في المشروع: ${completedTasks} مهام مكتملة، ${learning} أدلة تعلم. ليس تحققًا مؤسسيًا نهائيًا.`,
    }));
  });
}

export async function buildPassport(
  userId: string,
  tenantId: string,
  displayName: string,
): Promise<PassportData> {
  const [projects, profile, credentials] = await Promise.all([
    firestoreStore.listProjects(userId, tenantId),
    firestoreStore.getProfile(userId, tenantId, { displayName }),
    db()
      .collection(COLLECTIONS.credentials)
      .where("userId", "==", userId)
      .where("tenantId", "==", tenantId)
      .limit(50)
      .get(),
  ]);
  const available = projects.map((p) => ({
    id: p.id,
    title: p.title,
    course: p.course,
    status: p.status,
  }));
  const selected = new Set(profile.passportProjectIds || []);
  return {
    user: {
      displayName: profile.displayName || displayName,
      education: profile.specialization,
      institution: profile.university,
    },
    projects: available.filter((p) => selected.has(p.id)),
    availableProjects: available,
    visibility: profile.passportVisibility || "private",
    skills: await buildSkills(userId, tenantId),
    credentials: credentials.docs.map(
      (d) => d.data() as PassportData["credentials"][number],
    ),
  };
}
