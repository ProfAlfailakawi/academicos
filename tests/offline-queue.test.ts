import test from 'node:test';
import assert from 'node:assert/strict';
import { processQueue, type QueuedWrite } from '../src/lib/offline-store';

const entry = (id: number): QueuedWrite => ({ id, projectId: 'p', kind: 'task', label: `t${id}`, path: `/api/x/${id}`, method: 'PATCH', idempotencyKey: `k${id}`, createdAt: '2026-01-01' });

test('queue replays in order and stops at the first retryable failure', async () => {
  const seen: number[] = [];
  const result = await processQueue([entry(1), entry(2), entry(3), entry(4)], async (e) => {
    seen.push(e.id!);
    return e.id === 2 ? 'drop' : e.id === 3 ? 'retry' : 'sent';
  });
  assert.deepEqual(seen, [1, 2, 3]);
  assert.deepEqual(result.sent.map((e) => e.id), [1]);
  assert.deepEqual(result.dropped.map((e) => e.id), [2]);
  assert.deepEqual(result.remaining.map((e) => e.id), [3, 4]);
});

test('an empty or fully successful queue leaves nothing behind', async () => {
  assert.deepEqual((await processQueue([], async () => 'sent')).remaining, []);
  const r = await processQueue([entry(1), entry(2)], async () => 'sent');
  assert.equal(r.sent.length, 2);
  assert.equal(r.remaining.length, 0);
});
