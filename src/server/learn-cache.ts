// مفاتيح تخزين مُعنوَنة بالمحتوى للتعلّم — حتمية ونقية.
// نفس (النوع + الموضوع/المسألة + اللغة + المستوى/الوضع) => نفس المفتاح => نفس النتيجة.
import { createHash } from 'node:crypto';

function norm(s: unknown) { return String(s ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en'); }

export function learnCacheKey(kind: 'tutor' | 'solve', parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, norm(v)]).sort(([a], [b]) => a.localeCompare(b))),
  );
  return createHash('sha256').update(`${kind}|${canonical}`).digest('hex').slice(0, 40);
}

// النطاق: 'global' لاتساق كل المنصّة، أو tenantId لاتساق داخل المقرر/الجامعة فقط.
export function cacheScope(scope: 'global' | 'tenant', tenantId: string): string {
  return scope === 'global' ? 'global' : `t_${tenantId}`;
}
