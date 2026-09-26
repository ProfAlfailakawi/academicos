import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProcessEvidencePayload,
  canonicalJson,
  signProcessEvidence,
  verifyProcessEvidence,
  processEvidenceSecret,
} from '../src/server/process-evidence';
import type { AcademicTimeMachine, ProjectEvidence, WorkspaceArtifactVersion } from '../src/types';

const project = { id: 'p1', title: 'بحث في الاقتصاد', course: 'ECON 101' };
const timeMachine: AcademicTimeMachine = {
  projectId: 'p1',
  generatedAt: '2026-01-10T00:00:00.000Z',
  events: [
    { id: 'created_p1', at: '2026-01-01T09:00:00.000Z', kind: 'created', title: 'Started', detail: 'x', actorType: 'human', source: 'project' },
    { id: 'artifact_a1', at: '2026-01-03T09:00:00.000Z', kind: 'work', title: 'Intro', detail: 'writing', actorType: 'human', source: 'artifact', version: 3 },
    { id: 'evidence_e1', at: '2026-01-04T09:00:00.000Z', kind: 'evidence', title: 'Smith 2020', detail: 'source', actorType: 'human', source: 'evidence' },
    { id: 'learning_l1', at: '2026-01-05T09:00:00.000Z', kind: 'viva', title: 'Viva', detail: '3/3', actorType: 'human', source: 'learning_evidence' },
    { id: 'ai_r1', at: '2026-01-02T09:00:00.000Z', kind: 'ai', title: 'AI assistance', detail: 'm', actorType: 'ai', source: 'ai_run' },
  ],
  summary: { humanEvents: 4, aiEvents: 1, evidenceEvents: 2, versions: 0 },
};
const evidence = [{ id: 'e1', type: 'source' } as ProjectEvidence];
const versions = [
  { id: 'v1', artifactId: 'a1', projectId: 'p1', tenantId: 't', actorId: 'u', versionNumber: 1, createdAt: '2026-01-02T10:00:00.000Z', snapshot: { title: 'Intro', module: 'writing', content: 'abc' } },
  { id: 'v2', artifactId: 'a1', projectId: 'p1', tenantId: 't', actorId: 'u', versionNumber: 2, createdAt: '2026-01-02T12:00:00.000Z', snapshot: { title: 'Intro', module: 'writing', content: 'abcdef' } },
] as unknown as WorkspaceArtifactVersion[];

function build() {
  return buildProcessEvidencePayload({ project, timeMachine, evidence, artifactVersions: versions, now: new Date('2026-01-10T00:00:00.000Z') });
}

test('canonical JSON is key-order independent', () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: undefined, b: null }] }), canonicalJson({ a: [2, { b: null, d: 1 }], b: 1 }));
});

test('timeline classifies drafts, revisions, viva answers, source checks and AI assists in time order', () => {
  const payload = build();
  assert.deepEqual(payload.entries.map((e) => e.kind), ['created', 'ai_assist', 'draft', 'revision', 'revision', 'source_check', 'viva']);
  assert.equal(payload.summary.drafts, 1);
  assert.equal(payload.summary.revisions, 2);
  assert.equal(payload.summary.sourceChecks, 1);
  assert.equal(payload.summary.vivaAnswers, 1);
  assert.equal(payload.summary.aiAssists, 1);
  assert.equal(payload.summary.firstAt, '2026-01-01T09:00:00.000Z');
});

test('signed report verifies and detects tampering or a foreign signer', () => {
  const secret = 'process-evidence:test-secret';
  const report = signProcessEvidence(build(), secret);
  assert.match(report.integrity.contentHash, /^[a-f0-9]{64}$/);
  assert.match(report.integrity.verificationCode, /^[A-F0-9]{4}(-[A-F0-9]{4}){3}$/);
  assert.equal(verifyProcessEvidence({ report }, secret).status, 'valid');
  // Printed hash + signature only.
  assert.equal(verifyProcessEvidence({ contentHash: report.integrity.contentHash, signature: report.integrity.signature }, secret).status, 'valid');
  // Edited content.
  const tampered = { ...report, entries: report.entries.map((e, i) => (i === 0 ? { ...e, title: 'Forged' } : e)) };
  assert.equal(verifyProcessEvidence({ report: tampered }, secret).status, 'tampered');
  // Signed with another key.
  assert.equal(verifyProcessEvidence({ report }, 'process-evidence:other').status, 'unknown_signer');
  // Garbage input.
  assert.equal(verifyProcessEvidence({ contentHash: 'x', signature: 'y' }, secret).status, 'tampered');
});

test('configured PROCESS_EVIDENCE_SECRET is used and stable', () => {
  assert.equal(processEvidenceSecret({ PROCESS_EVIDENCE_SECRET: 'abc' } as NodeJS.ProcessEnv), 'process-evidence:abc');
});
