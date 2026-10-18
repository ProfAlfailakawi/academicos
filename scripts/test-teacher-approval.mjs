// End-to-end check of the teacher-account approval flow against the Auth +
// Firestore emulators and a real server process (real tokens and claims).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error("Firebase Auth and Firestore emulators are required");
const projectId = process.env.GCLOUD_PROJECT || "academicos-local",
  port = 4184,
  base = `http://127.0.0.1:${port}`,
  password = "TeacherFlow!12345";
initializeApp({ projectId });
const auth = getAuth(), db = getFirestore();
const server = spawn("./node_modules/.bin/tsx", ["server.ts"], {
  env: { ...process.env, PORT: String(port), NODE_ENV: "development", REQUIRE_APP_CHECK: "false", REQUIRE_ADMIN_MFA: "false", REQUIRE_VIRUS_SCAN: "false", REQUIRE_OCR: "false", BILLING_PROVIDER: "disabled", API_RATE_LIMIT_PER_MINUTE: "100000", API_WRITE_RATE_LIMIT_PER_MINUTE: "100000", API_USER_RATE_LIMIT_PER_MINUTE: "100000" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (x) => (output += x));
server.stderr.on("data", (x) => (output += x));
async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not start\n${output}`);
}
async function user(uid, role, tenantId) {
  const email = `${uid}@teacher-flow.test`;
  try { await auth.createUser({ uid, email, password, emailVerified: true, displayName: `User ${uid}` }); } catch (e) { if (e?.code !== "auth/uid-already-exists") throw e; }
  await auth.setCustomUserClaims(uid, { role, tenantId });
  return email;
}
async function token(email) {
  const r = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const b = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(b));
  return b.idToken;
}
async function api(path, tok, init = {}) {
  const r = await fetch(`${base}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${tok}`, ...init.headers } });
  return { s: r.status, j: await r.json().catch(() => ({})) };
}
const roleOf = async (uid) => (await auth.getUser(uid)).customClaims?.role;
try {
  await waitUp();
  const run = Date.now().toString(36);
  const ids = { a: `tf-applicant-${run}`, b: `tf-other-${run}`, c: `tf-rejectee-${run}`, root: `tf-root-${run}`, sup: `tf-super-${run}`, uni: `tf-uni-${run}`, prof: `tf-prof-${run}` };
  const emails = {
    a: await user(ids.a, "student", `individual_${ids.a}`), b: await user(ids.b, "student", `individual_${ids.b}`), c: await user(ids.c, "student", `individual_${ids.c}`),
    root: await user(ids.root, "root_owner", "platform"), sup: await user(ids.sup, "superadmin", "platform"), uni: await user(ids.uni, "university_admin", "uni-x"), prof: await user(ids.prof, "professor", "uni-x"),
  };
  const T = Object.fromEntries(await Promise.all(Object.entries(emails).map(async ([k, e]) => [k, await token(e)])));

  // 1. Student files a request; a role/status in the body is ignored; the account stays a student.
  assert.equal((await api("/api/courses", T.a)).s, 403, "student has no teacher workspace yet");
  const filed = await api("/api/teacher-requests", T.a, { method: "POST", body: JSON.stringify({ institution: "جامعة الكويت", note: "أحاضر في قسم الحاسوب", role: "professor", status: "approved" }) });
  assert.equal(filed.s, 201, JSON.stringify(filed.j));
  assert.equal(filed.j.request.status, "pending");
  assert.equal(await roleOf(ids.a), "student");
  assert.equal((await api("/api/teacher-requests", T.a, { method: "POST", body: JSON.stringify({ institution: "جامعة الخليج" }) })).s, 200, "update of a pending request is idempotent");
  assert.equal((await api("/api/teacher-requests", T.a, { method: "POST", body: JSON.stringify({}) })).s, 400);
  assert.equal((await api("/api/teacher-requests/mine", T.a)).j.request.status, "pending");

  // 2. No self-promotion: profile PATCH ignores role, nobody but owners can decide.
  const patched = await api("/api/profile", T.a, { method: "PATCH", body: JSON.stringify({ role: "professor", customClaims: { role: "professor" }, displayName: "Applicant" }) });
  assert.equal(patched.s, 200);
  assert.equal(await roleOf(ids.a), "student");
  const decision = (id, tok, body) => api(`/api/admin/teacher-requests/${encodeURIComponent(id)}/decision`, tok, { method: "POST", body: JSON.stringify(body) });
  assert.equal((await decision(ids.a, T.a, { decision: "approve" })).s, 403, "applicant cannot approve herself");
  assert.equal((await decision(ids.a, T.b, { decision: "approve" })).s, 403, "other student cannot approve");
  assert.equal((await decision(ids.a, T.prof, { decision: "approve" })).s, 403, "teacher cannot approve");
  assert.equal((await decision(ids.a, T.uni, { decision: "approve" })).s, 403, "tenant admin cannot approve");
  assert.equal((await api("/api/admin/teacher-requests", T.a)).s, 403);
  assert.equal((await api("/api/admin/teacher-requests", T.uni)).s, 403);
  assert.equal(await roleOf(ids.a), "student");

  // 3. Owners see the queue and approve: the role arrives server-side, audit + notification written.
  const queue = await api("/api/admin/teacher-requests?status=pending", T.root);
  assert.equal(queue.s, 200);
  assert.ok(queue.j.requests.some((r) => r.id === ids.a));
  assert.equal((await decision(ids.a, T.root, { decision: "reject" })).s, 400, "reject needs a reason");
  assert.equal((await decision(ids.a, T.root, { decision: "approve", reason: "تم التحقق" })).s, 200);
  assert.equal(await roleOf(ids.a), "professor");
  assert.equal((await decision(ids.a, T.root, { decision: "approve" })).s, 409, "already decided");
  const audit = await db.collection("auditLogs").where("target", "==", ids.a).get();
  assert.ok(audit.docs.some((d) => d.data().action === "teacher_request.approve" && d.data().actor === ids.root), "approval is audited");
  const notes = await db.collection("notifications").where("userId", "==", ids.a).get();
  assert.ok(notes.docs.some((d) => /المعلم|teacher/i.test(d.data().title)), "applicant is notified");
  const refreshed = await token(emails.a);
  assert.equal((await api("/api/courses", refreshed)).s, 200, "teacher workspace works after the token refresh");

  // 4. Rejection: reason is required and delivered, account stays a student, a new request is allowed.
  await api("/api/teacher-requests", T.c, { method: "POST", body: JSON.stringify({ institution: "Somewhere" }) });
  const rejected = await decision(ids.c, T.sup, { decision: "reject", reason: "البريد غير مؤسسي" });
  assert.equal(rejected.s, 200, JSON.stringify(rejected.j));
  assert.equal(await roleOf(ids.c), "student");
  const mine = await api("/api/teacher-requests/mine", T.c);
  assert.equal(mine.j.request.status, "rejected");
  assert.equal(mine.j.request.reason, "البريد غير مؤسسي");
  const rn = await db.collection("notifications").where("userId", "==", ids.c).get();
  assert.ok(rn.docs.some((d) => String(d.data().body).includes("البريد غير مؤسسي")), "rejection reason reaches the applicant");
  const again = await api("/api/teacher-requests", T.c, { method: "POST", body: JSON.stringify({ institution: "جامعة الكويت" }) });
  assert.equal(again.s, 200);
  assert.equal(again.j.request.status, "pending");
  assert.equal(await roleOf(ids.c), "student");

  // 5. A professor cannot file a request; a platform owner cannot approve a missing request.
  assert.equal((await api("/api/teacher-requests", refreshed, { method: "POST", body: JSON.stringify({ institution: "Uni" }) })).s, 409);
  assert.equal((await decision("tf-ghost", T.root, { decision: "approve" })).s, 404);
  console.log(JSON.stringify({ teacherApproval: true, selfPromotionBlocked: true, ownersOnly: true, approvalGrantsRoleServerSide: true, auditAndNotification: true, rejectionWithReason: true, retryAfterRejection: true }));
} finally {
  server.kill("SIGTERM");
  await new Promise((r) => { server.once("exit", r); setTimeout(r, 2000); });
}
