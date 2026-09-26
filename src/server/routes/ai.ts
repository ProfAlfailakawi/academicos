// AI service routes (semantic index, translation, Learning Studio intake /
// explain / solve) extracted verbatim from server.ts (no behaviour change).
import type { Express } from "express";
import { createHash } from "node:crypto";
import { aiConfigured, getAIProvider } from "../ai";
import { createExtractionBudget, extractFileText, type IncomingFile } from "../file-extract";
import { buildTutorRequest, nativeTutorScaffold, toLesson } from "../tutor";
import { buildSolveRequest, buildSolveVariation, decideSolveMode, nativeSolveScaffold, toSolveResult } from "../solver";
import { learnCacheKey, cacheScope } from "../learn-cache";
import { firestoreStore } from "../db";
import { platformStore } from "../platform-store";
import { externalServices } from "../external-adapters";
import { runOcr } from "../ocr";
import { txf } from "../server-locale";
import { SRV } from "../server-messages";
import type { AuthenticatedRequest, RouteDeps } from "./types";

export function registerAiServiceRoutes(app: Express, deps: RouteDeps) {
  const { authenticate, assertFeature, cleanField } = deps;
  app.post(
    "/api/semantic",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        await assertFeature(req.actor!.tenantId, "SemanticRAG");
        if (!externalServices.semantic.configured())
          return res.status(503).json({
            error:
              "Semantic index is disabled until its tenant-scoped service is configured.",
            code: "SEMANTIC_NOT_CONFIGURED",
          });
        const a = req.actor!,
          action = String(req.body?.action || "search");
        if (!["index", "search"].includes(action))
          return res.status(400).json({
            error: "Invalid semantic action",
            code: "SEMANTIC_ACTION_INVALID",
          });
        const projectId = cleanField(req.body?.projectId, 180);
        if (projectId) {
          const project = await firestoreStore.getProject(
            projectId,
            a.userId,
            a.tenantId,
          );
          if (!project)
            return res
              .status(404)
              .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        }
        const result = await externalServices.semantic.run({
          action,
          tenantId: a.tenantId,
          userId: a.userId,
          projectId: projectId || undefined,
          query: cleanField(req.body?.query, 4000),
          documents: Array.isArray(req.body?.documents)
            ? req.body.documents.slice(0, 100)
            : undefined,
          requireCitations: true,
        });
        res.json({ success: true, result });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/translate",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        if (!externalServices.translation.configured())
          return res.status(503).json({
            error: "Translation service is not configured",
            code: "TRANSLATION_NOT_CONFIGURED",
          });
        const a = req.actor!,
          text = cleanField(req.body?.text, 30000),
          target = cleanField(req.body?.targetLocale, 30),
          source = cleanField(req.body?.sourceLocale, 30) || "auto";
        if (!text || !target)
          return res.status(400).json({
            error: "text and targetLocale are required",
            code: "TRANSLATION_INPUT_REQUIRED",
          });
        const result = await externalServices.translation.run({
          tenantId: a.tenantId,
          userId: a.userId,
          text,
          sourceLocale: source,
          targetLocale: target,
          preserveCitations: true,
        });
        res.json({ success: true, result });
      } catch (e) {
        next(e);
      }
    },
  );
}

export function registerLearnRoutes(app: Express, deps: RouteDeps) {
  const {
    authenticate,
    canManageCourse,
    cleanField,
    normalizeAcademicPolicy,
    recordProductEventSafe,
    reqLocale,
    validateFile,
    MAX_ASSIGNMENT_FILES,
    MAX_TOTAL_FILE_BYTES,
  } = deps;
  app.post(
    "/api/learn/intake",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const body = req.body || {};
        const files = (Array.isArray(body.files) ? body.files : []) as IncomingFile[];
        const note = cleanField(body.note, 2000) || "";
        if (!files.length && !note.trim())
          return res.status(400).json({ error: "Provide study material or a note", code: "STUDY_MATERIAL_REQUIRED" });
        if (files.length > MAX_ASSIGNMENT_FILES)
          return res.status(413).json({ error: `A maximum of ${MAX_ASSIGNMENT_FILES} files can be studied together`, code: "TOO_MANY_FILES" });
        files.forEach(validateFile);
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        if (totalBytes > MAX_TOTAL_FILE_BYTES)
          return res.status(413).json({ error: "Combined study files are too large", code: "TOTAL_FILES_TOO_LARGE" });
        if (files.length) {
          if (process.env.REQUIRE_VIRUS_SCAN === "true" && !externalServices.virusScan.configured())
            return res.status(503).json({ error: "Malware scanning is required but not configured", code: "VIRUS_SCAN_REQUIRED" });
          if (externalServices.virusScan.configured()) {
            for (const file of files) {
              const result: any = await externalServices.virusScan.run({
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                sha256: createHash("sha256").update(Buffer.from(file.base64, "base64")).digest("hex"),
                base64: file.base64,
              });
              if (result?.clean !== true)
                throw Object.assign(new Error(`Upload blocked by malware scanner: ${file.name}`), { status: 422, code: "MALWARE_DETECTED" });
            }
          }
        }

        const parts = note.trim() ? [`--- STUDENT NOTE ---\n${note.trim()}`] : [];
        const warnings: string[] = [];
        const extractionBudget = createExtractionBudget(MAX_TOTAL_FILE_BYTES, 120_000);
        for (const file of files) {
          const extracted = extractFileText(file, extractionBudget);
          if (extracted.text) parts.push(`--- ${file.name} ---\n${extracted.text}`);
          if (extracted.multimodal) {
            const ocr = await runOcr(file);
            if (ocr?.text) {
              parts.push(`--- ${file.name} (OCR) ---\n${ocr.text}`);
              warnings.push(...ocr.extraction.warnings);
            } else {
              warnings.push(
                txf(SRV.ocrRequired, reqLocale(req), { file: file.name }),
              );
            }
          }
        }
        const materialText = parts.join("\n\n").trim();
        if (!materialText)
          return res.status(422).json({ error: "Could not extract readable study text. Configure OCR for image-only material.", code: "STUDY_TEXT_NOT_EXTRACTED" });

        let guide = {
          summary: materialText.slice(0, 900),
          keyIdeas: materialText.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 30).slice(0, 6),
          examPrompts: [] as string[],
          warnings,
        };
        let source: "ai" | "scaffold" = "scaffold";
        if (aiConfigured({ taskType: "exam_material_intake", complexity: "medium", risk: "low" })) {
          const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
          try {
            const result = await getAIProvider({ taskType: "exam_material_intake", complexity: "medium", risk: "low" }).runAcademicTask({
              taskType: "exam_material_intake",
              agent: "exam_coach",
              projectContext: { fileCount: files.length, learnerId: a.userId },
              artifact: { module: "exam_autopilot", title: "Study material", content: materialText.slice(0, 60_000) },
              platformInstruction: "Build an exam-prep capsule from the supplied study material only. summary = concise map of the material. findings = the most important examinable ideas. suggestions = challenging practice questions that require understanding, not rote copying. warnings = ambiguities, unreadable areas, or evidence gaps. Do not invent facts outside the material and do not claim certainty where the material is incomplete.",
              learnerInstruction: note || "Prepare me for an exam from these materials.",
              policySummary: "Learning and exam preparation only; do not fabricate sources or course policy.",
            });
            await firestoreStore.recordAIUsage(result.usage, a, "exam_autopilot");
            guide = {
              summary: result.output.summary,
              keyIdeas: result.output.findings.slice(0, 10),
              examPrompts: result.output.suggestions.slice(0, 10),
              warnings: [...warnings, ...result.output.warnings].slice(0, 12),
            };
            source = "ai";
          } finally {
            await platformStore.releaseAiBudgetReservation(gate.reservation);
          }
        }
        await recordProductEventSafe(a, "exam_material_ingested", { properties: { files: files.length, source, characters: materialText.length } });
        res.json({ success: true, source, materialText: materialText.slice(0, 24_000), guide });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/learn/explain",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const body = req.body || {};
        const topic = cleanField(body.topic, 600);
        if (!topic)
          return res.status(400).json({
            error: "Provide a topic to explain",
            code: "TOPIC_REQUIRED",
          });
        const language = cleanField(body.language, 40) || "English";
        const level = cleanField(body.level, 20) || "beginner";
        const context = cleanField(body.context, 600) || undefined;
        if (!aiConfigured({ complexity: "medium", risk: "low" })) {
          return res.json({
            success: true,
            lesson: nativeTutorScaffold(topic, language, level),
            source: "scaffold",
          });
        }
        // اتساق: نفس (الموضوع+اللغة+المستوى) داخل نفس المقرر/الجامعة => نفس الشرح.
        const scope = cacheScope("tenant", a.tenantId);
        const key = learnCacheKey("tutor", { topic, language, level });
        const cached = await firestoreStore.getLearnCache(scope, key);
        if (cached)
          return res.json({ success: true, lesson: cached, source: "cache" });
        const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
        let result;
        try {
          result = await getAIProvider({
            complexity: "medium",
            risk: "low",
          }).runAcademicTask(
            buildTutorRequest({ topic, language, level, context }),
          );
        } finally {
          await platformStore.releaseAiBudgetReservation(gate.reservation);
        }
        await firestoreStore.recordAIUsage(result.usage, a, "tutor");
        const lesson = toLesson(topic, language, level, result.output);
        await firestoreStore.setLearnCache(scope, key, lesson, {
          kind: "tutor",
          language,
          level,
        });
        await recordProductEventSafe(a, "tutor_explained", {
          properties: { language, level },
        });
        res.json({ success: true, lesson, source: "ai" });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/learn/solve",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const body = req.body || {};
        const problem = cleanField(body.problem, 4000);
        if (!problem)
          return res.status(400).json({
            error: "Provide a problem to solve",
            code: "PROBLEM_REQUIRED",
          });
        const language = cleanField(body.language, 40) || "English";
        const context = cleanField(body.context, 800) || undefined;
        const courseId = cleanField(body.courseId, 180);
        const assignmentId = cleanField(body.assignmentId, 180);
        // إن ربط الطالب المسألة بواجب منشور، نحمّل سياسته الرسمية لتقرير الوضع.
        let policyCtx = { linkedToAssignment: false } as Parameters<
          typeof decideSolveMode
        >[0];
        if (courseId && assignmentId) {
          const [assignment, enrollment, course] = await Promise.all([
            firestoreStore.getCourseAssignment(
              assignmentId,
              courseId,
              a.tenantId,
            ),
            firestoreStore.getCourseEnrollment(courseId, a.userId, a.tenantId),
            firestoreStore.getCourse(courseId, a.tenantId),
          ]);
          if (!assignment || assignment.status !== "published")
            return res.status(404).json({
              error: "Published course assignment not found",
              code: "PUBLISHED_ASSIGNMENT_NOT_FOUND",
            });
          if (!enrollment && !(course && canManageCourse(a, course)))
            return res.status(403).json({
              error: "Active course enrollment is required",
              code: "COURSE_ENROLLMENT_REQUIRED",
            });
          const pol = normalizeAcademicPolicy(assignment.aiPolicy, reqLocale(req));
          policyCtx = {
            linkedToAssignment: true,
            policyLevel: pol.level,
            policyProhibited: pol.prohibited,
            policyNeedsConfirmation: false,
          };
        }
        const decision = decideSolveMode(policyCtx);
        const variation = buildSolveVariation(a.userId, problem);
        if (!aiConfigured({ complexity: "high", risk: "medium" })) {
          return res.json({
            success: true,
            decision,
            result: nativeSolveScaffold(decision.mode, language),
            source: "scaffold",
          });
        }
        // اتساق للمسائل التدريبية فقط (غير مربوطة بواجب مُقيَّم) — نتجنّب تطابق حلول التسليمات.
        const cacheable =
          !policyCtx.linkedToAssignment && decision.mode === "worked";
        const solveScope = cacheScope("global", a.tenantId);
        const solveKey = learnCacheKey("solve", {
          problem,
          language,
          mode: decision.mode,
          variationId: variation.id,
        });
        if (cacheable) {
          const hit = await firestoreStore.getLearnCache(solveScope, solveKey);
          if (hit)
            return res.json({
              success: true,
              decision,
              result: hit,
              source: "cache",
            });
        }
        const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
        let result;
        try {
          result = await getAIProvider({
            complexity: "high",
            risk: "medium",
          }).runAcademicTask(
            buildSolveRequest({
              problem,
              language,
              mode: decision.mode,
              context,
              variation,
            }),
          );
        } finally {
          await platformStore.releaseAiBudgetReservation(gate.reservation);
        }
        await firestoreStore.recordAIUsage(result.usage, a, "solver");
        const solveResult = toSolveResult(decision.mode, language, result.output);
        if (cacheable)
          await firestoreStore.setLearnCache(solveScope, solveKey, solveResult, {
            kind: "solve",
            mode: decision.mode,
            language,
          });
        // إفصاح مسجَّل في السجل التدقيقي (شفافية للأستاذ عند الربط بواجب).
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "learn.solve",
          assignmentId || "practice",
          undefined,
          { mode: decision.mode, linked: policyCtx.linkedToAssignment, variationId: variation.id },
        );
        res.json({ success: true, decision, result: solveResult, source: "ai" });
      } catch (e) {
        next(e);
      }
    },
  );
}
