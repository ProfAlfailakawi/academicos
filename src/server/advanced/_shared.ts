// AcademicOS — Advanced Engines shared helpers
// دوال نقية مشتركة لمحرّكات القدرات المتقدمة. لا Math.random/Date.now داخل الحساب؛
// كل ما يحتاج زمنًا يقبل now/seed كوسيط ليكون حتميًا وقابلًا لإعادة الإنتاج والاختبار.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function isoNow(now = Date.now()) { return new Date(now).toISOString(); }
export function normalize(v: string) { return String(v || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en'); }
export function unique<T>(items: T[]) { return [...new Set(items)]; }
export function digest(v: string) { return createHash('sha256').update(v).digest('hex'); }
export function round(n: number, p = 1) { const f = 10 ** p; return Math.round(n * f) / f; }
export function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
export function asStringArray(v: unknown) { return Array.isArray(v) ? v.map(String).map(x => x.trim()).filter(Boolean) : []; }

// PRNG حتمي (mulberry32) — لأي محاكاة قابلة لإعادة الإنتاج بنفس البذرة.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function seedFrom(v: string) { return parseInt(digest(v).slice(0, 8), 16) >>> 0; }

// إحصاء وصفي بسيط
export function mean(xs: number[]) { return xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0; }
export function stdev(xs: number[]) { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce((n, x) => n + (x - m) ** 2, 0) / xs.length); }
export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = clamp(p, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// عتبة إخفاء الهوية (k-anonymity): لا نعرض أي إحصاء مشتق من فوج أصغر من هذا العدد،
// حتى لا يُستدل على فرد بعينه. هذا مبدأ خصوصي جوهري في كل المحرّكات الجماعية.
export const K_ANONYMITY_MIN = 5;
export function meetsKAnonymity(cohortSize: number) { return cohortSize >= K_ANONYMITY_MIN; }

// تحقّق توقيع HMAC-SHA256 بزمن ثابت — لبوابات Webhook (واتساب/الدفع).
export function verifyHmacSha256(payload: string, signatureHex: string, secret: string): boolean {
  if (!secret || !signatureHex) return false;
  const expected = createHmac('sha256', secret).update(payload).digest();
  let provided: Buffer;
  try { provided = Buffer.from(signatureHex.replace(/^sha256=/, ''), 'hex'); } catch { return false; }
  if (provided.length !== expected.length || provided.length === 0) return false;
  return timingSafeEqual(provided, expected);
}

// كشف مستوى بلوم من الأفعال — مشترك بين مُقيّم «اصنع الامتحان» ومُدقّق الشرح.
const BLOOM: Array<{ level: number; label: string; verbs: string[] }> = [
  { level: 1, label: 'تذكّر', verbs: ['اذكر', 'عرّف', 'عدّد', 'سمِّ', 'define', 'list', 'name', 'state', 'recall'] },
  { level: 2, label: 'فهم', verbs: ['اشرح', 'لخّص', 'وضّح', 'فسّر', 'explain', 'summarize', 'describe', 'interpret'] },
  { level: 3, label: 'تطبيق', verbs: ['طبّق', 'احسب', 'استخدم', 'نفّذ', 'apply', 'calculate', 'use', 'solve', 'implement'] },
  { level: 4, label: 'تحليل', verbs: ['حلّل', 'قارن', 'ميّز', 'فكّك', 'analyze', 'compare', 'differentiate', 'contrast'] },
  { level: 5, label: 'تقويم', verbs: ['قيّم', 'انتقد', 'برّر', 'دافع', 'evaluate', 'critique', 'justify', 'defend', 'assess'] },
  { level: 6, label: 'إبداع', verbs: ['صمّم', 'ابتكر', 'اقترح', 'ركّب', 'design', 'create', 'propose', 'compose', 'formulate'] },
];
export function bloomLevel(text: string): { level: number; label: string } {
  const key = normalize(text);
  let best = { level: 1, label: 'تذكّر' };
  for (const row of BLOOM) if (row.verbs.some(v => key.includes(normalize(v)))) best = { level: row.level, label: row.label };
  return best;
}

export function tokenize(text: string): string[] {
  return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 3);
}
// تشابه Jaccard على المفردات — لقياس التغطية والتمييز بلا نموذج.
export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a), sb = new Set(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0; for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}
