import { createHmac, randomUUID } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Request } from "express";

const SIGNALS = "abuseSignalRegistry";
const COUNTERS = "abuseBenefitCounters";
const RESERVATIONS = "abuseBenefitReservations";
const EVENTS = "abuseEvents";

type SignalType = "install" | "device" | "email" | "network";
type Signal = { type: SignalType; hash: string; rawPresent: boolean };
export type FairUseActor = {
  userId: string;
  tenantId: string;
  email?: string;
  emailVerified?: boolean;
};
export type FairUseAssessment = {
  allowed: boolean;
  score: number;
  decision: "allow" | "step_up" | "deny";
  reasonCodes: string[];
  accountCounts: Partial<Record<SignalType, number>>;
  benefitCounts: Partial<Record<SignalType | "account", number>>;
  emailVerified: boolean;
  windowDays: number;
};
export type FairUseReservation = { id: string; counterIds: string[]; benefit: string; userId: string };

function now() { return new Date().toISOString(); }
function secret() {
  const value = String(process.env.ABUSE_HASH_SECRET || "").trim();
  if (process.env.NODE_ENV === "production" && value.length < 32)
    throw Object.assign(new Error("ABUSE_HASH_SECRET must be configured for production"), { status: 503, code: "ABUSE_GUARD_NOT_CONFIGURED" });
  return value || "academicos-development-only-abuse-secret";
}
function hmac(value: string) { return createHmac("sha256", secret()).update(value).digest("hex"); }
function validHeader(value: unknown) {
  const v = String(value || "").trim();
  return /^[A-Za-z0-9_-]{16,160}$/.test(v) ? v : "";
}
function normalizedEmailFamily(email: string) {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at < 1) return lower;
  let local = lower.slice(0, at), domain = lower.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (["gmail.com"].includes(domain)) {
    local = local.split("+", 1)[0].replace(/\./g, "");
  } else if (["outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com", "proton.me", "protonmail.com"].includes(domain)) {
    local = local.split("+", 1)[0];
  }
  return `${local}@${domain}`;
}
function networkPrefix(ipValue: string) {
  let ip = String(ipValue || "").trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return ip.split(".").slice(0, 3).join(".") + ".0/24";
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + "::/64";
  return "unknown";
}
function requestSignals(req: Request, actor: FairUseActor): Signal[] {
  const install = validHeader(req.header("X-Academicos-Install"));
  const device = validHeader(req.header("X-Academicos-Device"));
  const email = actor.email ? normalizedEmailFamily(actor.email) : "";
  const network = networkPrefix(req.ip || req.socket.remoteAddress || "");
  const signals: Signal[] = [
    { type: "install", hash: install ? hmac(`install:${install}`) : "", rawPresent: Boolean(install) },
    { type: "device", hash: device ? hmac(`device:${device}`) : "", rawPresent: Boolean(device) },
    { type: "email", hash: email ? hmac(`email:${email}`) : "", rawPresent: Boolean(email) },
    { type: "network", hash: network !== "unknown" ? hmac(`network:${network}`) : "", rawPresent: network !== "unknown" },
  ];
  return signals.filter((x) => Boolean(x.hash));
}
function positiveEnvNumber(key: string, fallback: number, minimum = 1) {
  const parsed = Number(process.env[key] ?? fallback);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.floor(parsed)) : fallback;
}
function windowKey() {
  const days = positiveEnvNumber("FREE_BENEFIT_WINDOW_DAYS", 90, 7);
  const ms = days * 86400_000;
  return { key: String(Math.floor(Date.now() / ms)), days };
}
function signalDocId(signal: Signal) { return `${signal.type}_${signal.hash}`; }
function counterDocId(benefit: string, window: string, scope: string, hash: string) { return hmac(`${benefit}:${window}:${scope}:${hash}`); }
function envLimit(key: string, fallback: number) { return positiveEnvNumber(key, fallback, 1); }

function activeReservations(value: unknown, at = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, string>;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([id, expiresAt]) => /^[A-Za-z0-9-]{16,80}$/.test(id) && Date.parse(String(expiresAt || "")) > at)
    .map(([id, expiresAt]) => [id, String(expiresAt)]));
}

async function recordEvent(data: Record<string, unknown>) {
  const ref = getFirestore().collection(EVENTS).doc();
  await ref.set({ id: ref.id, createdAt: now(), ...data });
}

export async function reserveFreeBenefit(req: Request, actor: FairUseActor, benefit = "project_preview"):
  Promise<{ assessment: FairUseAssessment; reservation?: FairUseReservation }> {
  const db = getFirestore();
  const signals = requestSignals(req, actor);
  const { key: win, days: windowDays } = windowKey();
  const reservationId = randomUUID();
  const signalRefs = signals.map((s) => ({ s, ref: db.collection(SIGNALS).doc(signalDocId(s)) }));
  const counterSpecs = [
    { scope: "account" as const, hash: hmac(`uid:${actor.userId}`), limit: envLimit("FREE_BENEFIT_ACCOUNT_LIMIT", 1) },
    ...signals.filter((s) => s.type !== "network").map((s) => ({ scope: s.type, hash: s.hash, limit: envLimit(`FREE_BENEFIT_${s.type.toUpperCase()}_LIMIT`, s.type === "email" ? 1 : 2) })),
    ...signals.filter((s) => s.type === "network").map((s) => ({ scope: s.type, hash: s.hash, limit: envLimit("FREE_BENEFIT_NETWORK_LIMIT", 50) })),
  ];
  const counterRefs = counterSpecs.map((c) => ({ c, id: counterDocId(benefit, win, c.scope, c.hash), ref: db.collection(COUNTERS).doc(counterDocId(benefit, win, c.scope, c.hash)) }));

  let assessment!: FairUseAssessment;
  let allowed = false;
  await db.runTransaction(async (tx) => {
    const [signalDocs, counterDocs] = await Promise.all([
      Promise.all(signalRefs.map(({ ref }) => tx.get(ref))),
      Promise.all(counterRefs.map(({ ref }) => tx.get(ref))),
    ]);
    const accountCounts: Partial<Record<SignalType, number>> = {};
    signalDocs.forEach((doc, i) => { accountCounts[signalRefs[i].s.type] = Number(doc.data()?.accountCount || 0); });
    const benefitCounts: Partial<Record<SignalType | "account", number>> = {};
    counterDocs.forEach((doc, i) => { benefitCounts[counterRefs[i].c.scope] = Number(doc.data()?.successfulClaims || 0) + Object.keys(activeReservations(doc.data()?.activeReservations)).length; });

    const reasons: string[] = [];
    let score = 0;
    if (!actor.emailVerified) { score += 100; reasons.push("EMAIL_NOT_VERIFIED"); }
    if (!signals.some((s) => s.type === "install")) { score += 25; reasons.push("INSTALL_SIGNAL_MISSING"); }
    if (!signals.some((s) => s.type === "device")) { score += 25; reasons.push("DEVICE_SIGNAL_MISSING"); }
    if ((accountCounts.email || 0) >= 1 && !signalDocs.find((d, i) => signalRefs[i].s.type === "email")?.data()?.userIds?.includes(actor.userId)) { score += 80; reasons.push("EMAIL_ALIAS_REUSE"); }
    if ((accountCounts.install || 0) >= 2) { score += 55; reasons.push("MULTI_ACCOUNT_INSTALL"); }
    if ((accountCounts.device || 0) >= 2) { score += 55; reasons.push("MULTI_ACCOUNT_DEVICE"); }
    if ((accountCounts.network || 0) >= 20) { score += 20; reasons.push("HIGH_NETWORK_ACCOUNT_VELOCITY"); }

    for (let i = 0; i < counterRefs.length; i++) {
      const spec = counterRefs[i].c, used = Number(counterDocs[i].data()?.successfulClaims || 0) + Object.keys(activeReservations(counterDocs[i].data()?.activeReservations)).length;
      if (used >= spec.limit) {
        if (spec.scope === "network") { score += 20; reasons.push("NETWORK_FREE_BENEFIT_LIMIT"); }
        else { score += 100; reasons.push(`${String(spec.scope).toUpperCase()}_FREE_BENEFIT_LIMIT`); }
      }
    }
    const deny = score >= 80;
    assessment = { allowed: !deny, score: Math.min(100, score), decision: deny ? "deny" : score >= 40 ? "step_up" : "allow", reasonCodes: [...new Set(reasons)], accountCounts, benefitCounts, emailVerified: Boolean(actor.emailVerified), windowDays };
    if (deny) return;

    const at = now();
    signalRefs.forEach(({ s, ref }, i) => {
      const current = signalDocs[i].data() || {};
      const users = Array.isArray(current.userIds) ? current.userIds.map(String) : [];
      const nextUsers = users.includes(actor.userId) ? users : [...users, actor.userId].slice(-100);
      tx.set(ref, { type: s.type, hash: s.hash, userIds: nextUsers, accountCount: nextUsers.length, firstSeenAt: current.firstSeenAt || at, lastSeenAt: at }, { merge: true });
    });
    const reservationExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    counterRefs.forEach(({ c, ref }, i) => {
      const current = counterDocs[i].data() || {};
      const active = activeReservations(current.activeReservations);
      active[reservationId] = reservationExpiresAt;
      tx.set(ref, { benefit, window: win, scope: c.scope, hash: c.hash, successfulClaims: Number(current.successfulClaims || 0), activeReservations: active, updatedAt: at, createdAt: current.createdAt || at }, { merge: true });
    });
    tx.set(db.collection(RESERVATIONS).doc(reservationId), { id: reservationId, benefit, userId: actor.userId, tenantId: actor.tenantId, status: "active", counterIds: counterRefs.map((x) => x.id), createdAt: at, expiresAt: reservationExpiresAt });
    allowed = true;
  });

  if (!assessment.allowed) {
    await recordEvent({ tenantId: actor.tenantId, userId: actor.userId, benefit, decision: assessment.decision, score: assessment.score, reasonCodes: assessment.reasonCodes, accountCounts: assessment.accountCounts, benefitCounts: assessment.benefitCounts }).catch(() => undefined);
    return { assessment };
  }
  await recordEvent({ tenantId: actor.tenantId, userId: actor.userId, benefit, decision: assessment.decision, score: assessment.score, reasonCodes: assessment.reasonCodes }).catch(() => undefined);
  return { assessment, reservation: allowed ? { id: reservationId, counterIds: counterRefs.map((x) => x.id), benefit, userId: actor.userId } : undefined };
}

export async function finalizeFreeBenefit(reservation: FairUseReservation | undefined, success: boolean) {
  if (!reservation) return;
  const db = getFirestore(), ref = db.collection(RESERVATIONS).doc(reservation.id);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref); if (!doc.exists || doc.data()?.status !== "active") return;
    const counterIds = Array.isArray(doc.data()?.counterIds) ? doc.data()!.counterIds.map(String) : reservation.counterIds;
    const counterRefs = counterIds.map((id: string) => db.collection(COUNTERS).doc(id));
    const counters = await Promise.all(counterRefs.map((r: any) => tx.get(r)));
    counters.forEach((counter, i) => {
      const current = counter.data() || {};
      const active = activeReservations(current.activeReservations);
      delete active[reservation.id];
      tx.set(counterRefs[i], {
        activeReservations: active,
        ...(success ? { successfulClaims: Number(current.successfulClaims || 0) + 1 } : {}),
        updatedAt: now(),
      }, { merge: true });
    });
    tx.set(ref, { status: success ? "consumed" : "released", updatedAt: now(), ...(success ? { consumedAt: now() } : { releasedAt: now() }) }, { merge: true });
  });
}

export async function fairUseMetrics() {
  const db = getFirestore();
  const [eventsSnap, signalsSnap] = await Promise.all([
    db.collection(EVENTS).orderBy("createdAt", "desc").limit(500).get(),
    db.collection(SIGNALS).limit(1000).get(),
  ]);
  const events = eventsSnap.docs.map((d) => d.data());
  const denied = events.filter((x) => x.decision === "deny");
  const stepUps = events.filter((x) => x.decision === "step_up");
  const suspiciousDevices = signalsSnap.docs.map((d) => d.data()).filter((x) => ["install", "device"].includes(String(x.type)) && Number(x.accountCount || 0) >= 2).length;
  return {
    eventsReviewed: events.length,
    deniedBenefits: denied.length,
    stepUpSignals: stepUps.length,
    suspiciousDevices,
    recent: denied.slice(0, 20).map((x) => ({ createdAt: x.createdAt, benefit: x.benefit, score: x.score, reasonCodes: Array.isArray(x.reasonCodes) ? x.reasonCodes.slice(0, 6) : [] })),
  };
}
