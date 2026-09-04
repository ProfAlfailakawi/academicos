import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { assertSupportedFileContent, createExtractionBudget } from '../src/server/file-extract';
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

test('uploads are validated by content signature, not by the client-declared type', () => {
  const file = (name: string, mimeType: string, bytes: Buffer) => ({
    name,
    mimeType,
    base64: bytes.toString('base64'),
    size: bytes.length,
  });
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0x20)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
  const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(64)]);

  // Real product uploads keep working.
  assert.equal(assertSupportedFileContent(file('a.pdf', 'application/pdf', pdf)), 'pdf');
  assert.equal(assertSupportedFileContent(file('a.png', 'image/png', png)), 'image');
  assert.equal(
    assertSupportedFileContent(
      file('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip),
    ),
    'zip',
  );
  // Browsers that fail to sniff a type still send a usable extension.
  assert.equal(assertSupportedFileContent(file('a.docx', 'application/octet-stream', zip)), 'zip');
  assert.equal(assertSupportedFileContent(file('a.md', 'text/markdown', Buffer.from('# عنوان\nnote\n'))), 'text');

  // Forged types and unsupported families are rejected.
  assert.throws(() => assertSupportedFileContent(file('evil.png', 'image/png', elf)), /does not match/);
  assert.throws(
    () => assertSupportedFileContent(file('evil.png', 'image/png', Buffer.from('<script>alert(1)</script>'))),
    /does not match/,
  );
  assert.throws(() => assertSupportedFileContent(file('evil.pdf', 'application/pdf', zip)), /does not match/);
  assert.throws(() => assertSupportedFileContent(file('evil.txt', 'text/plain', elf)), /does not match/);
  assert.throws(() => assertSupportedFileContent(file('evil.exe', 'application/octet-stream', elf)), /Unsupported file type/);
  assert.throws(() => assertSupportedFileContent(file('a.txt', 'text/plain', Buffer.alloc(0))), /empty/);
});

test('the upload validator runs on every file intake path', async () => {
  const { readFile } = await import('node:fs/promises');
  const server = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(server, /function validateFile\([\s\S]{0,1600}assertSupportedFileContent\(file\)/);
  assert.equal(server.split('forEach(validateFile)').length - 1, 2);
});
