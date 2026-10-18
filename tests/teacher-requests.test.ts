import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_TEACHER_REQUEST_ATTEMPTS,
  TEACHER_REQUEST_REVIEWER_ROLES,
  TeacherRequestError,
  decideTeacherRequest,
  submitTeacherRequest,
  type ClaimsAdmin,
  type TeacherRequestStore,
} from '../src/server/teacher-requests';
import type { TeacherRequestRecord, UserRole } from '../src/types';

function memory() {
  const rows = new Map<string, TeacherRequestRecord>();
  const store: TeacherRequestStore = {
    async get(id) { return rows.get(id) ? { ...rows.get(id)! } : null; },
    async set(r) { rows.set(r.id, { ...r }); },
    async list(status) { return [...rows.values()].filter((r) => !status || r.status === status); },
  };
  const claims = new Map<string, Record<string, unknown>>();
  const writes: Array<[string, Record<string, unknown>]> = [];
  const auth: ClaimsAdmin = {
    async getUser(uid) { return { customClaims: claims.get(uid) || {} }; },
    async setCustomUserClaims(uid, c) { claims.set(uid, c); writes.push([uid, c]); },
  };
  return { store, auth, claims, writes, rows };
}
const student = (id = 'u1', role: UserRole = 'student') => ({ userId: id, tenantId: `individual_${id}`, role, email: `${id}@x.test`, displayName: 'Student', emailVerified: true });
const rejects = (p: Promise<unknown>, status: number, code: string) =>
  assert.rejects(p, (e: any) => e instanceof TeacherRequestError && e.status === status && e.code === code);

test('a student can file a teacher request; it stays pending and is idempotent', async () => {
  const m = memory();
  const first = await submitTeacherRequest({ store: m.store, actor: student(), body: { institution: 'جامعة الكويت', note: 'x' } });
  assert.equal(first.created, true);
  assert.equal(first.request.status, 'pending');
  const again = await submitTeacherRequest({ store: m.store, actor: student(), body: { institution: 'جامعة الخليج' } });
  assert.equal(again.created, false);
  assert.equal(again.request.institution, 'جامعة الخليج');
  assert.equal(m.rows.size, 1);
  assert.equal(m.writes.length, 0, 'filing a request never touches claims');
});

test('request input is validated and a role in the body is ignored', async () => {
  const m = memory();
  await rejects(submitTeacherRequest({ store: m.store, actor: student(), body: { institution: ' ' } }), 400, 'TEACHER_INSTITUTION_REQUIRED');
  await rejects(submitTeacherRequest({ store: m.store, actor: student(), body: null }), 400, 'TEACHER_INSTITUTION_REQUIRED');
  const r = await submitTeacherRequest({ store: m.store, actor: student(), body: { institution: 'Uni', role: 'root_owner', status: 'approved', decidedBy: 'me' } });
  assert.equal(r.request.status, 'pending');
  assert.equal(r.request.decidedBy, undefined);
  assert.equal(m.writes.length, 0);
});

test('accounts that are not students cannot file; approved requests cannot be re-filed', async () => {
  const m = memory();
  for (const role of ['professor', 'admin', 'root_owner', 'university_admin'] as UserRole[])
    await rejects(submitTeacherRequest({ store: m.store, actor: student('p', role), body: { institution: 'Uni' } }), 409, 'TEACHER_ALREADY_FACULTY');
  await submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } });
  await decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: { userId: 'root', role: 'root_owner' }, targetUserId: 's', decision: 'approve' });
  await rejects(submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } }), 409, 'TEACHER_REQUEST_ALREADY_APPROVED');
});

test('only platform owners can decide; teachers, students and tenant admins cannot', async () => {
  const m = memory();
  await submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } });
  for (const role of ['student', 'professor', 'university_admin', 'department_admin', 'support_agent', 'finance_admin', 'national_admin'] as UserRole[])
    await rejects(decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: { userId: 'x', role }, targetUserId: 's', decision: 'approve' }), 403, 'FORBIDDEN');
  assert.deepEqual([...TEACHER_REQUEST_REVIEWER_ROLES].sort(), ['admin', 'root_owner', 'superadmin']);
  assert.equal(m.writes.length, 0);
  assert.equal(m.rows.get('s')!.status, 'pending');
});

test('nobody can decide their own request, even a platform owner', async () => {
  const m = memory();
  await submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } });
  await rejects(decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: { userId: 's', role: 'student' }, targetUserId: 's', decision: 'approve' }), 403, 'FORBIDDEN');
  await rejects(decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: { userId: 's', role: 'superadmin' }, targetUserId: 's', decision: 'approve' }), 403, 'TEACHER_SELF_DECISION_FORBIDDEN');
  assert.equal(m.writes.length, 0);
});

test('approval grants the professor claim server-side and keeps the other claims', async () => {
  const m = memory();
  m.claims.set('s', { role: 'student', tenantId: 'individual_s', emulatorMfaEnrolled: true });
  await submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } });
  const { request, role } = await decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: { userId: 'root', role: 'root_owner' }, targetUserId: 's', decision: 'approve', reason: 'verified' });
  assert.equal(role, 'professor');
  assert.equal(request.status, 'approved');
  assert.equal(request.decidedBy, 'root');
  assert.deepEqual(m.claims.get('s'), { role: 'professor', tenantId: 'individual_s', emulatorMfaEnrolled: true });
  await rejects(decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: { userId: 'root', role: 'root_owner' }, targetUserId: 's', decision: 'reject', reason: 'late' }), 409, 'TEACHER_REQUEST_ALREADY_DECIDED');
});

test('rejection needs a reason, leaves the account a student and allows a limited number of retries', async () => {
  const m = memory();
  m.claims.set('s', { role: 'student' });
  await submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } });
  const rev = { userId: 'sa', role: 'superadmin' as UserRole };
  await rejects(decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: rev, targetUserId: 's', decision: 'reject' }), 400, 'TEACHER_REASON_REQUIRED');
  await rejects(decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: rev, targetUserId: 's', decision: 'maybe' }), 400, 'TEACHER_DECISION_INVALID');
  const out = await decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: rev, targetUserId: 's', decision: 'reject', reason: 'البريد غير مؤسسي' });
  assert.equal(out.request.status, 'rejected');
  assert.equal(out.request.reason, 'البريد غير مؤسسي');
  assert.deepEqual(m.claims.get('s'), { role: 'student' });
  assert.equal(m.writes.length, 0);
  for (let i = 1; i < MAX_TEACHER_REQUEST_ATTEMPTS; i++) {
    const again = await submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } });
    assert.equal(again.request.status, 'pending');
    await decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: rev, targetUserId: 's', decision: 'reject', reason: 'still no' });
  }
  await rejects(submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } }), 429, 'TEACHER_REQUEST_LIMIT');
});

test('approval never overwrites a higher role and unknown requests are 404', async () => {
  const m = memory();
  await submitTeacherRequest({ store: m.store, actor: student('s'), body: { institution: 'Uni' } });
  m.claims.set('s', { role: 'university_admin', tenantId: 't' }); // promoted elsewhere meanwhile
  await rejects(decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: { userId: 'root', role: 'root_owner' }, targetUserId: 's', decision: 'approve' }), 409, 'TEACHER_TARGET_ROLE_NOT_STUDENT');
  assert.equal(m.claims.get('s')!.role, 'university_admin');
  await rejects(decideTeacherRequest({ store: m.store, auth: m.auth, reviewer: { userId: 'root', role: 'root_owner' }, targetUserId: 'ghost', decision: 'approve' }), 404, 'TEACHER_REQUEST_NOT_FOUND');
});

test('static guard: no route lets a user set a role through a body/PATCH, and claims are written only by trusted flows', () => {
  const server = readFileSync('server.ts', 'utf8');
  const profile = server.slice(server.indexOf('"/api/profile",\n    authenticate,\n    async (req: AuthenticatedRequest, res, next) => {\n      try {\n        const a = req.actor!;\n        const current'));
  const handler = profile.slice(0, profile.indexOf('app.get(', 10) > 0 ? profile.indexOf('app.get(', 10) : 6000);
  assert.ok(handler.length > 500, 'profile PATCH handler located');
  assert.doesNotMatch(handler, /body\??\.role|\.role\s*=|customClaims|setCustomUserClaims/);
  const routes = readFileSync('src/server/routes/teacher-requests.ts', 'utf8');
  assert.doesNotMatch(routes, /req\.body\??\.role/);
  assert.match(routes, /requireRecentPrivilegedAuth/);
  assert.match(routes, /TEACHER_REQUEST_REVIEWER_ROLES/);
  const claimWrites = (server.match(/setCustomUserClaims\(/g) || []).length;
  assert.equal(claimWrites, 1, 'server.ts keeps exactly one claims write (admin user management)');
});
