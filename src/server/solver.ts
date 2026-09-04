// AcademicOS Solver — محرّك حلّ يحترم النزاهة الأكاديمية وسياسة المقرر.
//
// يحلّ للطلبة فعلًا — لكن بمسؤولية:
//  - مسألة تدريب/مذاكرة (غير مربوطة بواجب مُقيَّم): حلّ كامل خطوة بخطوة (أداة تعلّم).
//  - واجب مربوط بمقرر يسمح بالذكاء الاصطناعي (level عالٍ وغير محظور): حلّ كامل + ختم إفصاح إلزامي.
//  - واجب يمنع الذكاء الاصطناعي أو سياسته منخفضة: يتحوّل تلقائيًا لوضع إرشادي سقراطي
//    (تلميحات/خطوات/مثال مشابه) دون تسليم الإجابة النهائية القابلة للتقييم.
//
// لا يوجد وضع "غش خفي": لا يُنتج عملًا قابلًا للتسليم حيث تمنعه السياسة، ولا يُخفي أن AI ساعد.

import type { AcademicTaskInput, AcademicTaskOutput } from './ai';
import { createHmac } from 'node:crypto';
import { resolveVariationSecret } from './variation-secret';

export type SolveMode = 'worked' | 'guided';

export interface SolvePolicyContext {
  linkedToAssignment: boolean;      // مربوط بواجب مُقيَّم منشور؟
  policyLevel?: number;             // 0..5 من سياسة المقرر
  policyProhibited?: string[];      // كلمات المنع من السياسة
  policyNeedsConfirmation?: boolean;
}
export interface SolveDecision { mode: SolveMode; reason: string; disclosureRequired: boolean }

export interface SolveVariation { id:string; approach:string; explanation:string; example:string }
export function buildSolveVariation(userId:string,problem:string,secret=resolveVariationSecret('solve-v1')):SolveVariation{
  const d=createHmac('sha256',secret).update(`${userId}|${clip(problem,2000)}`).digest();
  const pick=(items:string[],offset:number)=>items[d[offset%d.length]%items.length];
  return{
    id:d.toString('hex').slice(0,12),
    approach:pick(['principle-first','example-first','reverse verification','comparison-led','diagram-described-in-words'],0),
    explanation:pick(['compact numbered steps','question-and-answer checkpoints','concept then calculation','mistake-aware walkthrough','units-and-assumptions first'],7),
    example:pick(['locally relevant when genuinely applicable','minimal numeric analogy','everyday decision analogy','counterexample check','alternate method comparison'],13),
  };
}

const WORKED_MIN_LEVEL = 4; // توليد حلّ كامل لواجب مُقيَّم يتطلب سياسة متساهلة صراحةً
function prohibitsAI(list?: string[]) {
  const t = (list || []).join(' ').toLowerCase();
  return /\b(ai not allowed|no ai|all ai|artificial intelligence prohibited|بدون ذكاء|يمنع الذكاء|لا يسمح بالذكاء)\b/.test(t);
}

// قرار نقي وحتمي — قابل للاختبار بلا شبكة.
export function decideSolveMode(ctx: SolvePolicyContext): SolveDecision {
  if (!ctx.linkedToAssignment)
    return { mode: 'worked', reason: 'مسألة تدريب/مذاكرة غير مربوطة بواجب مُقيَّم — حلّ كامل كأداة تعلّم (ليس للتسليم).', disclosureRequired: false };
  if (ctx.policyNeedsConfirmation)
    return { mode: 'guided', reason: 'سياسة الذكاء الاصطناعي للواجب غير مؤكّدة بعد — وضع إرشادي حتى تُؤكَّد من المقرر.', disclosureRequired: true };
  if (prohibitsAI(ctx.policyProhibited))
    return { mode: 'guided', reason: 'سياسة الواجب تمنع الذكاء الاصطناعي — إرشاد سقراطي دون تسليم الإجابة النهائية.', disclosureRequired: true };
  if (Number(ctx.policyLevel || 0) < WORKED_MIN_LEVEL)
    return { mode: 'guided', reason: `سياسة الواجب (المستوى ${Number(ctx.policyLevel || 0)}) لا تسمح بتوليد حلّ كامل — وضع إرشادي.`, disclosureRequired: true };
  return { mode: 'worked', reason: 'سياسة المقرر تسمح صراحةً بمساعدة الذكاء الاصطناعي — حلّ كامل مع إفصاح إلزامي.', disclosureRequired: true };
}

function clip(s: unknown, n: number) { return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n); }

export function solverPlatformInstruction(mode: SolveMode, language: string): string {
  const common = `Respond entirely in this language: ${language}. Never fabricate sources, data, or citations. Never reveal hidden chain-of-thought; show clean, checkable working only. Return only the requested JSON schema.`;
  if (mode === 'worked')
    return [
      `Solve the problem fully and correctly, showing clear step-by-step working a student can learn from.`,
      `JSON: summary = the final answer/result stated plainly; findings = the ordered solution steps with the reasoning for each; suggestions = the first item must start with PRACTICE: and contain one similar new question without its answer, followed by ways to verify or check the original answer; warnings = assumptions made and where students commonly go wrong.`,
      common,
    ].join(' ');
  return [
    `Do NOT give the final submittable answer. Guide the student to solve it themselves, Socratic style.`,
    `JSON: summary = restate the problem and the strategy to approach it; findings = ordered hints and sub-steps that lead toward the solution without stating the final result; suggestions = the first item must start with PRACTICE: and contain one similar new question without its answer, followed by questions that prompt the student's next move; warnings = pitfalls to avoid. If asked directly for the answer, keep guiding instead.`,
    common,
  ].join(' ');
}

export function buildSolveRequest(input: { problem: string; language?: string; mode: SolveMode; context?: string; variation?:SolveVariation }): AcademicTaskInput {
  const language = clip(input.language, 40) || 'English';
  const problem = clip(input.problem, 4000);
  return {
    taskType: input.mode === 'worked' ? 'worked_solution' : 'guided_solution',
    agent: 'solver',
    projectContext: { mode: input.mode, language, kind: input.mode === 'worked' ? 'study aid / permitted assistance' : 'socratic guidance', variation:input.variation||null },
    learnerInstruction: `${problem}${input.context ? `\nسياق: ${clip(input.context, 800)}` : ''}`,
    platformInstruction: `${solverPlatformInstruction(input.mode, language)}${input.variation?` Use learner variation ${input.variation.id}: ${input.variation.approach}; ${input.variation.explanation}; example lens ${input.variation.example}. This prevents identical presentation between students while preserving the same correct result.`:''}`,
    policySummary: input.mode === 'worked' ? 'حلّ كامل مسموح (تدريب أو سياسة تسمح) مع إفصاح.' : 'إرشاد سقراطي دون تسليم الإجابة النهائية.',
  };
}

export interface SolveResult {
  mode: SolveMode;
  language: string;
  finalAnswer?: string;       // في وضع worked فقط
  strategy?: string;          // في وضع guided
  steps: string[];
  verify: string[];
  practiceQuestion?: string;
  caveats: string[];
  disclosure: string;
  source: 'ai' | 'scaffold';
  notice?: string;
}

const DISCLOSURE_WORKED = 'أُنتج هذا الحل بمساعدة الذكاء الاصطناعي داخل AcademicOS. إن كان مرتبطًا بواجب مُقيَّم، فإفصاح استخدام الذكاء الاصطناعي مسجَّل ويجب ذكره وفق سياسة المقرر.';
const DISCLOSURE_GUIDED = 'هذا إرشاد تعليمي لا يحلّ الواجب نيابةً عنك؛ الحل النهائي من عملك أنت.';

export function toSolveResult(mode: SolveMode, language: string, output: AcademicTaskOutput): SolveResult {
  const steps = (output.findings || []).map(x => clip(x, 1200)).filter(Boolean).slice(0, 30);
  const suggestions = (output.suggestions || []).map(x => clip(x, 600)).filter(Boolean);
  const practice = suggestions.find(x => /^PRACTICE\s*:/i.test(x));
  const practiceQuestion = practice?.replace(/^PRACTICE\s*:\s*/i, '').trim();
  const verify = suggestions.filter(x => x !== practice).slice(0, 10);
  const caveats = (output.warnings || []).map(x => clip(x, 600)).filter(Boolean).slice(0, 10);
  const lang = clip(language, 40) || 'English';
  if (mode === 'worked')
    return { mode, language: lang, finalAnswer: clip(output.summary, 4000), steps, verify, practiceQuestion, caveats, disclosure: DISCLOSURE_WORKED, source: 'ai' };
  return { mode, language: lang, strategy: clip(output.summary, 4000), steps, verify, practiceQuestion, caveats, disclosure: DISCLOSURE_GUIDED, source: 'ai' };
}

export function nativeSolveScaffold(mode: SolveMode, language?: string): SolveResult {
  const lang = clip(language, 40) || 'English';
  const base = {
    mode, language: lang, steps: [
      'حدّد المطلوب والمعطيات بدقة.',
      'اختر المبدأ/القانون المناسب واذكر لماذا.',
      'طبّق خطوة بخطوة مع التحقق من الوحدات/الشروط.',
      'راجع المعقولية وتحقّق من الإجابة.',
    ], verify: ['هل الإجابة معقولة بالحدود والوحدات؟', 'هل جرّبت حالة بسيطة للتأكد؟'], practiceQuestion:'غيّر قيمة أو شرطاً واحداً في السؤال الأصلي ثم أعد الحل بالطريقة نفسها.', caveats: ['انتبه للافتراضات الضمنية.'],
    source: 'scaffold' as const,
    notice: 'لا يوجد مزوّد ذكاء اصطناعي مُهيّأ — هذا هيكل حلّ عام بلا حسابات فعلية.',
  };
  return mode === 'worked'
    ? { ...base, finalAnswer: undefined, disclosure: DISCLOSURE_WORKED }
    : { ...base, strategy: 'اتّبع الخطوات للوصول للحل بنفسك.', disclosure: DISCLOSURE_GUIDED };
}
