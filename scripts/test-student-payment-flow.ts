import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { platformStore } from "../src/server/platform-store";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error("Firebase Auth and Firestore emulators are required");

const projectId = process.env.GCLOUD_PROJECT || "academicos-local";
const tenantId = "student-flow-tenant";
const studentId = "student-flow-user";
const teacherId = "student-flow-teacher";
const academicProjectId = "student-flow-project";
const port = 4183;
const base = `http://127.0.0.1:${port}`;
initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();
const server = spawn("./node_modules/.bin/tsx", ["server.ts"], {
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "development",
    REQUIRE_APP_CHECK: "false",
    REQUIRE_ADMIN_MFA: "false",
    REQUIRE_VIRUS_SCAN: "false",
    REQUIRE_OCR: "false",
    BILLING_PROVIDER: "disabled",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (value) => { output += String(value); });
server.stderr.on("data", (value) => { output += String(value); });

async function waitForServer() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start\n${output}`);
}

async function createUser(uid: string, email: string, role: string) {
  try {
    await auth.createUser({ uid, email, password: "Workflow!12345", emailVerified: true, displayName: uid });
  } catch (error: any) {
    if (error?.code !== "auth/uid-already-exists") throw error;
  }
  await auth.setCustomUserClaims(uid, { role, tenantId });
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "Workflow!12345", returnSecureToken: true }) },
  );
  const body: any = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body.idToken as string;
}

async function api(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init.headers },
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.arrayBuffer();
  return { response, body: body as any };
}

try {
  await waitForServer();
  const [studentToken, teacherToken] = await Promise.all([
    createUser(studentId, "student.flow@academicos.local", "student"),
    createUser(teacherId, "teacher.flow@academicos.local", "professor"),
  ]);
  const at = new Date().toISOString();
  await db.collection("projects").doc(academicProjectId).set({
    id: academicProjectId,
    tenantId,
    userId: studentId,
    title: "مشروع رحلة الدفع",
    course: "BUS 342",
    projectType: "Research report",
    academicDomain: "Business",
    complexity: "medium",
    collaborationMode: "individual",
    requiredSkills: ["Analysis"],
    learningOutcomes: ["Use evidence"],
    requiredActions: ["RESEARCH", "WRITE", "DEFEND"],
    deliverables: [{ id: "deliverable-1", title: "Report", format: "DOCX", status: "not_started" }],
    rubric: [{ id: "rubric-1", title: "Analysis", description: "Quality", weighting: 100, readiness: "not_evidenced" }],
    deadlines: { milestones: [] },
    aiPolicy: { level: 4, summary: "Disclosed drafting", allowed: ["drafting"], prohibited: [], disclosureRequired: true, needsConfirmation: false, provenance: "course_policy" },
    riskFlags: [],
    tasks: [],
    workspaceModules: ["writing"],
    requirements: [],
    status: "not_started",
    progress: 0,
    createdAt: at,
    updatedAt: at,
  });

  const writerBody = JSON.stringify({ mode: "write", assistanceMode: "practice", language: "العربية", desiredPages: 12, academicTone: "clear" });
  const preview = await api(`/api/projects/${academicProjectId}/writer/generate`, studentToken, { method: "POST", body: writerBody });
  assert.equal(preview.response.status, 201, JSON.stringify(preview.body));
  assert.equal(preview.body.document.accessTier, "preview");
  assert.equal(preview.body.document.targetPages, 12);
  const secondFree = await api(`/api/projects/${academicProjectId}/writer/generate`, studentToken, { method: "POST", body: writerBody });
  assert.equal(secondFree.response.status, 402, JSON.stringify(secondFree.body));
  const freeExport = await api(`/api/projects/${academicProjectId}/export?format=docx`, studentToken);
  assert.equal(freeExport.response.status, 402);
  const rawJson = await api(`/api/projects/${academicProjectId}/export?format=json`, studentToken);
  assert.equal(rawJson.response.status, 200);

  await platformStore.grantProjectEntitlement({ tenantId, userId: studentId, projectId: academicProjectId, planId: "project", provider: "stripe", externalId: "cs_basic", eventId: "evt_basic" });
  const basicAccess = await api(`/api/projects/${academicProjectId}/access`, studentToken);
  assert.equal(basicAccess.body.access.canExport, true);
  assert.equal(basicAccess.body.access.canViva, false);
  const full = await api(`/api/projects/${academicProjectId}/writer/generate`, studentToken, { method: "POST", body: writerBody });
  assert.equal(full.response.status, 201, JSON.stringify(full.body));
  assert.equal(full.body.document.accessTier, "paid");
  const fullExport = await api(`/api/projects/${academicProjectId}/export?format=docx`, studentToken);
  assert.equal(fullExport.response.status, 200);
  const basicViva = await api(`/api/projects/${academicProjectId}/viva`, studentToken, { method: "POST", body: JSON.stringify({ mode: "normal" }) });
  assert.equal(basicViva.response.status, 402);

  await platformStore.grantProjectEntitlement({ tenantId, userId: studentId, projectId: academicProjectId, planId: "project_viva", provider: "stripe", externalId: "cs_viva", eventId: "evt_viva" });
  const viva = await api(`/api/projects/${academicProjectId}/viva`, studentToken, { method: "POST", body: JSON.stringify({ mode: "normal" }) });
  assert.equal(viva.response.status, 201, JSON.stringify(viva.body));
  await platformStore.revokeProjectEntitlement({ tenantId, userId: studentId, projectId: academicProjectId, provider: "stripe", externalId: "cs_viva", eventId: "evt_refund_viva", reason: "refunded" });
  const downgraded = await api(`/api/projects/${academicProjectId}/access`, studentToken);
  assert.equal(downgraded.body.access.planId, "project");
  assert.equal(downgraded.body.access.canViva, false);
  await platformStore.revokeProjectEntitlement({ tenantId, userId: studentId, projectId: academicProjectId, provider: "stripe", externalId: "cs_basic", eventId: "evt_refund_basic", reason: "refunded" });
  const revoked = await api(`/api/projects/${academicProjectId}/access`, studentToken);
  assert.equal(revoked.body.access.unlocked, false);

  const course = await api("/api/courses", teacherToken, {
    method: "POST",
    body: JSON.stringify({ code: "BUS 342", title: "إدارة المشاريع", term: "خريف 2026", status: "active", outcomes: [], aiPolicy: { level: 2, summary: "Review only", allowed: ["review"], prohibited: ["full draft"], disclosureRequired: true, needsConfirmation: false } }),
  });
  assert.equal(course.response.status, 201, JSON.stringify(course.body));
  assert.equal(course.body.course.aiPolicy.level, 2);
  const joinCode = await api(`/api/courses/${course.body.course.id}/join-codes`, teacherToken, { method: "POST", body: JSON.stringify({ maxUses: 200, expiresInDays: 120 }) });
  assert.equal(joinCode.response.status, 201, JSON.stringify(joinCode.body));
  const joined = await api("/api/enrollments/join", studentToken, { method: "POST", body: JSON.stringify({ code: joinCode.body.secret }) });
  assert.equal(joined.response.status, 201, JSON.stringify(joined.body));

  console.log(JSON.stringify({ previewOnce: true, secondPreviewBlocked: true, exportGated: true, rawExportAvailable: true, paidWriter: true, wordExport: true, vivaTierGated: true, refundDowngrade: true, refundRevoked: true, teacherLiteCreate: true, teacherStudentLink: true }));
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => { server.once("exit", resolve); setTimeout(resolve, 2000); });
}
