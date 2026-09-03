// AcademicOS — Distributed Rate Limiter  (إصلاح الفجوة #3)
// السبب الجذري: العدّادات في server.ts كانت `new Map` داخل الذاكرة — على Cloud Run بعدّة instances
// كل نسخة لها عدّاد مستقل، فتضعف الحماية مع التوسّع وتنصفر عند كل إعادة تشغيل.
//
// الحل: مخزن قابل للتبديل خلف واجهة واحدة. الافتراضي ذاكرة (كما كان، بلا كسر)، وفي الإنتاج
// يُفعّل مخزن Firestore الذري (transaction increment) عبر متغير بيئة — عدّاد موحّد عبر كل النسخ.
// نافذة زمنية ثابتة (fixed window) بدقّة الدقيقة، مطابقة لسلوك server.ts الحالي.

export interface RateStore {
  // يزيد العدّاد ويعيد القيمة بعد الزيادة، ضمن نافذة الدقيقة المعطاة.
  increment(key: string, windowMinute: number, ttlSeconds: number): Promise<number>;
  readonly kind: 'memory' | 'firestore';
}

// ---- مخزن الذاكرة (سلوك مطابق للأصل، للتطوير والنسخة الواحدة) -------------------
export class MemoryRateStore implements RateStore {
  readonly kind = 'memory' as const;
  private buckets = new Map<string, { minute: number; count: number }>();
  private lastSweep = 0;
  constructor(private maxKeys = 20000) {}
  async increment(key: string, windowMinute: number): Promise<number> {
    if (this.lastSweep !== windowMinute) {
      this.lastSweep = windowMinute;
      for (const [k, v] of this.buckets) if (v.minute < windowMinute - 1) this.buckets.delete(k);
    }
    let b = this.buckets.get(key);
    if (!b || b.minute !== windowMinute) {
      if (!b && this.buckets.size >= this.maxKeys) throw Object.assign(new Error('RATE_LIMIT_CAPACITY'), { code: 'RATE_LIMIT_CAPACITY' });
      b = { minute: windowMinute, count: 0 }; this.buckets.set(key, b);
    }
    b.count += 1; return b.count;
  }
}

// ---- مخزن Firestore الذري (موحّد عبر كل النسخ في الإنتاج) ----------------------
// يعتمد على transaction increment. يُحقن getDb لتفادي ربط ثابت بطبقة db.
export class FirestoreRateStore implements RateStore {
  readonly kind = 'firestore' as const;
  constructor(private getCollection: () => any /* FirebaseFirestore.CollectionReference */) {}
  async increment(key: string, windowMinute: number, ttlSeconds: number): Promise<number> {
    const col = this.getCollection();
    const docId = `${encodeURIComponent(key)}__${windowMinute}`;
    const ref = col.doc(docId);
    const db = col.firestore;
    const expireAt = new Date((windowMinute + 2) * 60000 + ttlSeconds * 1000);
    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const next = ((snap.exists ? Number(snap.data()?.count) : 0) || 0) + 1;
      tx.set(ref, { count: next, minute: windowMinute, expireAt }, { merge: true });
      return next;
    });
  }
}

// ---- المحدّد عالي المستوى ------------------------------------------------------
export interface RateDecision { allowed: boolean; used: number; limit: number; remaining: number; capacityError?: boolean }
export class RateLimiter {
  constructor(private store: RateStore, private ttlSeconds = 120) {}
  get backend() { return this.store.kind; }
  async check(key: string, limit: number, now = Date.now()): Promise<RateDecision> {
    const minute = Math.floor(now / 60000);
    try {
      const used = await this.store.increment(key, minute, this.ttlSeconds);
      return { allowed: used <= limit, used, limit, remaining: Math.max(0, limit - used) };
    } catch (e: any) {
      if (e?.code === 'RATE_LIMIT_CAPACITY') return { allowed: false, used: 0, limit, remaining: 0, capacityError: true };
      // فشل المخزن الموزّع لا يجب أن يُسقط الخدمة: نسمح لكن نُسجّل (fail-open للتوفر، مع إنذار).
      console.warn('RateLimiter store failure, failing open', { key, error: String(e?.message || e) });
      return { allowed: true, used: 0, limit, remaining: limit };
    }
  }
}

// مصنع: يختار المخزن حسب البيئة. RATE_LIMIT_BACKEND=firestore يفعّل الموزّع.
export function createRateLimiter(opts: { firestoreCollection?: () => any; ttlSeconds?: number } = {}): RateLimiter {
  const backend = String(process.env.RATE_LIMIT_BACKEND || 'memory').toLowerCase();
  if (backend === 'firestore' && opts.firestoreCollection) {
    return new RateLimiter(new FirestoreRateStore(opts.firestoreCollection), opts.ttlSeconds);
  }
  return new RateLimiter(new MemoryRateStore(), opts.ttlSeconds);
}
