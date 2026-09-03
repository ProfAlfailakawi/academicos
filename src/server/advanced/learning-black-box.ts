// AcademicOS — Learning Black Box  (الصندوق الأسود للتعلّم ✈️)
// مسجّل عملية اختياري بالكامل ومحلي: يبني الجهاز سلسلة hash موقّتة لجلسات العمل
// (فتح مصدر، كتابة، مراجعة) على جهاز الطالب هو، ويختار هو إرفاقها بـ Evidence Capsule.
// أقوى إثبات تأليف بشري ممكن — بلا بكسل مراقبة إجبارية. يحوّل «نثبت ولا نتهم» إلى سلاح نهائي.
//
// هذا الملف = تحقّق الخادم من سلامة السلسلة. التسجيل نفسه في src/lib/black-box-recorder.ts (العميل).
// الخادم لا يثق بالعميل: يعيد حساب كل hash ويتحقق من الترابط الزمني والمنطقي.

import { digest, isoNow, round } from './_shared';

export type BlackBoxEventType = 'session_start' | 'source_open' | 'write_burst' | 'revision' | 'paste' | 'idle_return' | 'session_end';
export interface BlackBoxEvent {
  seq: number;
  type: BlackBoxEventType;
  at: number;                    // ms (زمن العميل)
  meta?: { chars?: number; sourceRef?: string; pasteChars?: number };
  prevHash: string;              // hash الحدث السابق (سلسلة)
  hash: string;                  // = sha256(seq|type|at|prevHash|metaCanonical)
}
export interface BlackBoxChain {
  projectId: string;
  algorithm: 'sha256-chain-v1';
  genesis: string;               // sha256(projectId|salt) — لا يكشف المحتوى
  events: BlackBoxEvent[];
}

export function canonicalMeta(meta?: BlackBoxEvent['meta']): string {
  if (!meta) return '';
  const parts = [meta.chars ?? '', meta.sourceRef ?? '', meta.pasteChars ?? ''];
  return parts.join('|');
}
export function computeEventHash(e: Omit<BlackBoxEvent, 'hash'>): string {
  return digest(`${e.seq}|${e.type}|${e.at}|${e.prevHash}|${canonicalMeta(e.meta)}`);
}

export interface BlackBoxVerdict {
  projectId: string;
  generatedAt: string;
  intact: boolean;               // السلسلة متماسكة ومترابطة
  eventCount: number;
  brokenAt?: number;             // seq أول كسر
  reason?: string;
  // مؤشرات عملية بشرية (وصفية، لا اتهامية):
  signals: {
    activeMinutes: number;
    writeBursts: number;
    sourceOpens: number;
    revisions: number;
    largePastes: number;         // لصقات كبيرة (>400 حرف) — تُعرض للشفافية لا كاتهام
    humanRhythmScore: number;    // 0..100 اتساق إيقاع بشري (فترات، مراجعات، تنوّع)
  };
  disclosure: string;
}

const LARGE_PASTE = 400;

export function verifyBlackBoxChain(chain: BlackBoxChain): BlackBoxVerdict {
  const events = [...chain.events].sort((a, b) => a.seq - b.seq);
  let intact = true, brokenAt: number | undefined, reason: string | undefined;
  let prev = chain.genesis;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.seq !== i) { intact = false; brokenAt = e.seq; reason = 'ترقيم متسلسل مكسور'; break; }
    if (e.prevHash !== prev) { intact = false; brokenAt = e.seq; reason = 'ربط prevHash لا يطابق الحدث السابق'; break; }
    if (computeEventHash(e) !== e.hash) { intact = false; brokenAt = e.seq; reason = 'hash الحدث لا يُعاد إنتاجه (عبث محتمل)'; break; }
    if (i > 0 && e.at < events[i - 1].at) { intact = false; brokenAt = e.seq; reason = 'زمن تراجع للخلف'; break; }
    prev = e.hash;
  }

  const start = events[0]?.at ?? 0, end = events[events.length - 1]?.at ?? 0;
  const activeMinutes = round(Math.max(0, end - start) / 60000, 0);
  const writeBursts = events.filter(e => e.type === 'write_burst').length;
  const sourceOpens = events.filter(e => e.type === 'source_open').length;
  const revisions = events.filter(e => e.type === 'revision').length;
  const largePastes = events.filter(e => e.type === 'paste' && (e.meta?.pasteChars || 0) > LARGE_PASTE).length;
  const idleReturns = events.filter(e => e.type === 'idle_return').length;
  // إيقاع بشري: توزّع زمني (فترات عمل متعددة) + مراجعات + مصادر - هيمنة لصق ضخم.
  const spread = idleReturns + Math.min(writeBursts, 8);
  const humanRhythmScore = Math.max(0, Math.min(100, Math.round(
    Math.min(spread * 8, 45) + Math.min(revisions * 6, 25) + Math.min(sourceOpens * 5, 20) + (activeMinutes >= 20 ? 10 : activeMinutes / 2) - largePastes * 10,
  )));

  return {
    projectId: chain.projectId, generatedAt: isoNow(), intact, eventCount: events.length, brokenAt, reason,
    signals: { activeMinutes, writeBursts, sourceOpens, revisions, largePastes, humanRhythmScore },
    disclosure: 'الصندوق الأسود اختياري بالكامل ومحلي المنشأ؛ يثبت وجود عملية عمل بشرية (فترات، مصادر، مراجعات) عبر سلسلة hash قابلة لإعادة التحقق. اللصقات الكبيرة تُعرض للشفافية لا كاتهام. الطالب وحده يقرر إرفاق السلسلة بجواز التأليف.',
  };
}
