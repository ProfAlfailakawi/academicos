// AcademicOS — Peer Explanation Economy  (اقتصاد الشرح بين الطلاب 🎙️)
// طالب فهم مفهومًا صعبًا يسجّل شرحًا ≤60 ثانية بلهجته، يُتحقّق من صحته ضد المادة،
// يُضاف لبنك شروحات المقرر، والشارح يكسب رصيدًا (خصم على باقة Viva مثلًا).
// تعلّم أفقي بالعامية الخليجية — ميزة ثقافية يصعب على المنصات العالمية تقديمها.
//
// النموذج (AI) يتحقق من الصحة اختياريًا؛ التحقق البنيوي والحتمي وحساب الرصيد نقيّان ومختبَران.

import { isoNow, round, clamp, tokenize, jaccard, normalize } from './_shared';

export interface PeerExplanationSubmission {
  id: string;
  courseId: string;
  tenantId: string;
  authorId: string;
  concept: string;               // المفهوم المشروح
  transcript: string;            // تفريغ الصوت (من ASR)
  durationSeconds: number;
  language?: string;             // 'ar-KW' مثلًا
  referenceMaterial?: string;    // مقتطف المادة للتحقق من الصحة
}
export interface ExplanationQuality {
  structural: number;            // 0..100 اكتمال بنيوي (طول/مدة/مفردات)
  relevance: number;             // 0..100 تطابق مع المادة المرجعية
  band: 'publishable' | 'revise' | 'rejected';
  flags: string[];
}
export interface ExplanationVerdict {
  submissionId: string;
  generatedAt: string;
  quality: ExplanationQuality;
  creditAwarded: number;         // نقاط رصيد (0 إن لم يُنشر)
  accepted: boolean;
  note: string;
}

const MIN_SECONDS = 15, MAX_SECONDS = 75, MIN_WORDS = 25;
const CREDIT_PUBLISH = 10;       // رصيد نشر شرح مقبول

// كشف محتوى غير مناسب/غش صريح قبل أي نشر.
const UNSAFE = /(انسخ الإجابة|answer key|حل الواجب كامل|اغش|leak the exam|هاك الاختبار)/i;

export function evaluateExplanation(sub: PeerExplanationSubmission): ExplanationVerdict {
  const words = tokenize(sub.transcript);
  const flags: string[] = [];
  if (sub.durationSeconds < MIN_SECONDS) flags.push('قصير جدًا — أقل من 15 ثانية.');
  if (sub.durationSeconds > MAX_SECONDS) flags.push('أطول من الحد (60–75 ثانية) — اختصر.');
  if (words.length < MIN_WORDS) flags.push('تفريغ قصير — الشرح غير كافٍ.');
  if (!normalize(sub.transcript).includes(normalize(sub.concept.split(/\s+/)[0] || sub.concept))) flags.push('لا يذكر المفهوم صراحةً.');
  const unsafe = UNSAFE.test(sub.transcript);
  if (unsafe) flags.push('محتوى قد يكشف إجابات/يشجع الغش — مرفوض.');

  const durationOk = sub.durationSeconds >= MIN_SECONDS && sub.durationSeconds <= MAX_SECONDS;
  const structural = round(clamp((clamp(words.length / 90, 0, 1) * 0.6 + (durationOk ? 0.4 : 0)) , 0, 1) * 100, 0);
  const relevance = sub.referenceMaterial
    ? round(clamp(jaccard(words, tokenize(sub.referenceMaterial)) / 0.25, 0, 1) * 100, 0)
    : 60; // بلا مرجع: محايد، بانتظار تحقق الأستاذ/النموذج

  const band: ExplanationQuality['band'] = unsafe ? 'rejected'
    : structural >= 60 && relevance >= 45 && words.length >= MIN_WORDS ? 'publishable'
    : structural >= 35 ? 'revise' : 'rejected';
  const accepted = band === 'publishable';
  return {
    submissionId: sub.id, generatedAt: isoNow(),
    quality: { structural, relevance, band, flags },
    creditAwarded: accepted ? CREDIT_PUBLISH : 0, accepted,
    note: 'التحقق البنيوي حتمي؛ صحة المحتوى العلمي تُؤكَّد بمراجعة الأستاذ أو بوابة الذكاء الاصطناعي قبل الظهور العام. الرصيد يُصرف مرة واحدة لكل شرح مقبول.',
  };
}

// دفتر رصيد حتمي: يمنع الصرف المزدوج لنفس الشرح، ويجمع الرصيد لكل طالب.
export interface CreditLedgerEntry { authorId: string; submissionId: string; credit: number; at: string }
export function applyCredit(ledger: CreditLedgerEntry[], entry: CreditLedgerEntry): { ledger: CreditLedgerEntry[]; applied: boolean } {
  if (ledger.some(e => e.submissionId === entry.submissionId)) return { ledger, applied: false };
  return { ledger: [...ledger, entry], applied: true };
}
export function creditBalance(ledger: CreditLedgerEntry[], authorId: string): number {
  return ledger.filter(e => e.authorId === authorId).reduce((n, e) => n + e.credit, 0);
}
