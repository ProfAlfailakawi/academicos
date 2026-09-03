// AcademicOS — Reverse Assessment / "Make the Exam"  (اصنع الامتحان 🔄)
// أقوى إثبات فهم بحثيًا: أن يصمّم الطالب امتحانًا جيدًا عن مشروعه، لا أن يجيب عليه.
// المُقيّم الحتمي يعطي «درجة صانع الامتحان» من إشارات نقية (عمق بلوم، التغطية، التمييز، الأصالة)،
// وينتج مُدخلًا صالحًا لـ Proof of Learning داخل Evidence Capsule — نوع دليل جديد كليًا.
//
// النموذج (AI) اختياري لإثراء التغذية الراجعة؛ الدرجة الأساسية حتمية ومختبَرة.

import { isoNow, round, clamp, bloomLevel, tokenize, jaccard, unique } from './_shared';
import type { ProjectDNA } from '../../types';

export interface StudentExamQuestion {
  id: string;
  prompt: string;
  modelAnswer?: string;          // إجابة نموذجية يكتبها الطالب (تثبت أنه يعرف الجواب)
  targetOutcome?: string;        // مخرج التعلم/المعيار الذي يقيسه السؤال
}
export interface ReverseAssessmentInput {
  projectId: string;
  dna: Pick<ProjectDNA, 'title' | 'learningOutcomes' | 'requiredSkills' | 'deliverables' | 'rubric'>;
  questions: StudentExamQuestion[];
}
export interface QuestionSignal {
  id: string;
  bloomLevel: number;
  bloomLabel: string;
  wordCount: number;
  hasModelAnswer: boolean;
  linkedOutcome: boolean;
  qualityBand: 'strong' | 'fair' | 'weak';
  notes: string[];
}
export interface ReverseAssessmentResult {
  generatedAt: string;
  projectId: string;
  makerScore: number;            // 0..100
  band: 'mastery' | 'developing' | 'surface';
  dimensions: {
    depth: number;               // متوسط مستوى بلوم مطبّع
    coverage: number;            // نسبة مخرجات/معايير المشروع التي يمسّها الامتحان
    discrimination: number;      // تنوّع الأسئلة (تجنّب التكرار)
    rigor: number;               // اكتمال (إجابات نموذجية + طول كافٍ)
  };
  questions: QuestionSignal[];
  coverageGaps: string[];        // مخرجات لم يقسها أي سؤال
  proofOfLearning: {
    kind: 'reverse_assessment';
    title: string;
    makerScore: number;
    band: string;
    summary: string;
  };
  note: string;
}

const MIN_QUESTION_WORDS = 6;

export function evaluateReverseAssessment(input: ReverseAssessmentInput): ReverseAssessmentResult {
  const outcomes = unique([...(input.dna.learningOutcomes || []), ...(input.dna.rubric || []).map(r => r.title)]).filter(Boolean);
  const outcomeTokens = outcomes.map(o => ({ o, t: tokenize(o) }));

  const signals: QuestionSignal[] = input.questions.map(q => {
    const bl = bloomLevel(q.prompt);
    const words = tokenize(q.prompt).length;
    const qTokens = tokenize(`${q.prompt} ${q.modelAnswer || ''}`);
    // يرتبط بمخرج إذا أعلن targetOutcome أو تجاوز تشابهه مع أحد المخرجات عتبة.
    const linkedOutcome = Boolean(q.targetOutcome) || outcomeTokens.some(x => jaccard(qTokens, x.t) >= 0.18);
    const notes: string[] = [];
    if (words < MIN_QUESTION_WORDS) notes.push('سؤال قصير جدًا — وسّعه ليقيس فهمًا حقيقيًا.');
    if (!q.modelAnswer) notes.push('بلا إجابة نموذجية — أضفها لتثبت أنك تعرف الجواب.');
    if (bl.level <= 2) notes.push('مستوى إدراكي منخفض (تذكّر/فهم) — ارفعه إلى تحليل/تقويم/إبداع.');
    if (!linkedOutcome) notes.push('لا يبدو مرتبطًا بمخرج تعلم للمشروع.');
    const qualityBand: QuestionSignal['qualityBand'] = bl.level >= 4 && q.modelAnswer && words >= MIN_QUESTION_WORDS && linkedOutcome ? 'strong'
      : bl.level >= 3 && words >= MIN_QUESTION_WORDS ? 'fair' : 'weak';
    return { id: q.id, bloomLevel: bl.level, bloomLabel: bl.label, wordCount: words, hasModelAnswer: Boolean(q.modelAnswer), linkedOutcome, qualityBand, notes };
  });

  const n = signals.length || 1;
  const depth = clamp(signals.reduce((s, q) => s + q.bloomLevel, 0) / n / 6, 0, 1);
  const coveredOutcomes = new Set<string>();
  for (const q of input.questions) {
    const qTokens = tokenize(`${q.prompt} ${q.modelAnswer || ''}`);
    for (const x of outcomeTokens) if ((q.targetOutcome && q.targetOutcome === x.o) || jaccard(qTokens, x.t) >= 0.18) coveredOutcomes.add(x.o);
  }
  const coverage = outcomes.length ? clamp(coveredOutcomes.size / outcomes.length, 0, 1) : 0;
  // التمييز: 1 - متوسط تشابه أزواج الأسئلة (أسئلة متكررة => تمييز منخفض).
  let pairs = 0, sim = 0;
  const qtoks = input.questions.map(q => tokenize(q.prompt));
  for (let i = 0; i < qtoks.length; i++) for (let j = i + 1; j < qtoks.length; j++) { pairs++; sim += jaccard(qtoks[i], qtoks[j]); }
  const discrimination = pairs ? clamp(1 - sim / pairs, 0, 1) : (signals.length ? 1 : 0);
  const rigor = clamp(signals.filter(q => q.hasModelAnswer && q.wordCount >= MIN_QUESTION_WORDS).length / n, 0, 1);

  // ترجيح: العمق والتغطية أهم إشارتي إتقان.
  const makerScore = Math.round((depth * 0.34 + coverage * 0.30 + discrimination * 0.18 + rigor * 0.18) * 100 * (signals.length >= 3 ? 1 : signals.length / 3));
  const band: ReverseAssessmentResult['band'] = makerScore >= 75 ? 'mastery' : makerScore >= 50 ? 'developing' : 'surface';
  const coverageGaps = outcomes.filter(o => !coveredOutcomes.has(o));

  return {
    generatedAt: isoNow(), projectId: input.projectId, makerScore, band,
    dimensions: { depth: round(depth * 100, 0), coverage: round(coverage * 100, 0), discrimination: round(discrimination * 100, 0), rigor: round(rigor * 100, 0) },
    questions: signals, coverageGaps,
    proofOfLearning: {
      kind: 'reverse_assessment', title: `صياغة امتحان عن: ${input.dna.title}`, makerScore, band,
      summary: `صمّم الطالب ${signals.length} سؤالًا بمتوسط مستوى بلوم ${round(signals.reduce((s, q) => s + q.bloomLevel, 0) / n, 1)}/6 وتغطية ${round(coverage * 100, 0)}% لمخرجات المشروع. القدرة على توليد أسئلة عالية المستوى دليل إتقان مستقل عن الإجابة.`,
    },
    note: 'درجة صانع الامتحان مؤشر إتقان تكويني حتمي مشتق من بنية أسئلة الطالب فقط؛ لا تستبدل تقويم الأستاذ ولا تُعدّل درجة رسمية، لكنها تدخل Proof of Learning كدليل عملية أصيل.',
  };
}

// سقالة صادقة لتوجيه الطالب عند بدء المهمة (بلا نموذج).
export function buildExamBrief(dna: ReverseAssessmentInput['dna']): { instruction: string; targets: string[] } {
  const targets = unique([...(dna.learningOutcomes || []), ...(dna.rubric || []).map(r => r.title)]).filter(Boolean).slice(0, 8);
  return {
    instruction: 'صمّم امتحانًا قصيرًا (4–6 أسئلة) يقيس فهم مشروعك. لكل سؤال: صِغه بفعل تحليل/تقويم/تصميم، اربطه بمخرج تعلم، واكتب إجابة نموذجية موجزة. الأسئلة السطحية (اذكر/عرّف) تخفض درجتك.',
    targets,
  };
}
