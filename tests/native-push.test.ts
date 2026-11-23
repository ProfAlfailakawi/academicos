import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { EventEmitter } from "node:events";
import { createDemoFirestore } from "../src/server/demoFirestore";
import { createApnsSender, apnsPayload } from "../src/server/apns-push";
import {
  deviceId, devicesFor, pushForNotification, pushToUser, removeDevice, saveDevice, setNativePushTestHooks,
} from "../src/server/native-push";

/*
 * تنبيهات iOS (APNs) بعميل HTTP/2 محاكى ومخزنٍ في الذاكرة — لا اتصال بـ Apple ولا بـ Firestore.
 */

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);
const TENANT = "t1";

function fakeApns(replies: Record<string, { status: number; reason?: string }> = {}) {
  const sent: { headers: Record<string, string>; body: string }[] = [];
  const connect = () => {
    const client: any = new EventEmitter();
    client.close = () => undefined;
    client.request = (headers: Record<string, string>) => {
      const request: any = new EventEmitter();
      request.setEncoding = () => undefined;
      request.end = (body: string) => {
        sent.push({ headers, body });
        const token = String(headers[":path"]).split("/").pop() || "";
        const reply = replies[token] || { status: 200 };
        setImmediate(() => {
          request.emit("response", { ":status": reply.status });
          if (reply.reason) request.emit("data", JSON.stringify({ reason: reply.reason }));
          request.emit("end");
        });
      };
      return request;
    };
    return client;
  };
  return { sent, connect };
}

const key = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const apnsEnv = { APNS_KEY_P8: key.replace(/\n/g, "\\n"), APNS_KEY_ID: "KEYID12345", APNS_TEAM_ID: "TEAMID1234", APNS_TOPIC: "com.dralfailakawi.academicos" };
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test("without APNs env nothing is sent", async () => {
  const fake = fakeApns();
  setNativePushTestHooks({ store: createDemoFirestore(), sender: createApnsSender({ env: () => ({}), connect: fake.connect as never }) });
  await saveDevice(TENANT, "u1", TOKEN_A);
  assert.deepEqual(await pushToUser(TENANT, "u1", { title: "x" }), { sent: 0, dropped: 0 });
  assert.equal(fake.sent.length, 0);
});

test("sends with the app topic and drops tokens Apple rejects", async () => {
  const fake = fakeApns({ [TOKEN_B]: { status: 410, reason: "Unregistered" } });
  setNativePushTestHooks({ store: createDemoFirestore(), sender: createApnsSender({ env: () => apnsEnv, connect: fake.connect as never }) });
  await saveDevice(TENANT, "u1", TOKEN_A);
  await saveDevice(TENANT, "u1", TOKEN_B);
  assert.deepEqual(await pushToUser(TENANT, "u1", { title: "درجة", url: "/app/courses" }), { sent: 1, dropped: 1 });
  assert.equal(fake.sent[0].headers["apns-topic"], "com.dralfailakawi.academicos");
  assert.deepEqual(await devicesFor(TENANT, "u1"), [TOKEN_A]);

  const bad = fakeApns({ [TOKEN_A]: { status: 400, reason: "BadDeviceToken" } });
  setNativePushTestHooks({ sender: createApnsSender({ env: () => apnsEnv, connect: bad.connect as never }) });
  await pushToUser(TENANT, "u1", { title: "x" });
  assert.deepEqual(await devicesFor(TENANT, "u1"), []);
});

test("a new personal notification pushes its targetPath; push=false silences it", async () => {
  const store = createDemoFirestore();
  const fake = fakeApns();
  setNativePushTestHooks({ store, sender: createApnsSender({ env: () => apnsEnv, connect: fake.connect as never }) });
  await saveDevice(TENANT, "student", TOKEN_A);
  pushForNotification({ id: "n1", tenantId: TENANT, userId: "student", type: "assignment", title: "نُشرت درجتك", body: "المقال", targetPath: "/app/project/p1" });
  await settle();
  assert.equal(fake.sent.length, 1);
  const payload = JSON.parse(fake.sent[0].body);
  assert.equal(payload.url, "/app/project/p1");
  assert.equal(payload.aps.alert.title, "نُشرت درجتك");

  /* مسارٌ خارجي لا يُمرَّر: يفتح الإشعارات بدلاً منه. */
  pushForNotification({ id: "n2", tenantId: TENANT, userId: "student", title: "x", targetPath: "//evil.example" });
  await settle();
  assert.equal(JSON.parse(fake.sent[1].body).url, "/app/notifications");

  /* مستخدمٌ آخر في المؤسسة لا يتلقّى، ولا من مؤسسةٍ أخرى. */
  pushForNotification({ id: "n3", tenantId: "t2", userId: "student", title: "x" });
  await settle();
  assert.equal(fake.sent.length, 2);

  await store.collection("notificationPreferences").doc(`${TENANT}__student`).set({ push: false });
  pushForNotification({ id: "n4", tenantId: TENANT, userId: "student", title: "x" });
  await settle();
  assert.equal(fake.sent.length, 2);
  assert.ok(apnsPayload({ title: "t" }).includes('"sound":"default"'));
});

test("only the owner can remove a device", async () => {
  setNativePushTestHooks({ store: createDemoFirestore() });
  await saveDevice(TENANT, "owner", TOKEN_A);
  assert.equal(await removeDevice(TOKEN_A, { tenantId: TENANT, userId: "intruder" }), false);
  assert.equal(await removeDevice(TOKEN_A, { tenantId: TENANT, userId: "owner" }), true);
  assert.deepEqual(await devicesFor(TENANT, "owner"), []);
  assert.match(deviceId(TOKEN_A.toUpperCase()), /^[0-9a-f]{64}$/);
  setNativePushTestHooks({ store: null, sender: null });
});
