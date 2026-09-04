import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createExtractionBudget } from '../src/server/file-extract';
import { safeCsvCell } from '../src/server/export';
import { ACADEMIC_FACULTY_SYSTEM_INSTRUCTION } from '../src/server/ai';
import { assignableRolesFor, canManageUserRole, canSupportImpersonate, normalizeRateRoute, privilegedMfaRequired } from '../src/server/security-controls';
import { verifyTapWebhook } from '../src/server/billing';

test('privileged roles require MFA and hierarchy blocks privilege escalation',()=>{assert.equal(privilegedMfaRequired('support_agent',{NODE_ENV:'production',REQUIRE_ADMIN_MFA:'true'} as NodeJS.ProcessEnv),true);assert.equal(canManageUserRole('university_admin','root_owner'),false);assert.equal(assignableRolesFor('admin').includes('root_owner'),false);assert.equal(canSupportImpersonate('student'),true);assert.equal(canSupportImpersonate('professor'),false)});
test('rate limiter keys collapse high-cardinality ids',()=>{assert.equal(normalizeRateRoute('/api/projects/1234567890abcdef1234567890abcdef/comments'),'/api/projects');assert.equal(normalizeRateRoute('/api/platform/credentials'),'/api/platform')});
test('CSV export neutralizes spreadsheet formulas',()=>{for(const value of ['=HYPERLINK("x")',' +SUM(1,2)','\t@cmd','-2+3'])assert.match(safeCsvCell(value),/^"'/);assert.equal(safeCsvCell('normal'), '"normal"')});
test('request extraction budget is finite and shared',()=>{assert.deepEqual(createExtractionBudget(1024,2048),{remainingBytes:1024,remainingTextChars:2048})});
test('every AI gateway receives an immutable safety instruction',()=>{assert.match(ACADEMIC_FACULTY_SYSTEM_INSTRUCTION,/untrusted data/);assert.match(ACADEMIC_FACULTY_SYSTEM_INSTRUCTION,/Do not fabricate/)});
test('Tap webhook signature must match signed payment fields and preserve project metadata',()=>{const previous=process.env.TAP_SECRET_KEY;process.env.TAP_SECRET_KEY='test-secret';try{const body={id:'chg_1',amount:10,currency:'KWD',status:'CAPTURED',transaction:{created:'1700000000000'},reference:{gateway:'gw',payment:'pay'},metadata:{tenantId:'tenant',userId:'user',projectId:'project-1',planId:'project_viva'}};const raw=Buffer.from(JSON.stringify(body)),material='x_idchg_1x_amount10.000x_currencyKWDx_gateway_referencegwx_payment_referencepayx_statusCAPTUREDx_created1700000000000',signature=createHmac('sha256','test-secret').update(material).digest('hex');const event=verifyTapWebhook(raw,signature);assert.equal(event.status,'paid');assert.equal(event.projectId,'project-1');assert.equal(event.planId,'project_viva');assert.throws(()=>verifyTapWebhook(raw,'0'.repeat(64)),/Invalid Tap/)}finally{if(previous===undefined)delete process.env.TAP_SECRET_KEY;else process.env.TAP_SECRET_KEY=previous}});

test('demoStore enforces cross-tenant boundaries for project access', async () => {
  // We simulate the data access layer by requiring explicit adversarial verification.
  const { demoStore } = await import('../src/server/demo-store');
  // Seed a malicious tenant record directly (bypassing normal API creation)
  const project = await demoStore.saveProject({
    id: "project-adversarial",
    tenantId: "tenant-legitimate",
    userId: "user-victim",
    title: "Secret Data",
    course: "CS 101",
    projectType: "Project",
    academicDomain: "CS",
    complexity: "low",
    collaborationMode: "individual",
    requiredActions: [],
    requiredSkills: [],
    learningOutcomes: [],
    deliverables: [],
    requirements: [],
    rubric: [],
    aiPolicy: { level: 2, summary: "", needsConfirmation: false, allowed: [], prohibited: [], disclosureRequired: false },
    riskFlags: [],
    tasks: [],
    deadlines: { milestones: [] },
    workspaceModules: [],
    status: 'in_progress',
    progress: 0,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Attempt 1: Malicious user in same tenant (authorization failure)
  const attackerSameTenant = await demoStore.getProject("project-adversarial", "user-attacker", "tenant-legitimate");
  assert.equal(attackerSameTenant, null);

  // Attempt 2: Malicious user from a different tenant querying victim's project id directly
  const attackerDiffTenant = await demoStore.getProject("project-adversarial", "user-attacker", "tenant-evil");
  assert.equal(attackerDiffTenant, null);

  // Attempt 3: Cross-tenant enumeration
  const maliciousList = await demoStore.listProjects("user-attacker", "tenant-evil");
  assert.ok(!maliciousList.some(p => p.id === "project-adversarial"));
});

test('server token verification keeps signature validation mandatory while revocation check is deployment-configurable', async () => {
  const { readFile } = await import('node:fs/promises');
  const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(server, /getAuth\(\)\.verifyIdToken\(token, checkRevoked\)/);
  assert.match(server, /CHECK_REVOKED_ID_TOKENS/);
  assert.doesNotMatch(server, /return\s+\{[\s\S]{0,700}uid:\s*String\(p\.user_id/);
});

test('API auth retry forces one fresh Firebase token and preserves write idempotency key', async () => {
  const { readFile } = await import('node:fs/promises');
  const apiSource = await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
  assert.match(apiSource, /shouldRetryWithFreshIdToken/);
  assert.match(apiSource, /perform\(true\)/);
  assert.match(apiSource, /const baseHeaders = new Headers/);
  assert.match(apiSource, /X-Idempotency-Key/);
});


test('Cloud Run deployment preserves the existing service identity and repairs that identity', async () => {
  const { readFile } = await import('node:fs/promises');
  const deploy = await readFile(new URL('../scripts/deploy-cloud-run.sh', import.meta.url), 'utf8');
  const iam = await readFile(new URL('../scripts/configure-firebase-runtime-iam.sh', import.meta.url), 'utf8');
  const repair = await readFile(new URL('../scripts/repair-cloud-run-firebase-access.sh', import.meta.url), 'utf8');
  assert.doesNotMatch(deploy, /--service-account/);
  assert.match(deploy, /refusing to create a surprise service/i);
  assert.match(repair, /spec\.template\.spec\.serviceAccountName/);
  assert.match(iam, /RUNTIME_SERVICE_ACCOUNT is required/);
  assert.match(iam, /roles\/datastore\.user/);
});
