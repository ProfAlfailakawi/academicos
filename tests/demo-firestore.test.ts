import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createDemoFirestore } from "../src/server/demoFirestore";

/*
 * The demo sandbox is reachable by anyone who presses "try the demo", and the
 * documents it stores come from request bodies. These tests pin the two
 * properties that keep that from being dangerous: nothing a caller writes can
 * escape its own sandbox, and the query surface fails loudly rather than
 * answering a question it cannot actually answer.
 */

test("a crafted document cannot pollute Object.prototype through set(merge)", async () => {
  const store = createDemoFirestore();
  const ref = store.collection("projects").doc("p1");
  await ref.set({ title: "seed" });

  // JSON.parse keeps __proto__ as an own property, which is exactly how a
  // request body reaches the merge path.
  const hostile = JSON.parse('{"__proto__":{"pollutedViaMerge":"yes"}}');
  await ref.set(hostile, { merge: true });

  assert.equal(
    ({} as Record<string, unknown>).pollutedViaMerge,
    undefined,
    "Object.prototype was polluted — this escapes the sandbox process-wide",
  );
  const stored = (await ref.get()).data();
  assert.equal(stored?.title, "seed", "the legitimate field survived");
  assert.ok(
    !Object.prototype.hasOwnProperty.call(stored || {}, "__proto__"),
    "the forbidden key was dropped rather than stored",
  );
});

test("a crafted document cannot pollute Object.prototype through update()", async () => {
  const store = createDemoFirestore();
  const ref = store.collection("projects").doc("p2");
  await ref.set({ title: "seed" });

  await ref.update(JSON.parse('{"__proto__":{"pollutedViaUpdate":"yes"}}'));
  await ref.update({ "constructor.prototype.pollutedViaPath": "yes" });

  assert.equal(({} as Record<string, unknown>).pollutedViaUpdate, undefined);
  assert.equal(({} as Record<string, unknown>).pollutedViaPath, undefined);
});

test("a document key that merely looks nested is still written normally", async () => {
  const store = createDemoFirestore();
  const ref = store.collection("projects").doc("p3");
  await ref.set({ title: "seed" });
  await ref.update({ "deadlines.final": "2027-01-01" });

  const stored = (await ref.get()).data() as Record<string, any>;
  assert.equal(stored.deadlines.final, "2027-01-01");
  assert.equal(stored.title, "seed");
});

test("stored documents are copies, so a caller cannot mutate the sandbox by reference", async () => {
  const store = createDemoFirestore();
  const ref = store.collection("projects").doc("p4");
  const input: Record<string, unknown> = { title: "original" };
  await ref.set(input);
  input.title = "mutated after the write";

  const first = (await ref.get()).data() as Record<string, unknown>;
  assert.equal(first.title, "original");
  first.title = "mutated through the snapshot";
  assert.equal(((await ref.get()).data() as Record<string, unknown>).title, "original");
});

test("an unsupported query operator throws instead of silently returning wrong rows", async () => {
  const store = createDemoFirestore();
  assert.throws(
    () => store.collection("projects").where("score", ">=", 10),
    /only "==" filters/,
    "a demo that quietly answers the wrong question is worse than one that errors",
  );
});

test("queries filter, order and limit the way the store expects", async () => {
  const store = createDemoFirestore();
  store.seed("projects", [
    { id: "a", data: { tenantId: "t1", updatedAt: "2027-01-03", title: "c" } },
    { id: "b", data: { tenantId: "t1", updatedAt: "2027-01-01", title: "a" } },
    { id: "c", data: { tenantId: "t2", updatedAt: "2027-01-02", title: "b" } },
  ]);

  const scoped = await store
    .collection("projects")
    .where("tenantId", "==", "t1")
    .orderBy("updatedAt", "desc")
    .get();
  assert.deepEqual(scoped.docs.map((d) => d.id), ["a", "b"]);

  const limited = await store.collection("projects").limit(2).get();
  assert.equal(limited.size, 2);

  const counted = await store.collection("projects").where("tenantId", "==", "t1").count().get();
  assert.equal(counted.data().count, 2);
});

test("a failed transaction does not wedge the ones behind it", async () => {
  const store = createDemoFirestore();
  const ref = store.collection("projects").doc("p5");
  await ref.set({ runs: 0 });

  await assert.rejects(
    store.runTransaction(async () => {
      throw new Error("boom");
    }),
    /boom/,
  );

  // The serial queue must advance past the rejection, or every later write in
  // the session would hang behind it.
  await store.runTransaction(async (tx) => {
    tx.set(ref, { runs: 1 });
  });
  assert.equal((await ref.get()).data()?.runs, 1);
});

test("a batch applies together and a transaction's writes land only at the end", async () => {
  const store = createDemoFirestore();
  const one = store.collection("projects").doc("b1");
  const two = store.collection("projects").doc("b2");

  const batch = store.batch();
  batch.set(one, { n: 1 });
  batch.set(two, { n: 2 });
  assert.equal((await one.get()).exists, false, "nothing is visible before commit");
  await batch.commit();
  assert.equal((await one.get()).data()?.n, 1);
  assert.equal((await two.get()).data()?.n, 2);

  await store.runTransaction(async (tx) => {
    const current = await tx.get(one);
    tx.set(one, { n: Number(current.data()?.n || 0) + 10 });
  });
  assert.equal((await one.get()).data()?.n, 11);
});

test("FieldValue.increment and FieldValue.delete behave like Firestore, not as stored objects", async () => {
  const { FieldValue } = await import("firebase-admin/firestore");
  const store = createDemoFirestore();
  const ref = store.collection("tenantCounters").doc("c1");
  await ref.set({ value: FieldValue.increment(2), note: "x" }, { merge: true });
  await ref.set({ value: FieldValue.increment(3), note: FieldValue.delete() }, { merge: true });
  let stored = (await ref.get()).data();
  assert.equal(stored?.value, 5);
  assert.equal("note" in (stored || {}), false);
  await ref.update({ value: FieldValue.increment(1), gone: FieldValue.delete() });
  stored = (await ref.get()).data();
  assert.equal(stored?.value, 6);
  await ref.set({ value: FieldValue.increment(4) });
  assert.equal((await ref.get()).data()?.value, 4, "a non-merge set starts from zero");
});
