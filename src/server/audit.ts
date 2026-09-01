import { randomUUID } from "node:crypto";
import { runDeepAIDetection } from "./deep-ai-detector";
import type {
  AuditCheck,
  ProjectDNA,
  ProjectEvidence,
  SubmissionAudit,
  WorkspaceArtifact,
} from "../types";

export interface SubmissionAuditContext {
  artifacts?: WorkspaceArtifact[];
  evidence?: ProjectEvidence[];
}
const check = (input: Omit<AuditCheck, "id">): AuditCheck => ({
  id: randomUUID(),
  ...Object.fromEntries(Object.entries(input).filter(([,value])=>value!==undefined)),
}) as AuditCheck;

export function runSubmissionAudit(
  project: ProjectDNA,
  context: SubmissionAuditContext = {},
): SubmissionAudit {
  const artifacts = (context.artifacts || []).filter((x) => !x.deletedAt),
    evidence = context.evidence || [],
    checks: AuditCheck[] = [];
  const linkedDeliverables = new Set([
    ...artifacts
      .filter((x) => x.status === "ready" && x.deliverableId)
      .map((x) => x.deliverableId!),
    ...evidence
      .map((x) => x.deliverableId)
      .filter((x): x is string => Boolean(x)),
  ]);
  const linkedRubric = new Set([
    ...artifacts
      .filter((x) => x.status === "ready")
      .flatMap((x) => x.rubricIds || []),
    ...evidence
      .filter((x) => x.verification !== "unverified")
      .flatMap((x) => x.rubricIds || []),
  ]);
  for (const deliverable of project.deliverables) {
    const marked =
        deliverable.status === "ready" || deliverable.status === "completed",
      linked =
        Boolean(deliverable.fileId) || linkedDeliverables.has(deliverable.id);
    checks.push(
      check({
        label: `المخرج: ${deliverable.title}`,
        status: !marked ? "critical" : linked ? "pass" : "warning",
        detail: !marked
          ? `${deliverable.title} غير جاهز. الصيغة المطلوبة: ${deliverable.format}.`
          : linked
            ? `جاهز ومرتبط بملف أو عنصر عمل محفوظ (${deliverable.format}).`
            : "وُضع كجاهز لكن لا يوجد ملف أو عنصر عمل مرتبط به؛ اربطه قبل التسليم.",
        relatedDeliverableId: deliverable.id,
        category: "deliverable",
        action: "افتح تبويب المخرجات ثم اربط عنصر Workspace أو ملفًا بالمخرج.",
      }),
    );
    if (deliverable.validationRules?.length)
      checks.push(
        check({
          label: `قواعد ${deliverable.title}`,
          status: marked ? "warning" : "critical",
          detail: `توجد ${deliverable.validationRules.length} قواعد تحقق يجب تأكيدها على الملف النهائي: ${deliverable.validationRules.slice(0, 3).join("، ")}.`,
          relatedDeliverableId: deliverable.id,
          category: "format",
          action: "افتح الملف النهائي وراجع قواعد الحجم والصيغة والتسمية.",
        }),
      );
  }
  const uncertain = project.requirements.filter(
    (r) => r.confidence === "needs_confirmation",
  );
  checks.push(
    check({
      label: "اكتمال المتطلبات",
      status: uncertain.length ? "warning" : "pass",
      detail: uncertain.length
        ? `${uncertain.length} متطلبات ما زالت غير مؤكدة: ${uncertain
            .slice(0, 4)
            .map((r) => r.label)
            .join("، ")}.`
        : "كل المتطلبات المسجلة ذات ثقة محددة.",
      category: "requirement",
      action: uncertain.length
        ? "قارنها بالتكليف المنشور أو اطلب تأكيد الأستاذ."
        : undefined,
    }),
  );
  if (project.rubric.length) {
    const covered = project.rubric.filter(
        (r) => r.readiness === "covered" && linkedRubric.has(r.id),
      ),
      selfMarked = project.rubric.filter(
        (r) => r.readiness === "covered" && !linkedRubric.has(r.id),
      );
    checks.push(
      check({
        label: "تغطية Rubric بالأدلة",
        status:
          covered.length === project.rubric.length
            ? "pass"
            : covered.length
              ? "warning"
              : "critical",
        detail: `${covered.length}/${project.rubric.length} معايير مغطاة بدليل مرتبط${selfMarked.length ? `؛ ${selfMarked.length} موسومة كمغطاة دون رابط دليل` : ""}.`,
        category: "rubric",
        action:
          covered.length < project.rubric.length
            ? "اربط Evidence أو عنصر Workspace جاهزًا بكل معيار."
            : undefined,
      }),
    );
  } else
    checks.push(
      check({
        label: "Rubric",
        status: "warning",
        detail: "لم يُستخرج Rubric. قد يكون في ملف منفصل؛ تأكد قبل التسليم.",
        category: "rubric",
        action: "أضف ملف Rubric أو اربط المشروع بالتكليف المنشور.",
      }),
    );
  const minSources = Math.max(
      0,
      ...(project.sourceRequirements || []).map((x) =>
        Number(x.minimumCount || 0),
      ),
    ),
    verifiedSources = evidence.filter(
      (x) => x.type === "source" && x.verification !== "unverified",
    );
  if (minSources || project.sourceRequirements?.length)
    checks.push(
      check({
        label: "المصادر والاستشهادات",
        status:
          verifiedSources.length >= minSources
            ? "pass"
            : verifiedSources.length
              ? "warning"
              : "critical",
        detail: `المطلوب ${minSources || "عدد غير محدد"}؛ المصادر المتحققة المرتبطة ${verifiedSources.length}.`,
        category: "evidence",
        action:
          verifiedSources.length < minSources
            ? "أضف المصادر إلى Evidence Studio واربطها بالمخرجات أو Rubric."
            : undefined,
      }),
    );
  checks.push(
    check({
      label: "سياسة استخدام AI",
      status: project.aiPolicy.needsConfirmation ? "warning" : "pass",
      detail: project.aiPolicy.needsConfirmation
        ? "السياسة غير مؤكدة من تكليف منشور؛ لا يمكن اعتبار الاستخدام متوافقًا نهائيًا."
        : project.aiPolicy.summary,
      category: "policy",
      action: project.aiPolicy.needsConfirmation
        ? "اربط المشروع بتكليف CourseOS منشور."
        : undefined,
    }),
  );
  if (project.aiPolicy.disclosureRequired) {
    const disclosure =
      /\b(ai|artificial intelligence|ذكاء اصطناعي|إفصاح|disclosure)\b/i.test(
        artifacts.map((x) => x.content).join("\n"),
      );
    checks.push(
      check({
        label: "إقرار استخدام AI",
        status: disclosure ? "pass" : "warning",
        detail: disclosure
          ? "ظهر إقرار أو ذكر لاستخدام AI في عناصر العمل. راجع الصياغة النهائية."
          : "السياسة تتطلب إفصاحًا ولم يظهر إقرار في عناصر العمل الحالية.",
        category: "policy",
        action: disclosure
          ? undefined
          : "أضف إقرار الاستخدام المطلوب إلى المخرج النهائي.",
      }),
    );
  }
  const allContent = artifacts.map((x) => x.content || "").join("\n\n");
  if (allContent.length > 80) {
    const aiForensic = runDeepAIDetection(allContent);
    const isAiRisky = aiForensic.overallAIScore >= 65;
    const isAiModerate = aiForensic.overallAIScore >= 35;
    checks.push(
      check({
        label: "رادار فحص النزاهة الجنائية (Turnitin & AI Detection Radar)",
        status: isAiRisky ? "critical" : isAiModerate ? "warning" : "pass",
        detail: `احتمالية الذكاء الاصطناعي الجنائية: ${aiForensic.overallAIScore}% (${aiForensic.verdictLabel}). الحيرة (Perplexity): ${aiForensic.metrics.perplexityScore}/100، النبضية (Burstiness): ${aiForensic.metrics.burstinessScore}/100.`,
        category: "integrity",
        action: isAiRisky
          ? "افتح نافذة 'رادار كشف AI' وطبق بروتوكول إضفاء الطابع البشري وتوثيق المراجع الحية."
          : isAiModerate
            ? "راجع الكليشيهات المرصودة ونوّع في أطوال الجمل لضمان خلو النص من أي اشتباه."
            : undefined,
      }),
    );
  }
  if (project.deadlines.final) {
    const time = new Date(project.deadlines.final).getTime();
    checks.push(
      check({
        label: "الموعد النهائي",
        status: Number.isFinite(time)
          ? Date.now() > time
            ? "warning"
            : "pass"
          : "warning",
        detail: Number.isFinite(time)
          ? `${Date.now() > time ? "الموعد تجاوز الوقت المسجل" : "الموعد المسجل"}: ${project.deadlines.final}`
          : "صيغة الموعد تحتاج مراجعة.",
        category: "deadline",
        action:
          Number.isFinite(time) && Date.now() > time
            ? "تحقق من سياسة التسليم المتأخر قبل الإرسال."
            : undefined,
      }),
    );
  }
  const hashed =
    project.originalAssignment?.attachments?.filter((x) => x.sha256).length ||
    0;
  checks.push(
    check({
      label: "سلامة المصدر",
      status: hashed ? "pass" : "not_applicable",
      detail: hashed
        ? `${hashed} ملفات أصلية لها بصمة SHA-256 محفوظة.`
        : "لا يوجد ملف أصلي محفوظ ببصمة للتحقق.",
      category: "integrity",
    }),
  );
  checks.push(
    check({
      label: "قابلية الوصول للملف النهائي",
      status: "warning",
      detail:
        "لا يمكن إثبات العناوين البديلة وترتيب القراءة والتباين من حالة المشروع وحدها. يلزم فحص الملف النهائي.",
      category: "accessibility",
      action: "شغّل فحص الوصول على PDF/PPTX النهائي قبل التسليم.",
    }),
  );
  const applicable = checks.filter((x) => x.status !== "not_applicable"),
    blockingIssues = checks.filter((x) => x.status === "critical").length,
    warnings = checks.filter((x) => x.status === "warning").length,
    score = Math.round(
      (applicable.reduce(
        (sum, x) =>
          sum + (x.status === "pass" ? 1 : x.status === "warning" ? 0.5 : 0),
        0,
      ) /
        Math.max(1, applicable.length)) *
        100,
    ),
    evidenceCoverage = project.rubric.length
      ? Math.round(
          (project.rubric.filter((x) => linkedRubric.has(x.id)).length /
            project.rubric.length) *
            100,
        )
      : 0;
  const status: SubmissionAudit["status"] = blockingIssues
    ? "critical_issues"
    : warnings >= 3
      ? "needs_attention"
      : warnings
        ? "mostly_ready"
        : "ready";
  return {
    id: randomUUID(),
    projectId: project.id,
    status,
    checks,
    score,
    blockingIssues,
    warnings,
    evidenceCoverage,
    createdAt: new Date().toISOString(),
  };
}
