// AcademicOS — Ghost Cohort  (الفوج الشبح 👻)
// يحوّل تاريخ نُسخ المشاريع (ProjectVersionRecord + النشاط) لأفواج سابقة إلى «إيقاع عملية»
// مجهول الهوية تمامًا يُقارن به الطالب الحالي — لا محتوى، بل توزيع زمني للمنهجية والمراجعة.
//
// المبادئ:
//  • خصوصية أولًا: k-anonymity صارم (≥5 متفوقين)، ولا يُعاد أي نص/هوية/درجة فردية.
//  • حتمية بحتة: كل الأزمنة تُطبّع إلى نسبة تقدّم 0..1 من بداية العمل إلى الموعد؛ لا Date.now داخل الحساب.
//  • «متفوق» = درجة ≥ عتبة (افتراضي 0.85) على نفس التكليف.

import { isoNow, round, clamp, percentile, meetsKAnonymity, K_ANONYMITY_MIN } from './_shared';

export interface GhostMemberInput {
  submissionId: string;
  gradeRatio: number;            // 0..1 (درجة/العظمى) — يُستخدم للفرز فقط، لا يُعاد فرديًا
  startedAt: number;             // ms — أول نشاط/نسخة
  submittedAt: number;           // ms — لحظة التسليم
  // نقاط تحوّل العملية بترتيبها الزمني (من ملخّصات النُسخ/النشاط): كل نقطة نوعها ووقتها.
  milestones: Array<{ phase: GhostPhase; at: number }>;
  revisionCount: number;         // عدد النُسخ الكلي
  sourceReviewCount: number;     // مرات مراجعة/تحقّق المصادر
}
export type GhostPhase = 'intake' | 'research' | 'outline' | 'draft' | 'revision' | 'evidence' | 'finalize';

export interface GhostPhaseBand {
  phase: GhostPhase;
  label: string;
  // نسبة التقدّم الزمني (0..1) التي أنجز عندها المتفوقون هذه المرحلة عادةً — p25..p75 نطاق «السليم».
  typicalAtP25: number;
  typicalAtP50: number;
  typicalAtP75: number;
  reachedByPercent: number;      // نسبة المتفوقين الذين مرّوا بهذه المرحلة
}
export interface GhostCohortResult {
  generatedAt: string;
  available: boolean;            // false إذا لم تتحقق k-anonymity
  cohortSize: number;
  kAnonymityMin: number;
  gradeThreshold: number;
  phases: GhostPhaseBand[];
  benchmarks: {
    medianRevisions: number;
    medianSourceReviews: number;
    medianActiveDays: number;
  };
  live?: GhostLiveComparison;    // مقارنة الطالب الحالي (إن مُرّرت حالته)
  privacyNote: string;
}
export interface GhostLiveComparison {
  progress: number;              // نسبة تقدّم الطالب الحالي زمنيًا 0..1
  currentPhase: GhostPhase;
  pace: 'ahead' | 'on_track' | 'behind';
  nextPhase?: { phase: GhostPhase; label: string; typicalBy: number; status: 'upcoming' | 'due_now' | 'overdue' };
  nudges: string[];
}

const PHASE_ORDER: GhostPhase[] = ['intake', 'research', 'outline', 'draft', 'revision', 'evidence', 'finalize'];
const PHASE_LABEL: Record<GhostPhase, string> = {
  intake: 'استيعاب التكليف', research: 'البحث وجمع المصادر', outline: 'الهيكلة والمخطط',
  draft: 'المسودة الأولى', revision: 'المراجعة والتحسين', evidence: 'توثيق الأدلة', finalize: 'الإنهاء والتسليم',
};

function progressOf(at: number, start: number, end: number): number {
  if (end <= start) return 1;
  return clamp((at - start) / (end - start), 0, 1);
}

export function buildGhostCohort(
  members: GhostMemberInput[],
  opts: { gradeThreshold?: number; now?: number; live?: { startedAt: number; deadline: number; now: number; milestones: Array<{ phase: GhostPhase; at: number }>; revisionCount?: number } } = {},
): GhostCohortResult {
  const gradeThreshold = opts.gradeThreshold ?? 0.85;
  const now = opts.now ?? Date.now();
  const top = members.filter(m => m.gradeRatio >= gradeThreshold && m.submittedAt > m.startedAt);
  const cohortSize = top.length;
  const privacyNote = `كل الأرقام مشتقة من ≥${K_ANONYMITY_MIN} متفوقين ومجهولة الهوية تمامًا (توزيعات زمنية مطبّعة فقط، بلا نصوص أو درجات أو هويات فردية). المصدر: أزمنة نُسخ المشاريع لأفواج سابقة على نفس التكليف.`;

  if (!meetsKAnonymity(cohortSize)) {
    return { generatedAt: isoNow(now), available: false, cohortSize, kAnonymityMin: K_ANONYMITY_MIN, gradeThreshold, phases: [], benchmarks: { medianRevisions: 0, medianSourceReviews: 0, medianActiveDays: 0 }, privacyNote };
  }

  // لكل مرحلة: جمّع نِسب التقدّم الزمني لمن مرّ بها.
  const phases: GhostPhaseBand[] = PHASE_ORDER.map(phase => {
    const ratios: number[] = [];
    for (const m of top) {
      const hit = m.milestones.filter(x => x.phase === phase).map(x => x.at).sort((a, b) => a - b)[0];
      if (hit !== undefined) ratios.push(progressOf(hit, m.startedAt, m.submittedAt));
    }
    ratios.sort((a, b) => a - b);
    return {
      phase, label: PHASE_LABEL[phase],
      typicalAtP25: ratios.length ? round(percentile(ratios, 0.25) * 100, 0) : 0,
      typicalAtP50: ratios.length ? round(percentile(ratios, 0.50) * 100, 0) : 0,
      typicalAtP75: ratios.length ? round(percentile(ratios, 0.75) * 100, 0) : 0,
      reachedByPercent: round((ratios.length / cohortSize) * 100, 0),
    };
  }).filter(b => b.reachedByPercent > 0);

  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? round(percentile(s, 0.5), 0) : 0; };
  const benchmarks = {
    medianRevisions: median(top.map(m => m.revisionCount)),
    medianSourceReviews: median(top.map(m => m.sourceReviewCount)),
    medianActiveDays: median(top.map(m => Math.max(1, Math.round((m.submittedAt - m.startedAt) / 86400000)))),
  };

  let live: GhostLiveComparison | undefined;
  if (opts.live) {
    const p = progressOf(opts.live.now, opts.live.startedAt, opts.live.deadline);
    const reached = new Set(opts.live.milestones.map(x => x.phase));
    const currentPhase = [...PHASE_ORDER].reverse().find(ph => reached.has(ph)) ?? 'intake';
    // المرحلة المتوقعة الآن = آخر مرحلة median-typical لها ≤ تقدّم الطالب.
    const expectedIdx = phases.filter(b => b.typicalAtP50 / 100 <= p).length;
    const doneIdx = PHASE_ORDER.indexOf(currentPhase) + 1;
    const pace: GhostLiveComparison['pace'] = doneIdx >= expectedIdx + 1 ? 'ahead' : doneIdx >= expectedIdx ? 'on_track' : 'behind';
    const upcoming = phases.find(b => !reached.has(b.phase));
    const nextPhase = upcoming ? {
      phase: upcoming.phase, label: upcoming.label, typicalBy: upcoming.typicalAtP50,
      status: (p * 100 > upcoming.typicalAtP75 ? 'overdue' : p * 100 >= upcoming.typicalAtP50 ? 'due_now' : 'upcoming') as 'upcoming' | 'due_now' | 'overdue',
    } : undefined;
    const nudges: string[] = [];
    if (pace === 'behind') nudges.push('المتفوقون في هذه المرحلة الزمنية كانوا قد تجاوزوا المسودة الأولى — ركّز على إنجاز هيكل كامل الآن ولو خشِنًا.');
    if (opts.live.revisionCount !== undefined && opts.live.revisionCount < benchmarks.medianRevisions - 1) nudges.push(`المتفوقون راجعوا عملهم ~${benchmarks.medianRevisions} مرة؛ أنت أقل من ذلك حتى الآن. المراجعة المتكررة أقوى مؤشر على درجة عالية.`);
    if (nextPhase?.status === 'overdue') nudges.push(`مرحلة «${nextPhase.label}» تأخّرت مقارنة بإيقاع الفوج — ابدأها قبل أن تتراكم.`);
    if (pace === 'ahead') nudges.push('إيقاعك أسرع من متوسط المتفوقين — استثمر الوقت الفائض في جودة الأدلة والمراجعة لا في التسليم المبكر.');
    live = { progress: round(p * 100, 0), currentPhase, pace, nextPhase, nudges };
  }

  return { generatedAt: isoNow(now), available: true, cohortSize, kAnonymityMin: K_ANONYMITY_MIN, gradeThreshold, phases, benchmarks, live, privacyNote };
}
