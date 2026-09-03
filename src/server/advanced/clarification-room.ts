// AcademicOS — Live Clarification Room  (غرفة توضيح الواجب الحيّة 📡)
// الـ Compiler يكتشف الغموض في التكليف لكنه يبتلعه. هنا يتحوّل كل غموض إلى سؤال رسمي
// يُرفع للأستاذ، وجوابه يُبثّ لكل الفصل ويُنتج تصحيحًا (patch) على Project DNA + نسخة تكليف جديدة.
// النتيجة: التكليف كائن حيّ ذو إصدارات، وينتهي «أنا فهمت السؤال غلط».
//
// كل الدوال نقية: مُخفِّض (reducer) حتمي على حالة الخيط + مولّد patch. البثّ والتخزين خارجها (routes/realtime).

import { isoNow, digest, normalize } from './_shared';

export type ClarificationStatus = 'open' | 'answered' | 'dismissed';
export interface ClarificationThread {
  id: string;
  assignmentId: string;
  tenantId: string;
  courseId?: string;
  question: string;
  origin: 'ambiguity_detected' | 'student_asked';
  raisedBy?: string;             // معرّف الطالب (مخفي في البثّ)
  status: ClarificationStatus;
  answer?: string;
  answeredBy?: string;
  dnaPatch?: ClarificationPatch;
  upvotes: number;
  createdAt: string;
  updatedAt: string;
  version: number;               // إصدار التكليف الذي أنتجه هذا الجواب
}
export interface ClarificationPatch {
  // تصحيحات آمنة على Project DNA للطلاب المتأثرين: إضافات لا حذف صامت.
  addRequirements?: string[];
  clarifyDeadline?: string;
  addRiskFlags?: string[];
  note: string;
}

// إنشاء خيط من غموض اكتشفه الـ Compiler (يُستدعى تلقائيًا عند الترجمة).
export function openClarificationFromAmbiguity(params: {
  assignmentId: string; tenantId: string; courseId?: string; ambiguity: string; now?: number; raisedBy?: string;
}): ClarificationThread {
  const now = params.now ?? Date.now();
  const q = params.ambiguity.trim();
  return {
    id: `clr_${digest(`${params.assignmentId}|${normalize(q)}`).slice(0, 16)}`,
    assignmentId: params.assignmentId, tenantId: params.tenantId, courseId: params.courseId,
    question: q, origin: 'ambiguity_detected', raisedBy: params.raisedBy,
    status: 'open', upvotes: 0, createdAt: isoNow(now), updatedAt: isoNow(now), version: 0,
  };
}

// دمج غموضات جديدة دون تكرار (نفس السؤال المطبّع = نفس الخيط، يرفع الـ upvotes).
export function mergeAmbiguities(existing: ClarificationThread[], incoming: ClarificationThread[]): ClarificationThread[] {
  const byId = new Map(existing.map(t => [t.id, { ...t }]));
  for (const t of incoming) {
    const prev = byId.get(t.id);
    if (prev) { prev.upvotes += 1; prev.updatedAt = t.updatedAt; }
    else byId.set(t.id, t);
  }
  return [...byId.values()].sort((a, b) => b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt));
}

// الأستاذ يجيب → يُنتج patch مقترحًا + بثّ. الجواب لا يُعدّل درجة، فقط يوضّح المطلوب.
export function answerClarification(thread: ClarificationThread, params: {
  answer: string; answeredBy: string; now?: number; addRequirements?: string[]; clarifyDeadline?: string;
}): { thread: ClarificationThread; broadcast: ClarificationBroadcast } {
  const now = params.now ?? Date.now();
  const patch: ClarificationPatch = {
    addRequirements: (params.addRequirements || []).map(x => x.trim()).filter(Boolean),
    clarifyDeadline: params.clarifyDeadline,
    addRiskFlags: [],
    note: `توضيح رسمي من المُقيّم بتاريخ ${isoNow(now).slice(0, 10)}: ${params.answer.trim()}`,
  };
  const next: ClarificationThread = {
    ...thread, status: 'answered', answer: params.answer.trim(), answeredBy: params.answeredBy,
    dnaPatch: patch, updatedAt: isoNow(now), version: thread.version + 1,
  };
  const broadcast: ClarificationBroadcast = {
    type: 'clarification_answered', assignmentId: thread.assignmentId, tenantId: thread.tenantId,
    threadId: thread.id, question: thread.question, answer: next.answer as string,
    version: next.version, patch, at: isoNow(now),
  };
  return { thread: next, broadcast };
}

// تطبيق الـ patch على نسخة Project DNA لطالب متأثر (إضافي وآمن — لا حذف).
export function applyClarificationPatch<T extends { requirements?: any[]; requiredActions?: string[]; riskFlags?: string[]; deadlines?: any }>(
  dna: T, patch: ClarificationPatch,
): { dna: T; changed: boolean } {
  let changed = false;
  const next: any = { ...dna };
  if (patch.addRequirements?.length) {
    const existing = new Set((next.requiredActions || []).map((x: string) => normalize(x)));
    const add = patch.addRequirements.filter(r => !existing.has(normalize(r)));
    if (add.length) { next.requiredActions = [...(next.requiredActions || []), ...add]; changed = true; }
  }
  if (patch.clarifyDeadline) {
    next.deadlines = { ...(next.deadlines || {}), final: patch.clarifyDeadline };
    changed = true;
  }
  if (patch.addRiskFlags?.length) {
    next.riskFlags = [...new Set([...(next.riskFlags || []), ...patch.addRiskFlags])];
    changed = true;
  }
  return { dna: next, changed };
}

export interface ClarificationBroadcast {
  type: 'clarification_answered' | 'clarification_opened';
  assignmentId: string;
  tenantId: string;
  threadId: string;
  question: string;
  answer?: string;
  version: number;
  patch?: ClarificationPatch;
  at: string;
}
