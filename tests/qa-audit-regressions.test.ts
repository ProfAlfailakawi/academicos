import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { buildProjectDNA } from '../src/server/project-engine';
import { isUnsafeDocId } from '../src/server/doc-id';
import { verifyLemonSqueezyWebhook } from '../src/server/billing';

const base = {
  title: 'Linked', course: 'T', projectType: 'Report', academicDomain: 'General', complexity: 'low' as const,
  collaborationMode: 'individual' as const, requiredActions: ['WRITE'], requiredSkills: [], learningOutcomes: [],
  deliverables: [{ title: 'Report', format: 'PDF' }], requirements: [], rubric: [], riskFlags: [],
};

test('a project compiled for a published course assignment keeps its authoritative link', () => {
  // Regression: normalizePolicy dropped provenance/courseId/assignmentId, so the
  // submission route answered PROJECT_ASSIGNMENT_MISMATCH for every student.
  const project = buildProjectDNA({
    ...base,
    aiPolicy: { level: 2, summary: 'Planning only', provenance: 'published_assignment', courseId: 'c1', assignmentId: 'a1', needsConfirmation: false },
  }, { userId: 'u', tenantId: 't' });
  assert.equal(project.aiPolicy.provenance, 'published_assignment');
  assert.equal(project.aiPolicy.courseId, 'c1');
  assert.equal(project.aiPolicy.assignmentId, 'a1');
});

test('unknown provenance values and unlinked policies stay unlinked', () => {
  const bogus = buildProjectDNA({ ...base, aiPolicy: { level: 2, summary: 'x', provenance: 'admin' as any } }, { userId: 'u', tenantId: 't' });
  assert.equal(bogus.aiPolicy.provenance, undefined);
  const plain = buildProjectDNA({ ...base, aiPolicy: { level: 2, summary: 'x' } }, { userId: 'u', tenantId: 't' });
  assert.equal(plain.aiPolicy.courseId, undefined);
  assert.equal(plain.aiPolicy.assignmentId, undefined);
});

test('ids that Firestore cannot store are rejected before they reach the SDK', () => {
  for (const bad of ['a/b', '</script>', '.', '..', '__x__', 'a\u0000b', 'x'.repeat(701)])
    assert.equal(isUnsafeDocId(bad), true, JSON.stringify(bad));
  for (const ok of ['seed-course-0001-1', 'a665a506-27da-435f-a8bf-bd78f485d0bc', 'assign__student', 'user@example.com'])
    assert.equal(isUnsafeDocId(ok), false, ok);
});

test('Lemon Squeezy webhook without a signature is 401, not "not configured"', () => {
  const saved = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'qa-secret';
  try {
    assert.throws(() => verifyLemonSqueezyWebhook(Buffer.from('{}'), ''), (e: any) => e.status === 401 && e.code === 'LEMONSQUEEZY_SIGNATURE_INVALID');
    const raw = Buffer.from(JSON.stringify({ meta: { custom_data: {} }, data: { id: '1', attributes: { status: 'paid' } } }));
    const sig = createHmac('sha256', 'qa-secret').update(raw).digest('hex');
    assert.equal(verifyLemonSqueezyWebhook(raw, sig).provider, 'lemonsqueezy');
  } finally {
    if (saved === undefined) delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    else process.env.LEMONSQUEEZY_WEBHOOK_SECRET = saved;
  }
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = '';
  try {
    assert.throws(() => verifyLemonSqueezyWebhook(Buffer.from('{}'), 'x'), (e: any) => e.status === 503);
  } finally {
    if (saved === undefined) delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    else process.env.LEMONSQUEEZY_WEBHOOK_SECRET = saved;
  }
});

test('native compiler never uses an uploaded file marker as the project title', async () => {
  const { compileAssignmentNative } = await import('../src/server/native-compiler');
  const parsed = compileAssignmentNative({ text: '--- brief.txt ---\nاكتب تقريرا عن الذكاء الاصطناعي.\nالتسليم 2026-12-20', timezone: 'UTC' });
  assert.ok(!/^---/.test(parsed.title || ''), parsed.title);
  assert.match(parsed.title || '', /تقريرا/);
});
