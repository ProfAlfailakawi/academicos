// Rubric → workspace drill-down.
//
// For every rubric criterion: which workspace items, evidence and tasks back
// it, what is still missing, and (optionally) how much the cohort historically
// lost on it. A gap can be turned into a concrete "what's missing" task that
// is placed at the front of the plan so it becomes the project's Next Best
// Action (project.nextAction / Mission Control).
//
// Pure functions: no I/O.

import type { ProjectDNA, ProjectEvidence, ProjectTask, RubricCriterion, WorkspaceArtifact } from "../types";
import { L, tx, txf, type LocalizedText, type ServerLocale } from "./server-locale";

export type RubricGapCode =
  | "no_workspace_item"
  | "no_evidence"
  | "not_marked_covered"
  | "needs_revision"
  | "draft_only"
  | "cohort_loss_high";

export interface RubricDrilldownCriterion {
  rubricId: string;
  title: string;
  weighting: number;
  readiness: NonNullable<RubricCriterion["readiness"]>;
  artifacts: Array<{ id: string; title: string; module: string; status: WorkspaceArtifact["status"]; updatedAt: string }>;
  evidence: Array<{ id: string; title: string; type: ProjectEvidence["type"]; verification: ProjectEvidence["verification"] }>;
  gapTaskId: string;
  gapTaskStatus?: ProjectTask["status"];
  missing: RubricGapCode[];
  /** Weight at risk: weighting scaled by how much is missing (0-100 points of the criterion weight). */
  weightAtRisk: number;
  cohortLossProbability?: number;
}

export interface RubricDrilldown {
  projectId: string;
  criteria: RubricDrilldownCriterion[];
  totalWeightAtRisk: number;
}

export interface CohortLossInput {
  rubricId: string;
  title?: string;
  lossProbability: number;
  severity?: string;
}

const norm = (value: string) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export function gapTaskIdFor(rubricId: string) {
  return `rubric_gap_${String(rubricId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80)}`;
}

export function buildRubricDrilldown(
  project: Pick<ProjectDNA, "id" | "rubric" | "tasks">,
  artifacts: WorkspaceArtifact[],
  evidence: ProjectEvidence[],
  cohort: CohortLossInput[] = [],
): RubricDrilldown {
  const liveArtifacts = artifacts.filter((item) => !item.deletedAt);
  const cohortById = new Map(cohort.map((c) => [c.rubricId, c]));
  const cohortByTitle = new Map(cohort.filter((c) => c.title).map((c) => [norm(c.title!), c]));
  const criteria = (project.rubric || []).map((criterion): RubricDrilldownCriterion => {
    const linkedArtifacts = liveArtifacts.filter((item) => item.rubricIds?.includes(criterion.id));
    const linkedEvidence = evidence.filter(
      (item) => item.rubricIds?.includes(criterion.id) || criterion.evidenceIds?.includes(item.id),
    );
    const readiness = criterion.readiness || "not_evidenced";
    const loss = cohortById.get(criterion.id) || cohortByTitle.get(norm(criterion.title));
    const missing: RubricGapCode[] = [];
    if (!linkedArtifacts.length) missing.push("no_workspace_item");
    else if (linkedArtifacts.every((item) => item.status === "draft")) missing.push("draft_only");
    if (!linkedEvidence.length) missing.push("no_evidence");
    if (readiness === "needs_revision") missing.push("needs_revision");
    else if (readiness !== "covered") missing.push("not_marked_covered");
    if (loss && loss.lossProbability >= 55 && readiness !== "covered") missing.push("cohort_loss_high");
    const gapTaskId = gapTaskIdFor(criterion.id);
    const gapTask = (project.tasks || []).find((task) => task.id === gapTaskId);
    const structural = missing.filter((code) => code !== "cohort_loss_high").length;
    const weight = Number(criterion.weighting) || 0;
    const weightAtRisk = readiness === "covered" && !structural ? 0 : Math.round(weight * Math.min(1, structural / 3) * 10) / 10;
    return {
      rubricId: criterion.id,
      title: criterion.title,
      weighting: weight,
      readiness,
      artifacts: linkedArtifacts.map((item) => ({ id: item.id, title: item.title, module: item.module, status: item.status, updatedAt: item.updatedAt })),
      evidence: linkedEvidence.map((item) => ({ id: item.id, title: item.title, type: item.type, verification: item.verification })),
      gapTaskId,
      ...(gapTask ? { gapTaskStatus: gapTask.status } : {}),
      missing,
      weightAtRisk,
      ...(loss ? { cohortLossProbability: loss.lossProbability } : {}),
    };
  });
  criteria.sort((a, b) => b.weightAtRisk - a.weightAtRisk || (b.cohortLossProbability || 0) - (a.cohortLossProbability || 0));
  return {
    projectId: project.id,
    criteria,
    totalWeightAtRisk: Math.round(criteria.reduce((sum, c) => sum + c.weightAtRisk, 0) * 10) / 10,
  };
}

const GAP_TEXT: Record<RubricGapCode, LocalizedText> = {
  no_workspace_item: L("اربط قسماً أو عنصر عمل بهذا المعيار", "Link a section or workspace item to this criterion", "Bu ölçüte bir bölüm veya çalışma öğesi bağlayın", "为该评分标准关联一个章节或工作项", "इस मानदंड से कोई अनुभाग या कार्य आइटम जोड़ें", "Vincula una sección o elemento de trabajo a este criterio", "Reliez une section ou un élément de travail à ce critère", "اس معیار سے کوئی حصہ یا ورک آئٹم منسلک کریں"),
  draft_only: L("طوّر المسودة المرتبطة إلى نسخة جاهزة", "Develop the linked draft into a ready version", "Bağlı taslağı hazır bir sürüme geliştirin", "把关联的草稿完善为可提交版本", "जुड़े ड्राफ्ट को तैयार संस्करण तक विकसित करें", "Convierte el borrador vinculado en una versión lista", "Faites évoluer le brouillon lié vers une version prête", "منسلک مسودے کو تیار ورژن تک مکمل کریں"),
  no_evidence: L("أضف دليلاً (مصدراً أو حساباً أو قراراً) يثبت هذا المعيار", "Add evidence (a source, calculation or decision) that supports this criterion", "Bu ölçütü destekleyen bir kanıt (kaynak, hesap veya karar) ekleyin", "添加支持该标准的证据（来源、计算或决策）", "इस मानदंड का समर्थन करने वाला प्रमाण (स्रोत, गणना या निर्णय) जोड़ें", "Añade evidencia (fuente, cálculo o decisión) que respalde este criterio", "Ajoutez une preuve (source, calcul ou décision) qui étaye ce critère", "اس معیار کی تائید کرنے والا ثبوت (ماخذ، حساب یا فیصلہ) شامل کریں"),
  not_marked_covered: L("راجع المعيار وحدّث جاهزيته عندما يكتمل", "Review the criterion and update its readiness once complete", "Ölçütü gözden geçirin ve tamamlanınca hazırlığını güncelleyin", "复核该标准，完成后更新其就绪状态", "मानदंड की समीक्षा करें और पूरा होने पर तैयारी अपडेट करें", "Revisa el criterio y actualiza su preparación al completarlo", "Relisez le critère et mettez à jour sa préparation une fois terminé", "معیار کا جائزہ لیں اور مکمل ہونے پر تیاری اپ ڈیٹ کریں"),
  needs_revision: L("عالج ملاحظات المراجعة على هذا المعيار", "Address the revision notes on this criterion", "Bu ölçütteki revizyon notlarını ele alın", "处理该标准的修改意见", "इस मानदंड पर संशोधन टिप्पणियों को संबोधित करें", "Atiende las notas de revisión de este criterio", "Traitez les remarques de révision sur ce critère", "اس معیار پر نظرثانی کے نکات حل کریں"),
  cohort_loss_high: L("الدفعات السابقة خسرت درجات هنا كثيراً — تحقّق منه مبكراً", "Past cohorts often lost marks here — check it early", "Önceki gruplar burada sık puan kaybetti — erkenden kontrol edin", "往届学生常在此失分——请尽早检查", "पिछले बैचों ने यहाँ अक्सर अंक खोए — जल्दी जाँचें", "Cohortes anteriores perdieron puntos aquí a menudo: revísalo pronto", "Les promotions précédentes ont souvent perdu des points ici — vérifiez tôt", "پچھلے بیچ یہاں اکثر نمبر کھوتے رہے — جلد جانچیں"),
};

const TASK_TITLE = L("أكمل ما ينقص معيار «{title}»", "Close the gap on “{title}”", "“{title}” ölçütündeki eksiği tamamlayın", "补齐“{title}”的缺口", "“{title}” की कमी पूरी करें", "Cierra la brecha en “{title}”", "Comblez le manque sur « {title} »", "“{title}” کی کمی پوری کریں");

export function gapText(code: RubricGapCode, locale: ServerLocale) {
  return tx(GAP_TEXT[code], locale);
}

/** Build (or refresh) the "what's missing" task for a criterion. */
export function buildGapTask(
  criterion: RubricDrilldownCriterion,
  locale: ServerLocale,
  existing?: ProjectTask,
): ProjectTask {
  const steps = criterion.missing.length ? criterion.missing : (["not_marked_covered"] as RubricGapCode[]);
  return {
    ...(existing || {}),
    id: criterion.gapTaskId,
    title: txf(TASK_TITLE, locale, { title: criterion.title }).slice(0, 240),
    description: steps.map((code) => `• ${gapText(code, locale)}`).join("\n"),
    status: existing && existing.status !== "completed" ? existing.status : "ready",
    estimatedMinutes: Math.min(120, 20 + steps.length * 20),
    module: existing?.module,
  };
}

/**
 * Insert/refresh the gap task at the front of the plan so recalculateProject()
 * makes it the project's Next Best Action.
 */
export function applyGapTask(project: ProjectDNA, task: ProjectTask): ProjectDNA {
  const others = project.tasks.filter((item) => item.id !== task.id);
  return { ...project, tasks: [task, ...others] };
}
