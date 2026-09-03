// AcademicOS — WhatsApp Intake Gateway  (بوابة الواتساب 📱)
// قناة توزيع نووية للخليج: الطالب يصوّر ورقة التكليف ويرسلها لرقم واتساب، فيرجع له رابط مشروع
// مُجمَّع جاهز. الـ Intake متعدد الوسائط موجود؛ الناقص فقط الجسر. يحوّل «جرّب» من 5 دقائق تسجيل
// إلى رسالة واحدة.
//
// هذا الملف = تحليل نقيّ لـ webhook واتساب (Meta Cloud API) + تحقّق التوقيع + بناء الرد.
// الاستدعاءات الشبكية (رفع الوسائط/الترجمة/الرد) تُنفَّذ في الـ routes عبر adapters محقونة.

import { verifyHmacSha256, isoNow, digest } from './_shared';

export interface WhatsAppInboundMessage {
  from: string;                  // رقم المُرسِل (E.164)
  messageId: string;
  timestamp: number;
  kind: 'text' | 'image' | 'document' | 'audio' | 'unsupported';
  text?: string;
  mediaId?: string;              // معرّف وسائط Meta (يُنزّل لاحقًا عبر adapter)
  mimeType?: string;
  filename?: string;
}
export interface WhatsAppParseResult {
  ok: boolean;
  messages: WhatsAppInboundMessage[];
  contacts: Array<{ waId: string; name?: string }>;
  statusesOnly: boolean;         // تحديث حالة تسليم فقط (لا رسالة مستخدم)
}

// تحقّق توقيع Meta (X-Hub-Signature-256: sha256=...) — يُرفض أي webhook بلا توقيع صحيح.
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string, appSecret: string): boolean {
  return verifyHmacSha256(rawBody, signatureHeader || '', appSecret);
}

// تحقّق تحدّي الاشتراك (GET) — hub.mode=subscribe & hub.verify_token يطابق السر.
export function verifyWebhookChallenge(query: Record<string, unknown>, verifyToken: string): { ok: boolean; challenge?: string } {
  const mode = String(query['hub.mode'] || '');
  const token = String(query['hub.verify_token'] || '');
  const challenge = String(query['hub.challenge'] || '');
  if (mode === 'subscribe' && token && token === verifyToken) return { ok: true, challenge };
  return { ok: false };
}

export function parseWhatsAppWebhook(body: any): WhatsAppParseResult {
  const messages: WhatsAppInboundMessage[] = [];
  const contacts: Array<{ waId: string; name?: string }> = [];
  let sawStatus = false;
  try {
    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value || {};
        for (const c of value.contacts || []) contacts.push({ waId: String(c.wa_id || ''), name: c?.profile?.name });
        if (Array.isArray(value.statuses) && value.statuses.length) sawStatus = true;
        for (const m of value.messages || []) {
          const base = { from: String(m.from || ''), messageId: String(m.id || ''), timestamp: Number(m.timestamp || 0) * 1000 };
          if (m.type === 'text') messages.push({ ...base, kind: 'text', text: String(m.text?.body || '') });
          else if (m.type === 'image') messages.push({ ...base, kind: 'image', mediaId: String(m.image?.id || ''), mimeType: String(m.image?.mime_type || 'image/jpeg'), text: m.image?.caption });
          else if (m.type === 'document') messages.push({ ...base, kind: 'document', mediaId: String(m.document?.id || ''), mimeType: String(m.document?.mime_type || ''), filename: m.document?.filename });
          else if (m.type === 'audio') messages.push({ ...base, kind: 'audio', mediaId: String(m.audio?.id || ''), mimeType: String(m.audio?.mime_type || 'audio/ogg') });
          else messages.push({ ...base, kind: 'unsupported' });
        }
      }
    }
  } catch { return { ok: false, messages: [], contacts: [], statusesOnly: false }; }
  return { ok: true, messages, contacts, statusesOnly: sawStatus && messages.length === 0 };
}

// ربط رقم الهاتف بحساب: رمز تحقّق قصير حتمي المصدر (يُرسل داخل التطبيق، يُدخله الطالب في واتساب).
export function linkCodeFor(userId: string, salt: string): string {
  return digest(`${userId}|${salt}`).slice(0, 6).toUpperCase();
}
export function verifyLinkCode(userId: string, salt: string, code: string): boolean {
  return !!code && linkCodeFor(userId, salt) === code.trim().toUpperCase();
}

// بناء رد نصي (يُرسل عبر adapter). لا نرسل روابط لغير الأرقام المرتبطة.
export function buildReply(kind: 'welcome' | 'need_link' | 'compiling' | 'ready' | 'unsupported' | 'error', ctx: { projectUrl?: string; linkHint?: string } = {}): string {
  switch (kind) {
    case 'welcome': return 'أهلًا بك في AcademicOS 👋 أرسل صورة ورقة التكليف أو نصّه، وسأحوّله إلى مشروع أكاديمي منظّم برابط جاهز.';
    case 'need_link': return `لربط رقمك بحسابك، افتح إعدادات AcademicOS واطلب «ربط واتساب»، ثم أرسل الرمز هنا${ctx.linkHint ? ` (${ctx.linkHint})` : ''}.`;
    case 'compiling': return '📎 استلمت التكليف — جاري تحليله وتجميع مشروعك. لحظات من فضلك…';
    case 'ready': return `✅ جاهز! هذا رابط مشروعك:\n${ctx.projectUrl}\nافتحه لإكمال العمل والأدلة والتسليم.`;
    case 'unsupported': return 'أستطيع استقبال نص أو صورة أو ملف (PDF/Word) أو تسجيل صوتي للتكليف. جرّب أحد هذه الصيغ.';
    default: return 'حدث خطأ مؤقت أثناء المعالجة. جرّب الإرسال مرة أخرى بعد قليل.';
  }
}
export interface NormalizedIntake { from: string; text: string; media: Array<{ mediaId: string; mimeType: string; filename?: string; kind: string }>; receivedAt: string }
export function toNormalizedIntake(msg: WhatsAppInboundMessage): NormalizedIntake {
  return {
    from: msg.from,
    text: msg.text || '',
    media: msg.mediaId ? [{ mediaId: msg.mediaId, mimeType: msg.mimeType || '', filename: msg.filename, kind: msg.kind }] : [],
    receivedAt: isoNow(msg.timestamp || Date.now()),
  };
}
