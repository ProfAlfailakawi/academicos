import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEMO_ACTORS, DEMO_TENANT_ID, DemoSandbox } from "../src/server/demoSandbox";
import { buildDashboard, buildPassport, buildSkills, firestoreStore } from "../src/server/db";
import { platformStore } from "../src/server/platform-store";
import { listNotifications } from "../src/server/notifications";
import { fairUseMetrics } from "../src/server/abuse-guard";

/*
 * Every screen a demo visitor can reach must open on data, for every role the
 * demo lets them switch to. These assertions read through the same store
 * methods the routes use, inside a real sandbox, so a seed that stops reaching
 * a screen fails here instead of on the live site.
 */

function inSandbox<T>(fn: () => Promise<T>): Promise<T> {
  const token = DemoSandbox.create();
  return new Promise<T>((resolve, reject) => {
    const ran = DemoSandbox.run(token, 60_000, () => {
      fn().then(resolve, reject).finally(() => DemoSandbox.destroy(token));
    });
    if (!ran) reject(new Error("sandbox expired"));
  });
}

for (const [key, actor] of Object.entries(DEMO_ACTORS)) {
  test(`demo role "${key}" has data on every shared screen`, () =>
    inSandbox(async () => {
      const { userId, role, email } = actor;
      const notifications = await listNotifications(DEMO_TENANT_ID, userId, role as any);
      assert.ok(notifications.length >= 3, "notifications");
      assert.ok((await firestoreStore.listPendingInvitations(email, DEMO_TENANT_ID)).length >= 1, "invitations");
      assert.ok((await platformStore.listJobs(DEMO_TENANT_ID, userId)).length >= 1, "jobs");
      assert.ok((await firestoreStore.listMySupportTickets(userId, DEMO_TENANT_ID)).length >= 1, "support tickets");
      const dashboard = await buildDashboard(userId, DEMO_TENANT_ID);
      assert.ok(dashboard.projects.length >= 1, "projects");
      assert.ok(dashboard.upcoming.length >= 1, "calendar / upcoming");
    }));
}

test("the demo student has a full workspace, skills, passport and archive", () =>
  inSandbox(async () => {
    const { userId, displayName } = DEMO_ACTORS.student;
    const projects = await firestoreStore.listProjects(userId, DEMO_TENANT_ID);
    assert.ok(projects.some((p) => p.status === "completed"), "archive has a completed project");
    for (const p of projects.filter((x) => x.userId === userId)) {
      assert.ok(p.tasks.length && p.deliverables.length && p.rubric.length && p.requirements.length, `structure of ${p.id}`);
      const artifacts = await firestoreStore.listWorkspaceArtifacts(p.id, DEMO_TENANT_ID);
      assert.ok(artifacts.some((a) => a.kind === "academic-document-manifest"), `writer document of ${p.id}`);
      assert.ok((await firestoreStore.listProjectEvidence(p.id, userId, DEMO_TENANT_ID)).length >= 3, `sources of ${p.id}`);
      assert.ok((await firestoreStore.listProjectActivity(p.id, DEMO_TENANT_ID)).length >= 1, `timeline of ${p.id}`);
    }
    assert.ok((await firestoreStore.listProjectMembers("demo_project_1_1", DEMO_TENANT_ID)).length >= 3, "team");
    assert.ok((await buildSkills(userId, DEMO_TENANT_ID)).length >= 1, "skills");
    const passport = await buildPassport(userId, DEMO_TENANT_ID, displayName);
    assert.ok(passport.projects.length && passport.credentials.length, "passport");
    assert.ok((await platformStore.listPublicShares(DEMO_TENANT_ID, userId)).length >= 1, "shares");
  }));

test("institution admin screens have records", () =>
  inSandbox(async () => {
    assert.ok((await platformStore.list("institutions", DEMO_TENANT_ID)).length >= 1, "platform hub");
    assert.ok((await platformStore.list("programs", DEMO_TENANT_ID)).length >= 1, "curriculum twin programs");
    const metrics = await platformStore.metrics(DEMO_TENANT_ID);
    assert.ok(metrics.ai.runs > 0 && metrics.activation > 0, "control plane metrics");
    assert.ok((await fairUseMetrics()).recent.length >= 1, "fair use");
  }));

/*
 * A notification that opens "Course not found" is worse than no notification.
 * Every seeded link must resolve for the very actor it was sent to, using the
 * same ownership / membership rules the API routes apply.
 */
const COURSE_ADMIN_ROLES = new Set(["department_admin", "college_admin", "university_admin", "admin", "superadmin", "root_owner"]);
for (const [key, actor] of Object.entries(DEMO_ACTORS)) {
  test(`every demo notification link resolves for "${key}"`, () =>
    inSandbox(async () => {
      const { userId, role } = actor;
      const notifications = await listNotifications(DEMO_TENANT_ID, userId, role as any);
      for (const n of notifications as any[]) {
        const target = String(n.targetPath || "");
        if (!target) continue;
        const path = target.split("?")[0];
        const course = path.match(/^\/app\/course\/([^/]+)(?:\/assignment\/([^/]+)\/submissions)?$/);
        if (course) {
          const record = await firestoreStore.getCourse(course[1], DEMO_TENANT_ID);
          assert.ok(record, `${target}: course exists`);
          assert.ok(record!.ownerId === userId || COURSE_ADMIN_ROLES.has(role), `${target}: readable by ${userId}`);
          if (course[2]) {
            const assignments = await firestoreStore.listCourseAssignments(course[1], DEMO_TENANT_ID);
            assert.ok(assignments.some((a: any) => a.id === course[2]), `${target}: assignment exists`);
          }
          continue;
        }
        const project = path.match(/^\/app\/project\/([^/]+)$/);
        if (project) {
          assert.ok(await firestoreStore.getProject(project[1], userId, DEMO_TENANT_ID), `${target}: project readable by ${userId}`);
          continue;
        }
        assert.match(path, /^\/app(\/[a-z-]+)?$/, `${target}: known static screen`);
      }
    }));
}

test("sandboxes share the frozen seed and copy only on write", () => {
  const a = DemoSandbox.create();
  const b = DemoSandbox.create();
  try {
    let wrote = false;
    DemoSandbox.run(a, 60_000, () => {
      const store = DemoSandbox.currentFirestore()!;
      store.collection("courses").doc("demo_course_1").updateSync({ title: "changed in A" });
      wrote = store.collection("courses").doc("demo_course_1").readSync().data()!.title === "changed in A";
    });
    assert.ok(wrote, "write visible in its own sandbox");
    DemoSandbox.run(b, 60_000, () => {
      const title = DemoSandbox.currentFirestore()!.collection("courses").doc("demo_course_1").readSync().data()!.title;
      assert.notEqual(title, "changed in A", "write must not leak into another sandbox");
    });
  } finally {
    DemoSandbox.destroy(a);
    DemoSandbox.destroy(b);
  }
});
