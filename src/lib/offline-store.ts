// Offline-first cache and write queue for the active project.
//
// IndexedDB keeps: the last Project DNA (incl. the requirement matrix and
// rubric) per project, the last writer document, unsaved section drafts, and a
// FIFO queue of writes made while offline. The queue is flushed in order when
// the browser comes back online; each entry replays with its original
// idempotency key. Everything degrades to no-ops when IndexedDB is missing
// (private mode, old browsers, tests).

import type { ProjectDNA, ProjectDocument } from "../types";

export interface QueuedWrite {
  id?: number;
  projectId: string;
  kind: "task" | "deliverable" | "rubric" | "artifact";
  label: string;
  path: string;
  method: "PATCH" | "POST" | "PUT";
  body?: unknown;
  idempotencyKey: string;
  createdAt: string;
  attempts?: number;
  lastError?: string;
}

export interface CachedDraft {
  key: string;
  projectId: string;
  artifactId: string;
  content: string;
  baseContent: string;
  updatedAt: string;
}

const DB_NAME = "academicos-offline";
const DB_VERSION = 1;
const STORES = { projects: "projects", documents: "documents", drafts: "drafts", queue: "queue" } as const;
export const QUEUE_EVENT = "academicos:offline-queue";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.projects)) db.createObjectStore(STORES.projects, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORES.documents)) db.createObjectStore(STORES.documents, { keyPath: "projectId" });
        if (!db.objectStoreNames.contains(STORES.drafts)) db.createObjectStore(STORES.drafts, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORES.queue)) db.createObjectStore(STORES.queue, { keyPath: "id", autoIncrement: true });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise<T | undefined>((resolve) => {
    try {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function notifyQueueChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function cacheProject(project: ProjectDNA) {
  await run(STORES.projects, "readwrite", (s) => s.put({ id: project.id, project, cachedAt: new Date().toISOString() }));
}

export async function getCachedProject(id: string): Promise<{ project: ProjectDNA; cachedAt: string } | null> {
  const row = await run<{ project: ProjectDNA; cachedAt: string }>(STORES.projects, "readonly", (s) => s.get(id));
  return row || null;
}

export async function cacheDocument(projectId: string, document: ProjectDocument | null) {
  if (!document) return;
  await run(STORES.documents, "readwrite", (s) => s.put({ projectId, document, cachedAt: new Date().toISOString() }));
}

export async function getCachedDocument(projectId: string): Promise<ProjectDocument | null> {
  const row = await run<{ document: ProjectDocument }>(STORES.documents, "readonly", (s) => s.get(projectId));
  return row?.document || null;
}

export const draftKey = (projectId: string, artifactId: string) => `${projectId}:${artifactId}`;

export async function saveDraft(draft: Omit<CachedDraft, "key" | "updatedAt">) {
  await run(STORES.drafts, "readwrite", (s) =>
    s.put({ ...draft, key: draftKey(draft.projectId, draft.artifactId), updatedAt: new Date().toISOString() }),
  );
}

export async function getDraft(projectId: string, artifactId: string): Promise<CachedDraft | null> {
  return (await run<CachedDraft>(STORES.drafts, "readonly", (s) => s.get(draftKey(projectId, artifactId)))) || null;
}

export async function clearDraft(projectId: string, artifactId: string) {
  await run(STORES.drafts, "readwrite", (s) => s.delete(draftKey(projectId, artifactId)));
}

export async function enqueueWrite(entry: Omit<QueuedWrite, "id" | "createdAt" | "idempotencyKey"> & { idempotencyKey?: string }) {
  const item: QueuedWrite = {
    ...entry,
    idempotencyKey: entry.idempotencyKey || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await run(STORES.queue, "readwrite", (s) => s.add(item));
  notifyQueueChanged();
  return item;
}

export async function listQueue(): Promise<QueuedWrite[]> {
  const rows = (await run<QueuedWrite[]>(STORES.queue, "readonly", (s) => s.getAll())) || [];
  return rows.sort((a, b) => (a.id || 0) - (b.id || 0));
}

async function removeQueued(id: number) {
  await run(STORES.queue, "readwrite", (s) => s.delete(id));
}

async function updateQueued(entry: QueuedWrite) {
  await run(STORES.queue, "readwrite", (s) => s.put(entry));
}

export type SendOutcome = "sent" | "retry" | "drop";

/**
 * Pure queue processor (unit-tested): replays entries in order, stops at the
 * first retryable failure so later edits never overtake earlier ones.
 */
export async function processQueue(
  entries: QueuedWrite[],
  send: (entry: QueuedWrite) => Promise<SendOutcome>,
): Promise<{ sent: QueuedWrite[]; dropped: QueuedWrite[]; remaining: QueuedWrite[] }> {
  const sent: QueuedWrite[] = [];
  const dropped: QueuedWrite[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const outcome = await send(entries[i]);
    if (outcome === "sent") sent.push(entries[i]);
    else if (outcome === "drop") dropped.push(entries[i]);
    else return { sent, dropped, remaining: entries.slice(i) };
  }
  return { sent, dropped, remaining: [] };
}

let flushing: Promise<{ sent: number; dropped: number; remaining: number }> | null = null;

/** Flush the persisted queue with the given transport. Concurrent calls share one run. */
export function flushQueue(
  send: (entry: QueuedWrite) => Promise<SendOutcome>,
): Promise<{ sent: number; dropped: number; remaining: number }> {
  if (flushing) return flushing;
  flushing = (async () => {
    const entries = await listQueue();
    const result = await processQueue(entries, async (entry) => {
      const outcome = await send(entry);
      if (outcome === "sent" || outcome === "drop") await removeQueued(entry.id!);
      else await updateQueued({ ...entry, attempts: (entry.attempts || 0) + 1 });
      return outcome;
    });
    notifyQueueChanged();
    return { sent: result.sent.length, dropped: result.dropped.length, remaining: result.remaining.length };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
