// AcademicOS — Predictive Grade-Loss Map  (خريطة فقدان الدرجات التنبؤية 🩸)
// يقلب Grader Fairness من أداة أستاذ إلى تحذير طالب: أين خسر الفوج السابق درجاتٍ فعلًا،
// وكم، ولماذا — ثم يطابق ذلك مع جاهزية Rubric للطالب الحالي قبل التسليم.
//
// كل الأرقام من تسليمات مصححة حقيقية (rubricGrades) على نفس التكليف، بإخفاء هوية (k-anonymity).
// لا اختلاق: معيار بلا تصحيحات كافية يظهر «بيانات غير كافية» لا 0%.

import { isoNow, round, mean, meetsKAnonymity, K_ANONYMITY_MIN, normalize } from './_shared';
import { ADV, tA, tAf, type ServerLocale } from './i18n';
import type { CourseSubmissionRecord, RubricCriterion } from '../../types';

export interface GradeLossCriterion {
  rubricId: string;
  title: string;
  gradedCount: number;
  lossProbability: number;        // نسبة التسليمات التي خسرت أي نقطة في هذا المعيار
  averageLostPercent: number;     // متوسط النسبة المفقودة من نقاط المعيار
  severity: 'high' | 'medium' | 'low' | 'insufficient';
  commonReason?: string;          // أشيع كلمة مفتاحية في ملاحظات المصححين على الفاقد
  yourReadiness?: RubricCriterion['readiness'];
  personalRisk?: 'critical' | 'watch' | 'ok' | 'unknown';
}
export interface GradeLossMap {
  generatedAt: string;
  available: boolean;
  cohortSize: number;
  kAnonymityMin: number;
  criteria: GradeLossCriterion[];
  headline: string;
  topRisk?: { title: string; lossProbability: number; averageLostPercent: number };
  privacyNote: string;
}

// استخراج أشيع سبب من ملاحظات الفاقد: كلمات دلالية شائعة في التصحيح.
const REASON_HINTS: Array<{ key: RegExp; reason: typeof ADV.glReasonSources }> = [
  { key: /(مصدر|مراجع|استشهاد|citation|source|reference)/i, reason: ADV.glReasonSources },
  { key: /(تحليل|عمق|سطحي|analysis|shallow|depth)/i, reason: ADV.glReasonDepth },
  { key: /(بنية|تنظيم|ترتيب|structure|organization)/i, reason: ADV.glReasonStructure },
  { key: /(دليل|إثبات|evidence|proof)/i, reason: ADV.glReasonEvidence },
  { key: /(لغة|صياغة|أسلوب|grammar|clarity|wording)/i, reason: ADV.glReasonLanguage },
  { key: /(متطلب|ناقص|غير مكتمل|missing|incomplete|requirement)/i, reason: ADV.glReasonMissing },
];
function inferReason(feedbacks: string[], locale: ServerLocale): string | undefined {
  const joined = feedbacks.join(' \n ');
  for (const h of REASON_HINTS) if (h.key.test(joined)) return tA(h.reason, locale);
  return undefined;
}

export function buildGradeLossMap(
  submissions: CourseSubmissionRecord[],
  currentRubric: RubricCriterion[] = [],
  locale: ServerLocale = 'en',
): GradeLossMap {
  const graded = submissions.filter(s => (s.status === 'graded' || s.status === 'released') && (s.rubricGrades?.length || 0) > 0);
  const cohortSize = graded.length;
  const privacyNote = tAf(ADV.glPrivacy, locale, { k: K_ANONYMITY_MIN });

  if (!meetsKAnonymity(cohortSize)) {
    return { generatedAt: isoNow(), available: false, cohortSize, kAnonymityMin: K_ANONYMITY_MIN, criteria: [], headline: tA(ADV.glInsufficientCohort, locale), privacyNote };
  }

  const agg = new Map<string, { title: string; lossFlags: number[]; lostPcts: number[]; reasons: string[] }>();
  for (const s of graded) for (const g of s.rubricGrades) {
    const max = Number(g.maxPoints) || 0; if (max <= 0) continue;
    const awarded = Number(g.awardedPoints) || 0;
    const lost = Math.max(0, max - awarded);
    const x = agg.get(g.rubricId) || { title: g.title, lossFlags: [], lostPcts: [], reasons: [] };
    x.lossFlags.push(lost > 0 ? 1 : 0);
    x.lostPcts.push(lost / max);
    if (lost > 0 && g.feedback) x.reasons.push(g.feedback);
    agg.set(g.rubricId, x);
  }

  const readinessById = new Map(currentRubric.map(r => [r.id, r.readiness]));
  const criteria: GradeLossCriterion[] = [...agg.entries()].map(([rubricId, x]) => {
    const lossProbability = round(mean(x.lossFlags) * 100, 0);
    const averageLostPercent = round(mean(x.lostPcts) * 100, 0);
    const gradedCount = x.lossFlags.length;
    const severity: GradeLossCriterion['severity'] = gradedCount < K_ANONYMITY_MIN ? 'insufficient'
      : lossProbability >= 55 ? 'high' : lossProbability >= 30 ? 'medium' : 'low';
    const yourReadiness = readinessById.get(rubricId);
    const personalRisk: GradeLossCriterion['personalRisk'] = yourReadiness === undefined ? 'unknown'
      : (severity === 'high' && (yourReadiness === 'not_evidenced' || yourReadiness === 'needs_revision')) ? 'critical'
      : (severity !== 'low' && yourReadiness !== 'covered') ? 'watch' : 'ok';
    return { rubricId, title: x.title, gradedCount, lossProbability, averageLostPercent, severity, commonReason: inferReason(x.reasons, locale), yourReadiness, personalRisk };
  }).sort((a, b) => b.lossProbability - a.lossProbability);

  const top = criteria.find(c => c.severity !== 'insufficient');
  const headline = top
    ? tAf(ADV.glHeadline, locale, { prob: top.lossProbability, title: top.title, reason: top.commonReason ? tAf(ADV.glReasonSuffix, locale, { reason: top.commonReason }) : '' })
    : tA(ADV.glNoHighRisk, locale);

  return {
    generatedAt: isoNow(), available: true, cohortSize, kAnonymityMin: K_ANONYMITY_MIN,
    criteria, headline,
    topRisk: top ? { title: top.title, lossProbability: top.lossProbability, averageLostPercent: top.averageLostPercent } : undefined,
    privacyNote,
  };
}

// مطابقة الاسم عند غياب تطابق المعرّف (rubric مُعاد توليده بمعرّفات جديدة).
export function alignRubricByTitle(map: GradeLossMap, rubric: RubricCriterion[]): GradeLossMap {
  const byTitle = new Map(rubric.map(r => [normalize(r.title), r.readiness]));
  const criteria = map.criteria.map(c => {
    if (c.yourReadiness !== undefined) return c;
    const yourReadiness = byTitle.get(normalize(c.title));
    return yourReadiness ? { ...c, yourReadiness } : c;
  });
  return { ...map, criteria };
}
