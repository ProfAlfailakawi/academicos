import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { DemoSandbox, DEMO_SESSION_TTL_MS, DEMO_TENANT_ID } from "../src/server/demoSandbox";
import { registerTeacherRequestRoutes } from "../src/server/routes/teacher-requests";
import { registerPublicShareRoutes } from "../src/server/routes/public-share";

/*
 * Two server-side guards, tested through the real route modules on a throwaway
 * express app (no Firebase app is initialised here, so any call that reaches the
 * real Firestore throws):
 *  - a demo actor on /api/teacher-requests/mine is served from its own sandbox;
 *  - /api/public/share/:token answers with JSON and never crashes on a missing,
 *    malformed or backend-failing lookup.
 */

async function serve(app: express.Express) {
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const VALID_SHAPE = `share_${"A".repeat(32)}`;

test("teacher-requests/mine serves a demo actor from the sandbox, not the real Firestore", async () => {
  const token = DemoSandbox.create();
  const app = express();
  const authenticate: any = (req: any, _res: any, next: any) => {
    req.actor = { userId: "demo_user_student_1", tenantId: DEMO_TENANT_ID, role: "student", displayName: "Demo" };
    DemoSandbox.run(token, DEMO_SESSION_TTL_MS, next);
  };
  registerTeacherRequestRoutes(app, { authenticate, apiRateLimit: (_q: any, _s: any, n: any) => n(), requireRoles: () => (_q: any, _s: any, n: any) => n(), requireRecentPrivilegedAuth: (_q: any, _s: any, n: any) => n() } as any);
  const { base, close } = await serve(app);
  try {
    const res = await fetch(`${base}/api/teacher-requests/mine`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { success: true, request: null });
  } finally {
    await close();
    DemoSandbox.destroy(token);
  }
});

test("teacher-requests/mine for a non-demo actor still goes to the real Firestore", async () => {
  const app = express();
  const authenticate: any = (req: any, _res: any, next: any) => {
    req.actor = { userId: "u1", tenantId: "individual_u1", role: "student", displayName: "S" };
    next();
  };
  registerTeacherRequestRoutes(app, { authenticate, apiRateLimit: (_q: any, _s: any, n: any) => n(), requireRoles: () => (_q: any, _s: any, n: any) => n(), requireRecentPrivilegedAuth: (_q: any, _s: any, n: any) => n() } as any);
  app.use((_e: any, _q: any, res: any, _n: any) => res.status(500).json({ reachedRealFirestore: true }));
  const { base, close } = await serve(app);
  try {
    const res = await fetch(`${base}/api/teacher-requests/mine`);
    assert.equal(res.status, 500, "no Firebase app here, so the real path must fail");
    assert.deepEqual(await res.json(), { reachedRealFirestore: true });
  } finally {
    await close();
  }
});

function shareApp(resolvePublicShare: (t: string, p?: string) => Promise<any>) {
  const app = express();
  app.use(express.json());
  registerPublicShareRoutes(app, { resolvePublicShare, cleanField: (v: any) => String(v ?? "") });
  return app;
}

test("share route: malformed token is a 404 without any lookup", async () => {
  let calls = 0;
  const { base, close } = await serve(shareApp(async () => { calls++; return null; }));
  try {
    for (const t of ["bogus", "share_short", `share_${"A".repeat(500)}`]) {
      const res = await fetch(`${base}/api/public/share/${t}`);
      assert.equal(res.status, 404);
      assert.equal((await res.json()).code, "SHARE_NOT_FOUND");
    }
    assert.equal(calls, 0);
  } finally {
    await close();
  }
});

test("share route: unknown well-formed token is a 404", async () => {
  const { base, close } = await serve(shareApp(async () => null));
  try {
    const res = await fetch(`${base}/api/public/share/${VALID_SHAPE}`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).code, "SHARE_NOT_FOUND");
  } finally {
    await close();
  }
});

test("share route: backend failure is a 503 JSON and the log never contains the token", async () => {
  const logged: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };
  const { base, close } = await serve(
    shareApp(async () => { throw Object.assign(new Error("Could not load the default credentials"), { code: "7" }); }),
  );
  try {
    for (const method of ["GET", "POST"]) {
      const url = `${base}/api/public/share/${VALID_SHAPE}${method === "POST" ? "/access" : ""}`;
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, "SHARE_UNAVAILABLE");
    }
    assert.ok(logged.some((l) => l.includes("public_share_backend_failed")));
    assert.ok(!logged.join("\n").includes(VALID_SHAPE), "token must not be logged");
  } finally {
    console.error = original;
    await close();
  }
});

test("share route: a valid token returns the same payload as before", async () => {
  const { base, close } = await serve(
    shareApp(async () => ({ kind: "report", label: "L", createdAt: "c", expiresAt: "e", watermark: "w", viewCount: 3, snapshot: { a: 1 } })),
  );
  try {
    const res = await fetch(`${base}/api/public/share/${VALID_SHAPE}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await res.json(), {
      success: true,
      share: { kind: "report", label: "L", createdAt: "c", expiresAt: "e", watermark: "w", viewCount: 3, snapshot: { a: 1 } },
    });
  } finally {
    await close();
  }
});

test("share route: password-protected token still answers 401/403 as before", async () => {
  const { base, close } = await serve(shareApp(async (_t, p) => ({ passwordRequired: true, passwordInvalid: Boolean(p) })));
  try {
    assert.equal((await fetch(`${base}/api/public/share/${VALID_SHAPE}`)).status, 401);
    const res = await fetch(`${base}/api/public/share/${VALID_SHAPE}/access`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "x" }),
    });
    assert.equal(res.status, 403);
  } finally {
    await close();
  }
});
