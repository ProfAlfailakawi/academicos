import { createHash } from "node:crypto";
import { getAppFirestore } from "./firebase-services";
import { DemoSandbox } from "./demoSandbox";
import { APNS_TOKEN_PATTERN, createApnsSender, type ApnsSender, type PushMessage } from "./apns-push";

/*
 * تنبيهات تطبيق iOS (APNs).
 *
 * داخل التطبيق يسجّل الجهاز نفسه لدى Apple بلمسةٍ واحدة على «فعّل التنبيهات»،
 * فيُحفظ توكنه في pushDevices مربوطاً بالمستخدم والمؤسسة. ومن ثَمّ كل إشعارٍ
 * شخصي يُنشأ في مخزن الإشعارات (notifications.ts) يصل كذلك إلى أجهزة صاحبه،
 * ولمسُه يفتح targetPath.
 *
 *   ١. بلا مفاتيح APNs في البيئة لا يُرسل شيء ولا يظهر خطأ.
 *   ٢. التوكن الذي ترفضه Apple (410 / BadDeviceToken / Unregistered) يُحذف.
 *   ٣. الإرسال لا يُعطّل الطلب ولا يُسقطه.
 *   ٤. الصندوق التجريبي لا يُنبّه أحداً.
 */

const COLLECTION = "pushDevices";
const PREFERENCES = "notificationPreferences";

let storeOverride: any = null;
let sender: ApnsSender = createApnsSender();

const store = (): any => storeOverride || getAppFirestore();

/** للاختبار: مخزنٌ في الذاكرة ومرسِلٌ بعميل HTTP/2 محاكى. */
export function setNativePushTestHooks(hooks: { store?: any; sender?: ApnsSender | null }) {
  if ("store" in hooks) storeOverride = hooks.store || null;
  if ("sender" in hooks) sender = hooks.sender || createApnsSender();
}

export const isValidDeviceToken = (token: unknown): token is string => typeof token === "string" && APNS_TOKEN_PATTERN.test(token);

/** بصمة التوكن كما تحسبها الواجهة (sha256 لـ "apns:<token>") — ومعرّف المستند. */
export const deviceId = (token: string) => createHash("sha256").update(`apns:${token.toLowerCase()}`).digest("hex");

export async function saveDevice(tenantId: string, userId: string, token: string) {
  const at = new Date().toISOString();
  const id = deviceId(token);
  await store().collection(COLLECTION).doc(id).set({ token: token.toLowerCase(), tenantId, userId, platform: "ios", createdAt: at, updatedAt: at });
  return id;
}

export async function removeDevice(token: string, owner?: { tenantId: string; userId: string }) {
  const ref = store().collection(COLLECTION).doc(deviceId(token));
  if (owner) {
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;
    if (!data || data.userId !== owner.userId || data.tenantId !== owner.tenantId) return false;
  }
  await ref.delete();
  return true;
}

export async function devicesFor(tenantId: string, userId: string): Promise<string[]> {
  const snap = await store().collection(COLLECTION).where("tenantId", "==", tenantId).where("userId", "==", userId).limit(20).get();
  return snap.docs.map((doc: any) => String(doc.data()?.token || "")).filter(Boolean);
}

async function pushAllowed(tenantId: string, userId: string) {
  const doc = await store().collection(PREFERENCES).doc(`${tenantId}__${userId}`).get();
  /* لا تفضيلات محفوظة: تسجيلُ الجهاز نفسه هو الموافقة. وإطفاءُ «إشعارات فورية» يُسكته. */
  return !doc.exists || doc.data()?.push !== false;
}

export async function pushToUser(tenantId: string, userId: string, message: PushMessage) {
  if (!sender.configured()) return { sent: 0, dropped: 0 };
  if (!(await pushAllowed(tenantId, userId))) return { sent: 0, dropped: 0 };
  let sent = 0;
  let dropped = 0;
  for (const token of await devicesFor(tenantId, userId)) {
    const result = await sender.send(token, message, message.tag ? { collapseId: message.tag } : {});
    if (result.ok) sent += 1;
    else if (result.gone) { await removeDevice(token); dropped += 1; }
  }
  return { sent, dropped };
}

/** يُستدعى بعد حفظ كل إشعار شخصي. يُطلق ولا يُنتظر. */
export function pushForNotification(item: { tenantId: string; userId: string; title: string; body?: string; targetPath?: string; groupKey?: string; type?: string; id: string }) {
  if (!item.userId || !item.tenantId || !sender.configured()) return;
  if (!storeOverride && DemoSandbox.currentFirestore()) return;
  const url = item.targetPath && item.targetPath.startsWith("/") && !item.targetPath.startsWith("//") ? item.targetPath : "/app/notifications";
  void pushToUser(item.tenantId, item.userId, {
    title: String(item.title || "").slice(0, 140),
    body: String(item.body || "").slice(0, 240),
    url,
    tag: (item.groupKey || item.type || "notice").slice(0, 64),
  }).catch(() => undefined);
}

export const nativePushConfigured = () => sender.configured();
