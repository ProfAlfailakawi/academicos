import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCohortInsight } from '../src/server/cohort-insight';
import { publicThread } from '../src/server/routes/instructor';
import { answerClarification, applyClarificationPatch, openClarificationFromAmbiguity } from '../src/server/advanced/clarification-room';
import type { ProjectDNA } from '../src/types';

function student(i: number, opts: { rubric?: string; blocked?: boolean; unclear?: boolean; progress?: number; updatedAt?: string } = {}): ProjectDNA {
  return {
    id: `p${i}-${opts.updatedAt || 'a'}`,
    userId: `u${i}`,
    progress: opts.progress ?? 40,
    status: opts.blocked ? 'blocked' : 'in_progress',
    updatedAt: opts.updatedAt || '2026-01-01',
    rubric: [{ id: `r${i}`, title: 'Critical Analysis', description: '', weighting: 40, readiness: (opts.rubric as any) || 'not_evidenced' }],
    requirements: opts.unclear ? [{ id: 'q', label: 'Word count', value: '', category: 'format', confidence: 'needs_confirmation' }] : [],
    tasks: opts.blocked ? [{ id: 't', title: 'Collect data', status: 'blocked' }] : [],
    deliverables: [],
  } as unknown as ProjectDNA;
}

test('cohort insight stays hidden below the k-anonymity threshold', () => {
  const insight = buildCohortInsight([student(1), student(2), student(3)], new Date('2026-01-02'), 5);
  assert.equal(insight.available, false);
  assert.equal(insight.cohortSize, 3);
  assert.deepEqual(insight.stuckPoints, []);
});

test('cohort insight aggregates stuck points without identifying students', () => {
  const projects = [
    ...[1, 2, 3, 4, 5, 6].map((i) => student(i, { unclear: i <= 5 })),
    student(7, { rubric: 'covered', blocked: true }),
    // Older duplicate project of student 1 must be ignored.
    student(1, { rubric: 'covered', updatedAt: '2025-12-01' }),
  ];
  const insight = buildCohortInsight(projects, new Date('2026-01-02'), 5);
  assert.equal(insight.available, true);
  assert.equal(insight.cohortSize, 7);
  const labels = insight.stuckPoints.map((p) => `${p.kind}:${p.label}:${p.percent}`);
  assert.deepEqual(labels, ['rubric:Critical Analysis:86', 'requirement:Word count:71']);
  // The single blocked student is folded away (bucket < k) and stage counts < k are zeroed.
  assert.equal(insight.stuckPoints.some((p) => p.detail === 'blocked'), false);
  assert.equal(insight.stageDistribution!.blocked, 0);
  assert.equal(JSON.stringify(insight).includes('u1'), false);
});

test('clarification threads never expose who asked or answered', () => {
  const thread = openClarificationFromAmbiguity({ assignmentId: 'a1', tenantId: 't', ambiguity: 'Can we use Arabic sources?', raisedBy: 'student-9' });
  const { thread: answered } = answerClarification(thread, { answer: 'Yes, peer-reviewed only.', answeredBy: 'prof-1', addRequirements: ['Peer-reviewed sources only'] });
  const out = publicThread(answered) as Record<string, unknown>;
  assert.equal('raisedBy' in out, false);
  assert.equal('answeredBy' in out, false);
  assert.equal(out.status, 'answered');
  const { dna, changed } = applyClarificationPatch({ requiredActions: [] as string[] }, answered.dnaPatch!);
  assert.equal(changed, true);
  assert.deepEqual(dna.requiredActions, ['Peer-reviewed sources only']);
});
