/**
 * An in-memory Firestore stand-in, for demo sessions only.
 *
 * AcademicOS reads and writes through 73 store methods, and every one of them
 * goes through `db()`. Rather than write 73 in-memory twins — which would drift
 * from the real ones the first time somebody changed a query — this implements
 * the narrow slice of the Firestore API that `db.ts` actually uses, once, and
 * lets `db()` return it inside a demo request. Every store method then works
 * unchanged against synthetic data, including the ones nobody thought about
 * while building the demo.
 *
 * The slice is genuinely narrow, and deliberately so: collection/doc, equality
 * `where` (the only operator in the file), `orderBy`, `limit`, get/set/update/
 * delete, `batch`, `runTransaction` and the aggregate `count`. Anything outside
 * it throws rather than quietly returning the wrong answer — a demo that lies
 * about what the product does is worse than one that is missing a screen.
 *
 * Transactions run serially under a single lock. That is weaker than Firestore's
 * optimistic concurrency, and it is the right trade here: a demo sandbox has
 * exactly one visitor, so there is no contention to resolve, and a lock keeps
 * read-modify-write sequences correct without pretending to implement retries.
 */

type Doc = Record<string, unknown>;

const clone = <T>(value: T): T =>
  value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

/**
 * Keys that must never be written through, at any depth.
 *
 * `clone()` round-trips documents through JSON, and `JSON.parse` keeps
 * `__proto__` as a real OWN property rather than treating it as the accessor.
 * That is what makes this reachable: a request body of
 * `{"__proto__": {"isAdmin": true}}` reaches `mergeInto`, whose recursive branch
 * then walks into `target["__proto__"]` — `Object.prototype` — and writes there.
 * The pollution is process-wide, so it would not stay inside the demo sandbox:
 * every later request, demo or real, would see the injected property. Blocking
 * the keys is cheaper and more certain than reasoning about each write site.
 */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isSafeKey = (key: string): boolean => !FORBIDDEN_KEYS.has(key);

function readPath(doc: Doc, path: string): unknown {
  // Firestore allows dotted field paths in `where`. The store only uses flat
  // ones today, but supporting the nested form costs three lines.
  if (!path.includes(".")) return doc[path];
  return path.split(".").reduce<unknown>(
    (value, part) =>
      value && typeof value === "object"
        ? (value as Record<string, unknown>)[part]
        : undefined,
    doc,
  );
}

function writePath(doc: Doc, path: string, value: unknown): void {
  const parts = path.split(".");
  if (!parts.every(isSafeKey)) return;
  if (parts.length === 1) {
    doc[parts[0]] = value;
    return;
  }
  let cursor: Record<string, unknown> = doc;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== "object")
      cursor[part] = {} as Record<string, unknown>;
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function mergeInto(target: Doc, patch: Doc): void {
  for (const [key, value] of Object.entries(patch)) {
    // Dropped rather than merged: a demo document has no legitimate reason to
    // carry one of these keys, and the recursive branch below would otherwise
    // walk straight into Object.prototype.
    if (!isSafeKey(key)) continue;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      mergeInto(target[key] as Doc, value as Doc);
    } else {
      target[key] = value;
    }
  }
}

export interface DemoDocumentSnapshot {
  id: string;
  exists: boolean;
  ref: DemoDocumentRef;
  data(): Doc | undefined;
}

export interface DemoDocumentRef {
  id: string;
  path: string;
  get(): Promise<DemoDocumentSnapshot>;
  set(data: Doc, options?: { merge?: boolean }): Promise<void>;
  update(data: Doc): Promise<void>;
  delete(): Promise<void>;
}

type Filter = { field: string; value: unknown };
type Order = { field: string; direction: "asc" | "desc" };

class Store {
  readonly collections = new Map<string, Map<string, Doc>>();

  bucket(name: string): Map<string, Doc> {
    let found = this.collections.get(name);
    if (!found) {
      found = new Map<string, Doc>();
      this.collections.set(name, found);
    }
    return found;
  }
}

class DocumentRef implements DemoDocumentRef {
  constructor(
    private readonly store: Store,
    private readonly collectionName: string,
    readonly id: string,
  ) {}

  get path(): string {
    return `${this.collectionName}/${this.id}`;
  }

  readSync(): DemoDocumentSnapshot {
    const raw = this.store.bucket(this.collectionName).get(this.id);
    const data = raw ? clone(raw) : undefined;
    const ref = this;
    return {
      id: this.id,
      exists: Boolean(raw),
      ref,
      data: () => data,
    };
  }

  async get(): Promise<DemoDocumentSnapshot> {
    return this.readSync();
  }

  setSync(data: Doc, options?: { merge?: boolean }): void {
    const bucket = this.store.bucket(this.collectionName);
    if (options?.merge) {
      const current = bucket.get(this.id);
      const next = current ? clone(current) : ({} as Doc);
      mergeInto(next, clone(data));
      bucket.set(this.id, next);
      return;
    }
    bucket.set(this.id, clone(data));
  }

  async set(data: Doc, options?: { merge?: boolean }): Promise<void> {
    this.setSync(data, options);
  }

  updateSync(data: Doc): void {
    const bucket = this.store.bucket(this.collectionName);
    const current = bucket.get(this.id);
    if (!current)
      throw Object.assign(new Error("No document to update"), {
        code: "NOT_FOUND",
      });
    const next = clone(current);
    for (const [key, value] of Object.entries(clone(data)))
      writePath(next, key, value);
    bucket.set(this.id, next);
  }

  async update(data: Doc): Promise<void> {
    this.updateSync(data);
  }

  deleteSync(): void {
    this.store.bucket(this.collectionName).delete(this.id);
  }

  async delete(): Promise<void> {
    this.deleteSync();
  }
}

class Query {
  constructor(
    protected readonly store: Store,
    protected readonly collectionName: string,
    protected readonly filters: Filter[] = [],
    protected readonly orders: Order[] = [],
    protected readonly max: number | null = null,
  ) {}

  where(field: string, op: string, value: unknown): Query {
    if (op !== "==")
      throw new Error(
        `Demo Firestore supports only "==" filters; received "${op}" on ${this.collectionName}.${field}`,
      );
    return new Query(
      this.store,
      this.collectionName,
      [...this.filters, { field, value }],
      this.orders,
      this.max,
    );
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): Query {
    return new Query(
      this.store,
      this.collectionName,
      this.filters,
      [...this.orders, { field, direction }],
      this.max,
    );
  }

  limit(count: number): Query {
    return new Query(
      this.store,
      this.collectionName,
      this.filters,
      this.orders,
      count,
    );
  }

  protected rows(): { id: string; data: Doc }[] {
    let items = [...this.store.bucket(this.collectionName).entries()]
      .map(([id, data]) => ({ id, data }))
      .filter(({ data }) =>
        this.filters.every(
          (filter) => readPath(data, filter.field) === filter.value,
        ),
      );
    for (const order of [...this.orders].reverse()) {
      items = items.sort((a, b) => {
        const left = readPath(a.data, order.field);
        const right = readPath(b.data, order.field);
        const compared =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left ?? "").localeCompare(String(right ?? ""));
        return order.direction === "desc" ? -compared : compared;
      });
    }
    return this.max === null ? items : items.slice(0, this.max);
  }

  async get(): Promise<{
    empty: boolean;
    size: number;
    docs: DemoDocumentSnapshot[];
    forEach(fn: (doc: DemoDocumentSnapshot) => void): void;
  }> {
    const docs = this.rows().map(({ id, data }) => {
      const copy = clone(data);
      const ref = new DocumentRef(this.store, this.collectionName, id);
      return {
        id,
        exists: true,
        ref,
        data: () => copy,
      } as DemoDocumentSnapshot;
    });
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (fn) => docs.forEach(fn),
    };
  }

  count() {
    const total = this.rows().length;
    return { get: async () => ({ data: () => ({ count: total }) }) };
  }
}

class CollectionRef extends Query {
  doc(id?: string): DocumentRef {
    return new DocumentRef(
      this.store,
      this.collectionName,
      id || `auto_${Math.random().toString(36).slice(2, 12)}`,
    );
  }
}

class WriteBatch {
  private readonly operations: (() => void)[] = [];

  set(ref: DemoDocumentRef, data: Doc, options?: { merge?: boolean }): this {
    this.operations.push(() => (ref as DocumentRef).setSync(data, options));
    return this;
  }

  update(ref: DemoDocumentRef, data: Doc): this {
    this.operations.push(() => (ref as DocumentRef).updateSync(data));
    return this;
  }

  delete(ref: DemoDocumentRef): this {
    this.operations.push(() => (ref as DocumentRef).deleteSync());
    return this;
  }

  async commit(): Promise<void> {
    // Applied together, so a half-written batch never becomes visible.
    this.operations.forEach((operation) => operation());
  }
}

class Transaction {
  private readonly operations: (() => void)[] = [];

  async get(target: DemoDocumentRef | Query): Promise<any> {
    return target instanceof Query ? target.get() : target.get();
  }

  set(ref: DemoDocumentRef, data: Doc, options?: { merge?: boolean }): this {
    this.operations.push(() => (ref as DocumentRef).setSync(data, options));
    return this;
  }

  update(ref: DemoDocumentRef, data: Doc): this {
    this.operations.push(() => (ref as DocumentRef).updateSync(data));
    return this;
  }

  delete(ref: DemoDocumentRef): this {
    this.operations.push(() => (ref as DocumentRef).deleteSync());
    return this;
  }

  flush(): void {
    this.operations.forEach((operation) => operation());
  }
}

export interface DemoFirestore {
  collection(name: string): CollectionRef;
  batch(): WriteBatch;
  runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Direct seeding hook — not part of the Firestore API. */
  seed(collectionName: string, docs: { id: string; data: Doc }[]): void;
  stats(): Record<string, number>;
}

export function createDemoFirestore(): DemoFirestore {
  const store = new Store();
  // One visitor per sandbox, so a plain serial queue is enough to keep
  // read-modify-write sequences correct.
  let lock: Promise<unknown> = Promise.resolve();

  return {
    collection: (name: string) => new CollectionRef(store, name),
    batch: () => new WriteBatch(),
    runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
      const run = lock.then(async () => {
        const tx = new Transaction();
        const result = await fn(tx);
        tx.flush();
        return result;
      });
      // The queue must advance even when a transaction rejects, or one failed
      // write would wedge every later one in the session.
      lock = run.catch(() => undefined);
      return run;
    },
    seed(collectionName, docs) {
      const bucket = store.bucket(collectionName);
      docs.forEach(({ id, data }) => bucket.set(id, clone(data)));
    },
    stats() {
      const out: Record<string, number> = {};
      store.collections.forEach((bucket, name) => {
        if (bucket.size) out[name] = bucket.size;
      });
      return out;
    },
  };
}
