import test from 'node:test';
import assert from 'node:assert/strict';
import { learnCacheKey, cacheScope } from '../src/server/learn-cache';

test('Same question yields the same cache key (consistency)', () => {
  const a = learnCacheKey('tutor', { topic: 'المشتقات', language: 'العربية', level: 'beginner' });
  const b = learnCacheKey('tutor', { topic: '  المشتقات  ', language: 'العربية', level: 'beginner' }); // whitespace-insensitive
  assert.equal(a, b);
});

test('Different topic/language/level/kind yield different keys', () => {
  const base = learnCacheKey('tutor', { topic: 'x', language: 'ar', level: 'beginner' });
  assert.notEqual(base, learnCacheKey('tutor', { topic: 'y', language: 'ar', level: 'beginner' }));
  assert.notEqual(base, learnCacheKey('tutor', { topic: 'x', language: 'en', level: 'beginner' }));
  assert.notEqual(base, learnCacheKey('tutor', { topic: 'x', language: 'ar', level: 'advanced' }));
  assert.notEqual(base, learnCacheKey('solve', { topic: 'x', language: 'ar', level: 'beginner' }));
});

test('Key ordering of parts does not matter', () => {
  const a = learnCacheKey('solve', { problem: 'p', language: 'ar', mode: 'worked' });
  const b = learnCacheKey('solve', { mode: 'worked', language: 'ar', problem: 'p' });
  assert.equal(a, b);
});

test('Scope isolates per-tenant vs global', () => {
  assert.equal(cacheScope('global', 't1'), 'global');
  assert.equal(cacheScope('tenant', 't1'), 't_t1');
  assert.notEqual(cacheScope('tenant', 't1'), cacheScope('tenant', 't2'));
});
