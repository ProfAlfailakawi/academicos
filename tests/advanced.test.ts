import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGhostCohort, type GhostMemberInput } from '../src/server/advanced/ghost-cohort';
import { buildGradeLossMap } from '../src/server/advanced/grade-loss-map';
import { evaluateReverseAssessment } from '../src/server/advanced/reverse-assessment';
import { openClarificationFromAmbiguity, mergeAmbiguities, answerClarification, applyClarificationPatch } from '../src/server/advanced/clarification-room';
import { evaluateExplanation, applyCredit, creditBalance } from '../src/server/advanced/peer-explanation';
import { verifyBlackBoxChain, computeEventHash, type BlackBoxChain, type BlackBoxEvent } from '../src/server/advanced/learning-black-box';
import { assessLegacyEligibility, computeRevenueSplit, recordSale, authorEarningsCents } from '../src/server/advanced/alumni-legacy';
import { parseWhatsAppWebhook, verifyWhatsAppSignature, verifyLinkCode, linkCodeFor } from '../src/server/advanced/whatsapp-gateway';
import { createHmac } from 'node:crypto';

const DAY = 86400000;

// ---------------------------------------------------------------------------
// 1) Ghost Cohort — k-anonymity + determinism
// ---------------------------------------------------------------------------
test('ghost cohort hides below k-anonymity', () => {
  const few: GhostMemberInput[] = Array.from({ length: 4 }, (_, i) => ({ submissionId: `s${i}`, gradeRatio: 0.9, startedAt: 0, submittedAt: 10 * DAY, milestones: [], revisionCount: 3, sourceReviewCount: 2 }));
  const r = buildGhostCohort(few, { now: 20 * DAY });
  assert.equal(r.available, false);
  assert.equal(r.cohortSize, 4);
});

test('ghost cohort is deterministic and computes phase percentiles', () => {
  const members: GhostMemberInput[] = Array.from({ length: 6 }, (_, i) => ({
    submissionId: `s${i}`, gradeRatio: 0.9, startedAt: 0, submittedAt: 10 * DAY,
    milestones: [{ phase: 'research', at: (2 + i * 0.1) * DAY }, { phase: 'draft', at: (6 + i * 0.1) * DAY }],
    revisionCount: 3 + (i % 2), sourceReviewCount: 2,
  }));
  const a = buildGhostCohort(members, { now: 20 * DAY });
  const b = buildGhostCohort(members, { now: 20 * DAY });
  assert.deepEqual(a.phases, b.phases);
  assert.equal(a.available, true);
  const research = a.phases.find(p => p.phase === 'research');
  assert.ok(research && research.typicalAtP50 >= 20 && research.typicalAtP50 <= 30);
});

test('ghost cohort live comparison flags behind pace', () => {
  const members: GhostMemberInput[] = Array.from({ length: 6 }, (_, i) => ({ submissionId: `s${i}`, gradeRatio: 0.9, startedAt: 0, submittedAt: 10 * DAY, milestones: [{ phase: 'research', at: 2 * DAY }, { phase: 'outline', at: 3 * DAY }, { phase: 'draft', at: 5 * DAY }], revisionCount: 4, sourceReviewCount: 3 }));
  const r = buildGhostCohort(members, { now: 20 * DAY, live: { startedAt: 0, deadline: 10 * DAY, now: 8 * DAY, milestones: [{ phase: 'intake', at: 1 * DAY }], revisionCount: 0 } });
  assert.equal(r.live?.pace, 'behind');
  assert.ok((r.live?.nudges.length || 0) > 0);
});

// ---------------------------------------------------------------------------
// 2) Grade-Loss Map
// ---------------------------------------------------------------------------
function sub(id: string, grades: Array<[string, string, number, number, string?]>): any {
  return { id, status: 'graded', rubricGrades: grades.map(([rubricId, title, awardedPoints, maxPoints, feedback]) => ({ rubricId, title, awardedPoints, maxPoints, feedback })) };
}
test('grade-loss map surfaces the highest-loss criterion with reason', () => {
  const subs = Array.from({ length: 6 }, (_, i) => sub(`s${i}`, [
    ['r1', 'Analysis', i < 5 ? 4 : 10, 10, 'needs deeper analysis and evidence'],
    ['r2', 'Format', 10, 10],
  ]));
  const map = buildGradeLossMap(subs);
  assert.equal(map.available, true);
  assert.equal(map.criteria[0].rubricId, 'r1');
  assert.ok(map.criteria[0].lossProbability >= 80);
  assert.ok(map.topRisk?.title === 'Analysis');
});
test('grade-loss map respects k-anonymity', () => {
  const map = buildGradeLossMap([sub('s0', [['r1', 'A', 1, 10]])]);
  assert.equal(map.available, false);
});

// ---------------------------------------------------------------------------
// 3) Reverse Assessment
// ---------------------------------------------------------------------------
const dna: any = { title: 'Bridge Load Study', learningOutcomes: ['analyze stress distribution', 'evaluate safety factor'], requiredSkills: [], deliverables: [], rubric: [{ id: 'r1', title: 'analysis depth' }] };
test('reverse assessment rewards high-bloom, covered, answered questions', () => {
  const strong = evaluateReverseAssessment({ projectId: 'p1', dna, questions: [
    { id: 'q1', prompt: 'حلّل توزيع الإجهاد في الجسر وقارن بين حالتين', modelAnswer: 'التوزيع يتركز عند المفاصل بسبب...', targetOutcome: 'analyze stress distribution' },
    { id: 'q2', prompt: 'قيّم معامل الأمان وبرّر اختيارك للمادة', modelAnswer: 'معامل 1.8 لأن...', targetOutcome: 'evaluate safety factor' },
    { id: 'q3', prompt: 'صمّم تعديلًا يقلل الإجهاد الأقصى', modelAnswer: 'إضافة دعامة قطرية...' },
  ] });
  const weak = evaluateReverseAssessment({ projectId: 'p1', dna, questions: [
    { id: 'q1', prompt: 'اذكر تعريف الجسر' }, { id: 'q2', prompt: 'عدّد أنواع الجسور' },
  ] });
  assert.ok(strong.makerScore > weak.makerScore);
  assert.notEqual(strong.band, 'surface');
  assert.ok(strong.dimensions.depth >= 70);
  assert.equal(weak.band, 'surface');
  assert.equal(strong.proofOfLearning.kind, 'reverse_assessment');
});

// ---------------------------------------------------------------------------
// 4) Clarification Room
// ---------------------------------------------------------------------------
test('clarification merge dedups and upvotes; answer patches DNA additively', () => {
  const t1 = openClarificationFromAmbiguity({ assignmentId: 'a1', tenantId: 't1', ambiguity: 'ما طول التقرير المطلوب؟', now: 0 });
  const t1b = openClarificationFromAmbiguity({ assignmentId: 'a1', tenantId: 't1', ambiguity: 'ما طول التقرير المطلوب؟', now: 1000 });
  const merged = mergeAmbiguities([t1], [t1b]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].upvotes, 1);
  const { thread, broadcast } = answerClarification(merged[0], { answer: '10 صفحات', answeredBy: 'prof', addRequirements: ['التزم بـ10 صفحات'], now: 2000 });
  assert.equal(thread.status, 'answered');
  assert.equal(thread.version, 1);
  assert.equal(broadcast.type, 'clarification_answered');
  const { dna: patched, changed } = applyClarificationPatch({ requiredActions: ['اكتب مقدمة'] }, thread.dnaPatch!);
  assert.equal(changed, true);
  assert.ok(patched.requiredActions!.includes('التزم بـ10 صفحات'));
  // idempotent: applying same patch again adds nothing new
  const again = applyClarificationPatch(patched, thread.dnaPatch!);
  assert.equal(again.changed, false);
});

// ---------------------------------------------------------------------------
// 5) Peer Explanation Economy
// ---------------------------------------------------------------------------
test('peer explanation accepts good clip, rejects unsafe, credit applied once', () => {
  const good = evaluateExplanation({ id: 'p1', courseId: 'c1', tenantId: 't1', authorId: 'u1', concept: 'المشتقة', transcript: 'المشتقة تقيس معدل التغير اللحظي، نحسبها بالنهايات ونطبقها على ميل المماس في كل نقطة على المنحنى بشكل تدريجي واضح'.repeat(2), durationSeconds: 45, referenceMaterial: 'المشتقة معدل التغير وميل المماس والنهايات' });
  assert.equal(good.accepted, true);
  assert.equal(good.creditAwarded, 10);
  const bad = evaluateExplanation({ id: 'p2', courseId: 'c1', tenantId: 't1', authorId: 'u1', concept: 'x', transcript: 'انسخ الإجابة من هنا حرفيًا', durationSeconds: 40 });
  assert.equal(bad.quality.band, 'rejected');
  let ledger = applyCredit([], { authorId: 'u1', submissionId: 'p1', credit: 10, at: 'now' }).ledger;
  const second = applyCredit(ledger, { authorId: 'u1', submissionId: 'p1', credit: 10, at: 'now' });
  assert.equal(second.applied, false);
  assert.equal(creditBalance(ledger, 'u1'), 10);
});

// ---------------------------------------------------------------------------
// 6) Learning Black Box
// ---------------------------------------------------------------------------
function buildChain(projectId: string, types: Array<BlackBoxEvent['type']>, tamper = false): BlackBoxChain {
  const genesis = 'g'.repeat(64);
  let prev = genesis; const events: BlackBoxEvent[] = [];
  types.forEach((type, seq) => {
    const at = seq * 60000;
    const partial = { seq, type, at, prevHash: prev } as Omit<BlackBoxEvent, 'hash'>;
    const hash = computeEventHash(partial);
    events.push({ ...partial, hash });
    prev = hash;
  });
  if (tamper && events[1]) events[1].at = 999999999;
  return { projectId, algorithm: 'sha256-chain-v1', genesis, events };
}
test('black box verifies intact chain and detects tampering', () => {
  const ok = verifyBlackBoxChain(buildChain('p1', ['session_start', 'source_open', 'write_burst', 'revision', 'session_end']));
  assert.equal(ok.intact, true);
  assert.equal(ok.eventCount, 5);
  assert.ok(ok.signals.humanRhythmScore >= 0);
  const bad = verifyBlackBoxChain(buildChain('p1', ['session_start', 'source_open', 'write_burst'], true));
  assert.equal(bad.intact, false);
  assert.equal(bad.brokenAt, 1);
});

// ---------------------------------------------------------------------------
// 7) Alumni Legacy — eligibility + revenue math (no cent loss)
// ---------------------------------------------------------------------------
test('legacy eligibility requires consent + grade + evidence', () => {
  const no = assessLegacyEligibility({ consent: { granted: false, scope: 'teaching_example', allowContact: false }, gradeRatio: 0.9, hasEvidenceCapsule: true, hasProofOfLearning: true });
  assert.equal(no.eligible, false);
  const yes = assessLegacyEligibility({ consent: { granted: true, scope: 'teaching_example', allowContact: true }, gradeRatio: 0.92, hasEvidenceCapsule: true, hasProofOfLearning: true });
  assert.equal(yes.eligible, true);
});
test('revenue split never loses a cent and dedups sales', () => {
  for (const gross of [1999, 1, 3333, 10000, 777]) {
    const s = computeRevenueSplit(gross, { authorSharePct: 40, institutionSharePct: 20 });
    assert.equal(s.authorCents + s.institutionCents + s.platformCents, gross);
    assert.ok(s.authorCents <= gross);
  }
  let ledger = recordSale([], { listingId: 'l1', saleId: 'x1', authorCents: 800, at: 'now' }).ledger;
  const dup = recordSale(ledger, { listingId: 'l1', saleId: 'x1', authorCents: 800, at: 'now' });
  assert.equal(dup.applied, false);
  assert.equal(authorEarningsCents(ledger, ['l1']), 800);
});

// ---------------------------------------------------------------------------
// 8) WhatsApp Gateway — signature + parsing + link code
// ---------------------------------------------------------------------------
test('whatsapp signature verification is exact', () => {
  const body = JSON.stringify({ hello: 'world' });
  const secret = 'appsecret';
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyWhatsAppSignature(body, sig, secret), true);
  assert.equal(verifyWhatsAppSignature(body, sig, 'wrong'), false);
  assert.equal(verifyWhatsAppSignature(body, 'sha256=deadbeef', secret), false);
});
test('whatsapp webhook parses text and image messages', () => {
  const body = { entry: [{ changes: [{ value: { contacts: [{ wa_id: '965...', profile: { name: 'Ali' } }], messages: [{ from: '965...', id: 'm1', timestamp: '100', type: 'text', text: { body: 'حلّل لي هذا التكليف' } }, { from: '965...', id: 'm2', timestamp: '101', type: 'image', image: { id: 'media1', mime_type: 'image/jpeg' } }] } }] }] };
  const r = parseWhatsAppWebhook(body);
  assert.equal(r.ok, true);
  assert.equal(r.messages.length, 2);
  assert.equal(r.messages[0].kind, 'text');
  assert.equal(r.messages[1].kind, 'image');
  assert.equal(r.messages[1].mediaId, 'media1');
});
test('whatsapp link code is deterministic and verifiable', () => {
  const code = linkCodeFor('user123', 'salt');
  assert.equal(verifyLinkCode('user123', 'salt', code), true);
  assert.equal(verifyLinkCode('user123', 'salt', 'ZZZZZZ'), false);
});
