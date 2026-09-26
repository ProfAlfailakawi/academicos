import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGapTask, buildGapTask, buildRubricDrilldown, gapTaskIdFor } from '../src/server/rubric-drilldown';
import { recalculateProject } from '../src/server/project-engine';
import type { ProjectDNA, ProjectEvidence, WorkspaceArtifact } from '../src/types';

const project = {
  id: 'p1',
  rubric: [
    { id: 'r1', title: 'Analysis', description: '', weighting: 40, readiness: 'partial' },
    { id: 'r2', title: 'Sources', description: '', weighting: 30, readiness: 'covered' },
    { id: 'r3', title: 'Structure', description: '', weighting: 30, readiness: 'needs_revision' },
  ],
  tasks: [
    { id: 't1', title: 'Write intro', status: 'in_progress' },
    { id: 't2', title: 'Collect data', status: 'not_started' },
  ],
} as unknown as ProjectDNA;

const artifacts = [
  { id: 'a1', title: 'Analysis draft', module: 'writing', status: 'draft', rubricIds: ['r1'], updatedAt: '2026-01-02' },
  { id: 'a2', title: 'Bibliography', module: 'research', status: 'ready', rubricIds: ['r2'], updatedAt: '2026-01-03' },
  { id: 'a3', title: 'Deleted', module: 'writing', status: 'ready', rubricIds: ['r3'], updatedAt: '2026-01-03', deletedAt: '2026-01-04' },
] as unknown as WorkspaceArtifact[];
const evidence = [{ id: 'e1', title: 'Smith 2020', type: 'source', verification: 'user_verified', rubricIds: ['r2'] }] as unknown as ProjectEvidence[];

test('drill-down links criteria to workspace items/evidence and lists what is missing', () => {
  const d = buildRubricDrilldown(project, artifacts, evidence, [{ rubricId: 'r1', lossProbability: 70 }]);
  const byId = Object.fromEntries(d.criteria.map((c) => [c.rubricId, c]));
  assert.deepEqual(byId.r1.missing, ['draft_only', 'no_evidence', 'not_marked_covered', 'cohort_loss_high']);
  assert.equal(byId.r1.cohortLossProbability, 70);
  assert.deepEqual(byId.r2.missing, []);
  assert.equal(byId.r2.weightAtRisk, 0);
  // Deleted artifacts do not count as coverage.
  assert.deepEqual(byId.r3.missing, ['no_workspace_item', 'no_evidence', 'needs_revision']);
  assert.equal(byId.r3.weightAtRisk, 30);
  // Highest weight at risk first.
  assert.equal(d.criteria[0].rubricId, 'r1');
  assert.ok(d.totalWeightAtRisk > 0);
});

test('cohort loss is matched by title when rubric ids were regenerated', () => {
  const d = buildRubricDrilldown(project, artifacts, evidence, [{ rubricId: 'old', title: ' analysis ', lossProbability: 60 }]);
  assert.equal(d.criteria.find((c) => c.rubricId === 'r1')!.cohortLossProbability, 60);
});

test('gap task becomes the Next Best Action and is idempotent', () => {
  const d = buildRubricDrilldown(project, artifacts, evidence);
  const criterion = d.criteria.find((c) => c.rubricId === 'r3')!;
  const task = buildGapTask(criterion, 'en');
  assert.equal(task.id, gapTaskIdFor('r3'));
  assert.equal(task.status, 'ready');
  assert.match(task.title, /Structure/);
  assert.match(task.description!, /Link a section/);
  const withTask = recalculateProject(applyGapTask(project, task));
  assert.equal(withTask.nextAction, task.title);
  assert.equal(withTask.tasks[0].id, task.id);
  // Re-applying replaces rather than duplicates, and keeps in-progress state.
  const again = applyGapTask(withTask, buildGapTask(criterion, 'ar', { ...task, status: 'in_progress' }));
  assert.equal(again.tasks.filter((t) => t.id === task.id).length, 1);
  assert.equal(again.tasks[0].status, 'in_progress');
  assert.match(again.tasks[0].title, /Structure/);
});
