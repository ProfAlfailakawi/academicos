// AcademicOS — Realtime Layer (SSE)  (إصلاح الفجوة #4)
// السبب الجذري: لا طبقة realtime — «الحضور» والإشعارات وغرفة التوضيح تعتمد على polling،
// وهي فجوة تجربة ملموسة لمنتج فيه Team Studio وتعاون.
//
// الحل: مركز Server-Sent Events خفيف بلا اعتماديات (يعمل خلف Cloud Run/HTTP، أبسط من WebSocket
// وكافٍ للبثّ من الخادم للعميل: إشعارات، حضور، أجوبة غرفة التوضيح). القنوات مُنطّقة بالمستأجر/المشروع،
// مع نبضة heartbeat لإبقاء الاتصال حيًّا، وحدّ أقصى للمشتركين حمايةً من الإغراق.
//
// ملاحظة توسّع: عبر عدّة instances، اربط broadcast بـ Firestore listener أو Pub/Sub لتوحيد البثّ؛
// الواجهة هنا مصمّمة لذلك (publish/subscribe مجرّدة). SSE للنسخة الواحدة يعمل فورًا.

import type { Response } from 'express';

export interface RealtimeClient { id: string; tenantId: string; userId: string; channels: Set<string>; res: Response; since: number }
export interface RealtimeEvent { type: string; channel: string; data: unknown; at: string }

export class RealtimeHub {
  private clients = new Map<string, RealtimeClient>();
  private heartbeat?: ReturnType<typeof setInterval>;
  constructor(private opts: { maxClients?: number; heartbeatMs?: number } = {}) {}

  start() {
    if (this.heartbeat) return;
    const ms = this.opts.heartbeatMs ?? 25000;
    this.heartbeat = setInterval(() => {
      const line = `: ping ${Date.now()}\n\n`;
      for (const c of this.clients.values()) { try { c.res.write(line); } catch { this.drop(c.id); } }
    }, ms);
    if (typeof this.heartbeat === 'object' && 'unref' in this.heartbeat) (this.heartbeat as any).unref?.();
  }
  stop() { if (this.heartbeat) clearInterval(this.heartbeat); this.heartbeat = undefined; for (const id of [...this.clients.keys()]) this.drop(id); }

  // يربط استجابة HTTP كتيار SSE ضمن قنوات محدّدة النطاق (tenant/user/project).
  connect(res: Response, params: { id: string; tenantId: string; userId: string; channels: string[] }): boolean {
    const max = this.opts.maxClients ?? 5000;
    if (this.clients.size >= max) { res.status(503).json({ error: 'Realtime at capacity', code: 'REALTIME_CAPACITY' }); return false; }
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`retry: 5000\n`);
    res.write(`event: ready\ndata: ${JSON.stringify({ id: params.id, at: new Date().toISOString() })}\n\n`);
    const client: RealtimeClient = { id: params.id, tenantId: params.tenantId, userId: params.userId, channels: new Set(params.channels), res, since: Date.now() };
    this.clients.set(params.id, client);
    res.on('close', () => this.drop(params.id));
    this.start();
    return true;
  }
  drop(id: string) { const c = this.clients.get(id); if (!c) return; try { c.res.end(); } catch { /* noop */ } this.clients.delete(id); }

  // بثّ لقناة — يصل فقط لعملاء نفس القناة (والمستأجر مضمّن في اسم القناة).
  publish(channel: string, type: string, data: unknown) {
    const event: RealtimeEvent = { type, channel, data, at: new Date().toISOString() };
    const frame = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
    let delivered = 0;
    for (const c of this.clients.values()) if (c.channels.has(channel)) { try { c.res.write(frame); delivered++; } catch { this.drop(c.id); } }
    return delivered;
  }
  // حضور: من المتصلون الآن على قناة مشروع؟ (معرّفات مستخدمين فريدة)
  presence(channel: string): string[] { const s = new Set<string>(); for (const c of this.clients.values()) if (c.channels.has(channel)) s.add(c.userId); return [...s]; }
  get size() { return this.clients.size; }

  // أسماء قنوات موحّدة — دائمًا مُنطّقة بالمستأجر لمنع التسريب عبر المستأجرين.
  static tenantChannel(tenantId: string) { return `t:${tenantId}`; }
  static userChannel(tenantId: string, userId: string) { return `u:${tenantId}:${userId}`; }
  static projectChannel(tenantId: string, projectId: string) { return `p:${tenantId}:${projectId}`; }
  static assignmentChannel(tenantId: string, assignmentId: string) { return `a:${tenantId}:${assignmentId}`; }
}

export const realtimeHub = new RealtimeHub({ maxClients: Number(process.env.REALTIME_MAX_CLIENTS || 5000) });
