import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createExtractionBudget } from '../src/server/file-extract';
import { safeCsvCell } from '../src/server/export';
import { ACADEMIC_FACULTY_SYSTEM_INSTRUCTION } from '../src/server/ai';
import { assignableRolesFor, canManageUserRole, canSupportImpersonate, normalizeRateRoute, privilegedMfaRequired } from '../src/server/security-controls';
import { verifyTapWebhook } from '../src/server/billing';

test('privileged roles require MFA and hierarchy blocks privilege escalation',()=>{assert.equal(privilegedMfaRequired('support_agent',{NODE_ENV:'production'} as NodeJS.ProcessEnv),true);assert.equal(canManageUserRole('university_admin','root_owner'),false);assert.equal(assignableRolesFor('admin').includes('root_owner'),false);assert.equal(canSupportImpersonate('student'),true);assert.equal(canSupportImpersonate('professor'),false)});
test('rate limiter keys collapse high-cardinality ids',()=>{assert.equal(normalizeRateRoute('/api/projects/1234567890abcdef1234567890abcdef/comments'),'/api/projects');assert.equal(normalizeRateRoute('/api/platform/credentials'),'/api/platform')});
test('CSV export neutralizes spreadsheet formulas',()=>{for(const value of ['=HYPERLINK("x")',' +SUM(1,2)','\t@cmd','-2+3'])assert.match(safeCsvCell(value),/^"'/);assert.equal(safeCsvCell('normal'), '"normal"')});
test('request extraction budget is finite and shared',()=>{assert.deepEqual(createExtractionBudget(1024,2048),{remainingBytes:1024,remainingTextChars:2048})});
test('every AI gateway receives an immutable safety instruction',()=>{assert.match(ACADEMIC_FACULTY_SYSTEM_INSTRUCTION,/untrusted data/);assert.match(ACADEMIC_FACULTY_SYSTEM_INSTRUCTION,/Do not fabricate/)});
test('Tap webhook signature must match signed payment fields',()=>{const previous=process.env.TAP_SECRET_KEY;process.env.TAP_SECRET_KEY='test-secret';try{const body={id:'chg_1',amount:10,currency:'KWD',status:'CAPTURED',transaction:{created:'1700000000000'},reference:{gateway:'gw',payment:'pay'},metadata:{tenantId:'tenant',userId:'user'}};const raw=Buffer.from(JSON.stringify(body)),material='x_idchg_1x_amount10.000x_currencyKWDx_gateway_referencegwx_payment_referencepayx_statusCAPTUREDx_created1700000000000',signature=createHmac('sha256','test-secret').update(material).digest('hex');assert.equal(verifyTapWebhook(raw,signature).status,'paid');assert.throws(()=>verifyTapWebhook(raw,'0'.repeat(64)),/Invalid Tap/)}finally{if(previous===undefined)delete process.env.TAP_SECRET_KEY;else process.env.TAP_SECRET_KEY=previous}});
