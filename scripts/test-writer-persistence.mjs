// Regression guard for POST /api/projects/:id/writer/generate persistence.
//
// The route re-persists an existing project after composing the document. It
// must use the transactional `updateProject` path, never the create-only
// `saveProject` path. `saveProject` re-emits the project graph edges with fresh
// ids, writes a duplicate "Initial project state" v1 snapshot and never advances
// `revision`, so calling the route twice on the same project corrupted the graph
// and version history.
//
// With the fix, generating twice leaves zero duplicated graph edges, produces no
// duplicate versionNumber===1 snapshot and advances the project revision.
// Against the previous (buggy) code this test fails: edges become 8 and two v1
// snapshots appear while revision stays 1.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error("Firebase Auth and Firestore emulators are required");

const projectId = process.env.GCLOUD_PROJECT || "academicos-local";
const tenantId = "writer-persistence-tenant";
const uid = "writer-persistence-student";
const port = 4183;
const base = `http://127.0.0.1:${port}`;
const pid = `writer-persistence-project`;

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
server.stdout.on("data", (x) => (output += x));
server.stderr.on("data", (x) => (output += x));

async function wait() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not start\n${output}`);
}

async function token() {
  try {
    await auth.createUser({
      uid,
      email: "writer.persistence@academicos.local",
      password: "Persist!12345",
      emailVerified: true,
      displayName: "Writer Persistence",
    });
  } catch (e) {
    if (e?.code !== "auth/uid-already-exists") throw e;
  }
  await auth.setCustomUserClaims(uid, { role: "student", tenantId });
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "writer.persistence@academicos.local",
        password: "Persist!12345",
        returnSecureToken: true,
      }),
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body.idToken;
}

// The create-only saveProject path emits `requires` edges from the project node
// to each deliverable. The fixed updateProject path never touches the graph, so
// these must stay at 0 for a project whose graph was not (re)created here.
const countProjectRequiresEdges = async () =>
  (await db.collection("graphEdges").where("projectId", "==", pid).get()).docs.filter(
    (d) => d.data().relation === "requires" && d.data().from === `project_${pid}`,
  ).length;
const versionNumbers = async () =>
  (await db.collection("artifactVersions").where("projectId", "==", pid).get()).docs.map(
    (d) => d.data().versionNumber,
  );
const revision = async () =>
  (await db.collection("projects").doc(pid).get()).data().revision;

try {
  await wait();
  const at = new Date().toISOString();
  const idToken = await token();

  // Seed an existing, already-persisted project owned by the student.
  await db.collection("projects").doc(pid).set({
    id: pid,
    revision: 1,
    tenantId,
    userId: uid,
    title: "Writer Persistence",
    course: "WP101",
    projectType: "report",
    academicDomain: "General",
    complexity: "medium",
    collaborationMode: "individual",
    requiredSkills: [],
    learningOutcomes: ["O1"],
    requiredActions: ["WRITE"],
    workspaceModules: ["writing"],
    requirements: [],
    deliverables: [
      { id: "d1", title: "Report", format: "PDF" },
      { id: "d2", title: "Appendix", format: "PDF" },
    ],
    rubric: [
      { id: "r1", title: "Analysis", description: "Quality", weighting: 60 },
      { id: "r2", title: "Evidence", description: "Traceability", weighting: 40 },
    ],
    tasks: [],
    deadlines: { milestones: [] },
    aiPolicy: {
      level: 0,
      summary: "None",
      allowed: [],
      prohibited: [],
      disclosureRequired: false,
      needsConfirmation: true,
    },
    riskFlags: [],
    status: "not_started",
    progress: 0,
    createdAt: at,
    updatedAt: at,
  });

  // Paid entitlement so both generations are allowed (not preview-gated).
  await db.collection("platform_entitlements").doc("writer-persistence-entitlement").set({
    id: "writer-persistence-entitlement",
    resource: "entitlements",
    tenantId,
    ownerId: uid,
    status: "active",
    title: "AcademicOS project",
    data: { kind: "project", projectId: pid, planId: "project" },
    version: 1,
    createdBy: "test",
    updatedBy: "test",
    createdAt: at,
    updatedAt: at,
  });

  const generate = async () => {
    const r = await fetch(`${base}/api/projects/${pid}/writer/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ mode: "write", assistanceMode: "practice", desiredPages: 5 }),
    });
    const body = await r.json().catch(() => ({}));
    assert.ok(
      r.status === 200 || r.status === 201,
      `generate failed: ${r.status} ${JSON.stringify(body)}\n${output}`,
    );
  };

  await generate();
  await generate();

  const requiresEdges = await countProjectRequiresEdges();
  const versions = await versionNumbers();
  const rev = await revision();

  assert.equal(
    requiresEdges,
    0,
    `writer/generate must not re-emit project graph edges (got ${requiresEdges})`,
  );
  assert.equal(
    versions.filter((v) => v === 1).length,
    0,
    `writer/generate must not write duplicate v1 "Initial project state" snapshots (got versions ${JSON.stringify(versions)})`,
  );
  assert.equal(rev, 3, `two generations must advance revision 1 -> 3 (got ${rev})`);

  console.log(
    JSON.stringify({
      writerPersistenceRoute: "passed",
      projectRequiresEdges: requiresEdges,
      versions,
      revision: rev,
    }),
  );
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    server.once("exit", resolve);
    setTimeout(resolve, 2000);
  });
}
