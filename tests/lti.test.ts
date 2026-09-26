import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import {
  buildLoginRedirect,
  createLtiState,
  ltiConfig,
  postAgsScore,
  requestAgsToken,
  scoresUrl,
  signJwt,
  toolJwks,
  verifyLtiIdToken,
  verifyLtiState,
} from '../src/server/lti';

const platform = generateKeyPairSync('rsa', { modulusLength: 2048 });
const tool = generateKeyPairSync('rsa', { modulusLength: 2048 });
const platformJwk = { ...(createPublicKey(platform.privateKey).export({ format: 'jwk' }) as any), kid: 'p1', alg: 'RS256' };
const jwks = { keys: [platformJwk] };
const env = {
  LTI_ISSUER: 'https://moodle.example.edu',
  LTI_CLIENT_ID: 'client-123',
  LTI_DEPLOYMENT_ID: 'dep-1,dep-2',
  LTI_JWKS_URL: 'https://moodle.example.edu/mod/lti/certs.php',
  LTI_AUTH_LOGIN_URL: 'https://moodle.example.edu/mod/lti/auth.php',
  LTI_AUTH_TOKEN_URL: 'https://moodle.example.edu/mod/lti/token.php',
  LTI_TOOL_PRIVATE_KEY_PEM: tool.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n'),
} as unknown as NodeJS.ProcessEnv;
const config = ltiConfig(env);
const C = 'https://purl.imsglobal.org/spec/lti/claim/';

function idToken(overrides: Record<string, unknown> = {}, now = Math.floor(Date.now() / 1000)) {
  return signJwt({
    iss: env.LTI_ISSUER, aud: 'client-123', sub: 'moodle-user-7', iat: now, exp: now + 300, nonce: overrides.nonce || 'n-1',
    [`${C}deployment_id`]: 'dep-2', [`${C}version`]: '1.3.0', [`${C}message_type`]: 'LtiResourceLinkRequest',
    [`${C}context`]: { id: 'c1', title: 'ECON 101' }, [`${C}resource_link`]: { id: 'rl1' }, [`${C}roles`]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': { lineitem: 'https://moodle.example.edu/mod/lti/services.php/2/lineitems/5/lineitem', scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'] },
    ...overrides,
  }, platform.privateKey, 'p1');
}

test('config is inert until every required LTI variable is set', () => {
  assert.equal(ltiConfig({} as NodeJS.ProcessEnv).configured, false);
  assert.ok(ltiConfig({} as NodeJS.ProcessEnv).missing.includes('LTI_ISSUER'));
  assert.equal(config.configured, true);
  assert.deepEqual(config.deploymentIds, ['dep-1', 'dep-2']);
  assert.equal(config.agsEnabled, true);
});

test('OIDC login redirect carries a signed, expiring state bound to the nonce', () => {
  const { url, nonce } = buildLoginRedirect(config, { iss: env.LTI_ISSUER, login_hint: 'u7', client_id: 'client-123' }, 'secret', 'https://app/api/lti/launch');
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, env.LTI_AUTH_LOGIN_URL);
  assert.equal(parsed.searchParams.get('response_mode'), 'form_post');
  assert.equal(parsed.searchParams.get('nonce'), nonce);
  assert.equal(verifyLtiState('secret', parsed.searchParams.get('state')!).nonce, nonce);
  assert.throws(() => verifyLtiState('other', parsed.searchParams.get('state')!), /Invalid LTI state/);
  assert.throws(() => verifyLtiState('secret', createLtiState('secret', { nonce: 'x', targetLinkUri: '', now: 0, ttlSeconds: 1 })), /Expired/);
  assert.throws(() => buildLoginRedirect(config, { iss: 'https://evil.example', login_hint: 'u' }, 's', 'l'), /Unknown LTI platform/);
});

test('id_token is validated against the platform JWKS and claims', () => {
  const launch = verifyLtiIdToken(idToken({ nonce: 'n-ok' }), config, jwks, { nonce: 'n-ok' });
  assert.equal(launch.subject, 'moodle-user-7');
  assert.equal(launch.context?.title, 'ECON 101');
  assert.match(launch.ags!.lineitem!, /lineitem$/);
  // Replay of the same nonce is refused.
  assert.throws(() => verifyLtiIdToken(idToken({ nonce: 'n-ok' }), config, jwks, { nonce: 'n-ok' }), /already used/);
  assert.throws(() => verifyLtiIdToken(idToken({ nonce: 'a' }), config, jwks, { nonce: 'b' }), /nonce mismatch/);
  assert.throws(() => verifyLtiIdToken(idToken({ nonce: 'c', aud: 'someone-else' }), config, jwks, { nonce: 'c' }), /audience/);
  assert.throws(() => verifyLtiIdToken(idToken({ nonce: 'd', [`${C}deployment_id`]: 'dep-x' }), config, jwks, { nonce: 'd' }), /deployment/);
  assert.throws(() => verifyLtiIdToken(idToken({ nonce: 'e', exp: 10 }), config, jwks, { nonce: 'e' }), /expired/);
  // Signed by a key that is not in the platform JWKS.
  const forged = signJwt({ iss: env.LTI_ISSUER }, tool.privateKey, 'p1');
  assert.throws(() => verifyLtiIdToken(forged, config, jwks, { nonce: 'f' }), /signature/);
});

test('AGS passback signs a client assertion and posts a score', async () => {
  const calls: Array<{ url: string; init: any }> = [];
  const fetchImpl = (async (url: string, init: any) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('token.php')) return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
    return new Response('', { status: 200 });
  }) as unknown as typeof fetch;
  const token = await requestAgsToken(config, tool.privateKey, fetchImpl);
  assert.equal(token, 'tok');
  const form = new URLSearchParams(String(calls[0].init.body));
  assert.equal(form.get('grant_type'), 'client_credentials');
  const [, payload] = form.get('client_assertion')!.split('.');
  assert.equal(JSON.parse(Buffer.from(payload, 'base64url').toString()).aud, env.LTI_AUTH_TOKEN_URL);
  const lineitem = 'https://moodle.example.edu/mod/lti/services.php/2/lineitems/5/lineitem?type_id=2';
  await postAgsScore(lineitem, token, { userId: 'moodle-user-7', scoreGiven: 8, scoreMaximum: 10 }, fetchImpl);
  assert.equal(calls[1].url, scoresUrl(lineitem));
  assert.match(calls[1].url, /lineitem\/scores\?type_id=2$/);
  assert.equal(calls[1].init.headers['Content-Type'], 'application/vnd.ims.lis.v1.score+json');
  await assert.rejects(postAgsScore(lineitem, token, { userId: 'u', scoreGiven: 11, scoreMaximum: 10 }, fetchImpl), /Invalid score/);
  assert.equal(toolJwks(env).keys.length, 1);
});
