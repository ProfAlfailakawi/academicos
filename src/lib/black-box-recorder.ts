// AcademicOS — Learning Black Box (client recorder)  🖤✈️
// مسجّل عملية محلي بالكامل واختياري. يبني سلسلة hash موقّتة لجلسة عمل الطالب على جهازه هو،
// دون إرسال أي محتوى — فقط أطوال وأنواع أحداث. الطالب وحده يقرر إرسال السلسلة للتحقق وإرفاقها
// بجواز التأليف. لا بكسل مراقبة إجبارية: التشغيل بموافقة، والإيقاف بضغطة.
//
// يستخدم Web Crypto (SubtleCrypto) لحساب SHA-256، متطابق مع تحقّق الخادم في learning-black-box.ts.

export type BlackBoxEventType = 'session_start' | 'source_open' | 'write_burst' | 'revision' | 'paste' | 'idle_return' | 'session_end';
export interface RecordedEvent { seq: number; type: BlackBoxEventType; at: number; meta?: { chars?: number; sourceRef?: string; pasteChars?: number }; prevHash: string; hash: string }
export interface RecordedChain { projectId: string; algorithm: 'sha256-chain-v1'; genesis: string; events: RecordedEvent[] }

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function canonicalMeta(meta?: RecordedEvent['meta']): string {
  if (!meta) return '';
  return [meta.chars ?? '', meta.sourceRef ?? '', meta.pasteChars ?? ''].join('|');
}

export class BlackBoxRecorder {
  private events: RecordedEvent[] = [];
  private genesis = '';
  private prevHash = '';
  private lastActivity = 0;
  private idleThresholdMs = 90000;
  private started = false;
  constructor(private projectId: string, private salt = Math.random().toString(36).slice(2)) {}

  get isRecording() { return this.started; }
  get count() { return this.events.length; }

  async start() {
    if (this.started) return;
    this.genesis = await sha256Hex(`${this.projectId}|${this.salt}`);
    this.prevHash = this.genesis;
    this.started = true;
    await this.record('session_start');
  }

  // تُستدعى من محرّر الكتابة على فترات (throttled) بعدد الأحرف المُضافة منذ آخر نبضة.
  async onWrite(charsDelta: number) {
    if (!this.started) return;
    const now = Date.now();
    if (this.lastActivity && now - this.lastActivity > this.idleThresholdMs) await this.record('idle_return');
    this.lastActivity = now;
    if (charsDelta > 0) await this.record('write_burst', { chars: charsDelta });
  }
  async onSourceOpen(ref: string) { if (this.started) await this.record('source_open', { sourceRef: ref.slice(0, 64) }); }
  async onRevision() { if (this.started) await this.record('revision'); }
  async onPaste(pasteChars: number) { if (this.started) await this.record('paste', { pasteChars }); }

  async stop(): Promise<RecordedChain> {
    if (this.started) await this.record('session_end');
    this.started = false;
    return { projectId: this.projectId, algorithm: 'sha256-chain-v1', genesis: this.genesis, events: this.events };
  }
  export(): RecordedChain { return { projectId: this.projectId, algorithm: 'sha256-chain-v1', genesis: this.genesis, events: this.events }; }

  private async record(type: BlackBoxEventType, meta?: RecordedEvent['meta']) {
    const seq = this.events.length;
    const at = Date.now();
    const hash = await sha256Hex(`${seq}|${type}|${at}|${this.prevHash}|${canonicalMeta(meta)}`);
    this.events.push({ seq, type, at, meta, prevHash: this.prevHash, hash });
    this.prevHash = hash;
  }
}
