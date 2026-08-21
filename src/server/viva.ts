import { randomUUID } from "node:crypto";
import type {
  LearningEvidenceRecord,
  ProjectDNA,
  VivaMode,
  VivaSession,
} from "../types";

export function createVivaSession(
  project: ProjectDNA,
  mode: VivaMode,
): VivaSession {
  const questions: VivaSession["questions"] = [];
  const add = (prompt: string, focus: string, relatedRubricId?: string) =>
    questions.push({ id: randomUUID(), prompt, focus, relatedRubricId });
  add(
    `اشرح هدف مشروع “${project.title}” بكلماتك، وما المخرج الذي يفترض أن يثبت نجاحه؟`,
    "project_understanding",
  );
  const req =
    project.requirements.find((r) => r.confidence === "needs_confirmation") ||
    project.requirements[0];
  if (req)
    add(
      `المتطلب “${req.label}” يقول: ${req.value}. كيف فهمته، وما الذي ستفعله للتأكد من أنك طبقته بصورة صحيحة؟`,
      "requirements",
    );
  const rubric =
    project.rubric.find((r) => r.readiness !== "covered") || project.rubric[0];
  if (rubric)
    add(
      `كيف يثبت عملك تحقيق معيار الـRubric: “${rubric.title}”؟ اذكر دليلًا محددًا من مشروعك.`,
      "rubric_evidence",
      rubric.id,
    );
  if (project.requiredActions.length)
    add(
      `اختر خطوة من ${project.requiredActions.slice(0, 5).join(" / ")} واشرح لماذا استخدمتها وما البديل الذي كان ممكنًا.`,
      "method_decision",
    );
  if (project.riskFlags.length)
    add(
      `ما أكبر نقطة غير مؤكدة أو مخاطرة في المشروع حاليًا، وكيف ستمنعها من التأثير على التسليم؟`,
      "risk_awareness",
    );
  if (mode === "strict" || mode === "external")
    add(
      "ما أضعف جزء في مشروعك؟ لو طلبت منك الدفاع عنه الآن، ما الدليل الذي تملكه وما الدليل الذي ينقصك؟",
      "critical_defense",
    );
  if (mode === "external")
    add(
      "لو أعاد شخص مستقل تنفيذ هذا العمل اعتمادًا على توثيقك فقط، ما الذي قد لا يستطيع إعادة إنتاجه؟ ولماذا؟",
      "reproducibility",
    );
  if (mode === "easy" && questions.length > 4) questions.splice(4);
  return {
    id: randomUUID(),
    projectId: project.id,
    userId: project.userId,
    tenantId: project.tenantId,
    mode,
    questions,
    responses: [],
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function completeViva(session: VivaSession): {
  session: VivaSession;
  evidence: LearningEvidenceRecord;
} {
  const now = new Date().toISOString();
  const completed: VivaSession = {
    ...session,
    status: "completed",
    completedAt: now,
  };
  const answered = session.responses.filter((r) => r.answer.trim()).length;
  const evidence: LearningEvidenceRecord = {
    id: randomUUID(),
    projectId: session.projectId,
    userId: session.userId,
    tenantId: session.tenantId,
    source: "viva",
    summary: `أكمل الطالب جلسة Viva بنمط ${session.mode}. تم توثيق ${answered} إجابات من ${session.questions.length}. هذا سجل دليل تعلم وليس درجة أو كشفًا لنسبة AI.`,
    evidence: session.responses
      .filter((r) => r.answer.trim())
      .map((r) => ({
        label:
          session.questions.find((q) => q.id === r.questionId)?.focus ||
          "viva_response",
        value: r.answer.trim().slice(0, 1200),
      })),
    createdAt: now,
  };
  return { session: completed, evidence };
}
