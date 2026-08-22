import test from 'node:test';
import assert from 'node:assert/strict';
import { decideSolveMode, buildSolveRequest, buildSolveVariation, toSolveResult, nativeSolveScaffold, solverPlatformInstruction } from '../src/server/solver';

test('Practice problems (not linked to graded assignment) get a full worked solution', () => {
  const d = decideSolveMode({ linkedToAssignment: false });
  assert.equal(d.mode, 'worked');
  assert.equal(d.disclosureRequired, false);
});

test('Linked assignment with permissive policy → worked + mandatory disclosure', () => {
  const d = decideSolveMode({ linkedToAssignment: true, policyLevel: 5, policyProhibited: [] });
  assert.equal(d.mode, 'worked');
  assert.equal(d.disclosureRequired, true);
});

test('Linked assignment that prohibits AI → guided (never hands the answer)', () => {
  const d = decideSolveMode({ linkedToAssignment: true, policyLevel: 5, policyProhibited: ['No AI allowed'] });
  assert.equal(d.mode, 'guided');
});

test('Linked assignment with low policy level → guided', () => {
  const d = decideSolveMode({ linkedToAssignment: true, policyLevel: 2, policyProhibited: [] });
  assert.equal(d.mode, 'guided');
});

test('Unconfirmed policy → guided until confirmed', () => {
  const d = decideSolveMode({ linkedToAssignment: true, policyNeedsConfirmation: true });
  assert.equal(d.mode, 'guided');
});

test('Guided instruction forbids the final submittable answer; worked provides it', () => {
  assert.ok(/do not give the final submittable answer/i.test(solverPlatformInstruction('guided', 'العربية')));
  assert.ok(/solve the problem fully/i.test(solverPlatformInstruction('worked', 'English')));
  // language propagates
  assert.ok(solverPlatformInstruction('worked', 'Français').includes('Français'));
});

test('toSolveResult exposes finalAnswer only in worked mode', () => {
  const out = { summary: '42', findings: ['step1', 'step2'], suggestions: ['PRACTICE: solve x+3=8', 'check units'], warnings: ['assumed g=9.8'] };
  const worked = toSolveResult('worked', 'العربية', out);
  assert.equal(worked.finalAnswer, '42');
  assert.equal(worked.strategy, undefined);
  assert.equal(worked.steps.length, 2);
  assert.equal(worked.practiceQuestion, 'solve x+3=8');
  const guided = toSolveResult('guided', 'العربية', out);
  assert.equal(guided.finalAnswer, undefined); // never leaks the answer in guided mode
  assert.ok(guided.strategy);
});

test('buildSolveRequest carries the agent and honest policy summary', () => {
  const req = buildSolveRequest({ problem: 'x^2=9', language: 'العربية', mode: 'worked' });
  assert.equal(req.agent, 'solver');
  assert.equal(req.taskType, 'worked_solution');
});

test('Native scaffold is honest and keeps guided mode answer-free', () => {
  const w = nativeSolveScaffold('worked', 'العربية');
  assert.equal(w.source, 'scaffold');
  assert.ok(w.notice);
  const g = nativeSolveScaffold('guided', 'العربية');
  assert.equal(g.finalAnswer, undefined);
});

test('The same exam question gets a stable but student-specific presentation', () => {
  const a = buildSolveVariation('student-a', 'x^2=9', 'secret');
  assert.deepEqual(a, buildSolveVariation('student-a', 'x^2=9', 'secret'));
  assert.notEqual(a.id, buildSolveVariation('student-b', 'x^2=9', 'secret').id);
  assert.ok(buildSolveRequest({ problem: 'x^2=9', mode: 'worked', variation: a }).platformInstruction?.includes(a.id));
});
