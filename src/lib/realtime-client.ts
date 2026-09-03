// AcademicOS — Realtime client (SSE)  📡
// عميل خفيف لطبقة الوقت الحقيقي: يفتح EventSource آمنًا مُنطّقًا بالمستأجر/المشروع، مع إعادة اتصال
// أُسّية ومهلة، ويعرض اشتراكات نوعية (notification/presence/clarification). بلا اعتماديات.
//
// الاستخدام:
//   const rt = new RealtimeClient(getToken);
//   const off = rt.subscribe(['p:tenant:project'], 'clarification_answered', (e)=>{ ... });

type Handler = (event: { type: string; channel: string; data: any; at: string }) => void;

export class RealtimeClient {
  private es?: EventSource;
  private handlers = new Map<string, Set<Handler>>();
  private channels = new Set<string>();
  private retry = 0;
  private closed = false;
  constructor(private tokenProvider: () => string | Promise<string>, private baseUrl = '') {}

  async connect(channels: string[]) {
    this.closed = false;
    channels.forEach(c => this.channels.add(c));
    await this.open();
  }
  private async open() {
    if (this.closed) return;
    const token = await this.tokenProvider();
    const qs = new URLSearchParams({ channels: [...this.channels].join(','), access_token: token });
    // ملاحظة أمنية: EventSource لا يدعم ترويسات مخصّصة؛ الخادم يقبل access_token في الاستعلام لهذا المسار فقط
    // ويتحقّق منه كـ ID token عاديًا. لا تُمرَّر بيانات حسّاسة أخرى في الاستعلام.
    try { this.es?.close(); } catch { /* noop */ }
    const es = new EventSource(`${this.baseUrl}/api/realtime/stream?${qs.toString()}`);
    this.es = es;
    es.onopen = () => { this.retry = 0; };
    es.onerror = () => { es.close(); this.scheduleReconnect(); };
    // أنواع الأحداث المعروفة
    for (const type of ['notification', 'presence', 'clarification_answered', 'project_activity', 'ready']) {
      es.addEventListener(type, (ev: MessageEvent) => this.dispatch(type, ev));
    }
    es.onmessage = (ev) => this.dispatch('message', ev);
  }
  private dispatch(type: string, ev: MessageEvent) {
    let payload: any; try { payload = JSON.parse(ev.data); } catch { payload = { data: ev.data }; }
    const event = { type, channel: payload.channel || '', data: payload.data ?? payload, at: payload.at || new Date().toISOString() };
    this.handlers.get(type)?.forEach(h => { try { h(event); } catch { /* isolate handler errors */ } });
    this.handlers.get('*')?.forEach(h => { try { h(event); } catch { /* noop */ } });
  }
  private scheduleReconnect() {
    if (this.closed) return;
    this.retry = Math.min(this.retry + 1, 6);
    const delay = Math.min(30000, 1000 * 2 ** this.retry) + Math.floor(Math.random() * 500);
    setTimeout(() => this.open(), delay);
  }
  subscribe(channels: string[], type: string, handler: Handler): () => void {
    channels.forEach(c => this.channels.add(c));
    const set = this.handlers.get(type) || new Set<Handler>();
    set.add(handler); this.handlers.set(type, set);
    if (!this.es) void this.connect(channels); else void this.open(); // أعد الفتح بالقنوات المحدّثة
    return () => { set.delete(handler); };
  }
  close() { this.closed = true; try { this.es?.close(); } catch { /* noop */ } this.es = undefined; }
}
