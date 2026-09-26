// LTI 1.3 (Moodle, Canvas, Blackboard, Brightspace) — tool-side scaffold.
//
// Implements the security-critical parts of an LTI 1.3 Advantage tool:
//   * OIDC third-party login initiation with a signed, expiring state + nonce
//   * id_token (RS256 JWT) validation against the platform JWKS: signature,
//     iss, aud/azp, exp/iat, nonce (replay-protected), deployment_id, version
//   * Assignment & Grade Services (AGS) score passback using a signed
//     client-credentials assertion (RFC 7523)
//
// It is disabled until an institution supplies its platform registration
// through environment variables (see ltiConfig). Account linking / course
// mapping for launched users still needs institution-specific setup.

import { createHmac, createPrivateKey, createPublicKey, randomBytes, sign, timingSafeEqual, verify, type JsonWebKey, type KeyObject } from "node:crypto";

export interface LtiConfig {
  configured: boolean;
  missing: string[];
  issuer: string;
  clientId: string;
  deploymentIds: string[];
  jwksUrl: string;
  authLoginUrl: string;
  tokenUrl: string;
  toolKid: string;
  agsEnabled: boolean;
  tenantId: string;
}

const REQUIRED = ["LTI_ISSUER", "LTI_CLIENT_ID", "LTI_DEPLOYMENT_ID", "LTI_JWKS_URL", "LTI_AUTH_LOGIN_URL"] as const;

export function ltiConfig(env: NodeJS.ProcessEnv = process.env): LtiConfig {
  const get = (key: string) => String(env[key] || "").trim();
  const missing = REQUIRED.filter((key) => !get(key));
  return {
    configured: missing.length === 0,
    missing: [...missing],
    issuer: get("LTI_ISSUER"),
    clientId: get("LTI_CLIENT_ID"),
    deploymentIds: get("LTI_DEPLOYMENT_ID").split(",").map((x) => x.trim()).filter(Boolean),
    jwksUrl: get("LTI_JWKS_URL"),
    authLoginUrl: get("LTI_AUTH_LOGIN_URL"),
    tokenUrl: get("LTI_AUTH_TOKEN_URL"),
    toolKid: get("LTI_TOOL_KID") || "academicos-lti-1",
    agsEnabled: Boolean(get("LTI_AUTH_TOKEN_URL") && get("LTI_TOOL_PRIVATE_KEY_PEM")),
    tenantId: get("LTI_TENANT_ID"),
  };
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const fromB64url = (input: string) => Buffer.from(input, "base64url");

function hmac(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class LtiError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

// ---- OIDC login initiation -------------------------------------------------

export function createLtiState(secret: string, input: { nonce: string; targetLinkUri: string; now?: number; ttlSeconds?: number }) {
  const payload = b64url(
    JSON.stringify({ n: input.nonce, t: input.targetLinkUri, e: Math.floor((input.now ?? Date.now()) / 1000) + (input.ttlSeconds ?? 600) }),
  );
  return `${payload}.${hmac(secret, payload)}`;
}

export function verifyLtiState(secret: string, state: string, now = Date.now()): { nonce: string; targetLinkUri: string } {
  const [payload, mac] = String(state || "").split(".");
  if (!payload || !mac || !safeEqual(hmac(secret, payload), mac)) throw new LtiError("Invalid LTI state", "LTI_STATE_INVALID", 401);
  const data = JSON.parse(fromB64url(payload).toString("utf8"));
  if (!data?.n || Number(data.e) < Math.floor(now / 1000)) throw new LtiError("Expired LTI state", "LTI_STATE_EXPIRED", 401);
  return { nonce: String(data.n), targetLinkUri: String(data.t || "") };
}

export function buildLoginRedirect(
  config: LtiConfig,
  params: Record<string, unknown>,
  secret: string,
  launchUrl: string,
): { url: string; nonce: string } {
  if (!config.configured) throw new LtiError("LTI is not configured", "LTI_NOT_CONFIGURED", 503);
  const iss = String(params.iss || "");
  const loginHint = String(params.login_hint || "");
  const clientId = String(params.client_id || config.clientId);
  if (iss !== config.issuer) throw new LtiError("Unknown LTI platform", "LTI_ISSUER_MISMATCH", 400);
  if (clientId !== config.clientId) throw new LtiError("Unknown LTI client", "LTI_CLIENT_MISMATCH", 400);
  if (!loginHint) throw new LtiError("login_hint is required", "LTI_LOGIN_HINT_REQUIRED", 400);
  const nonce = randomBytes(18).toString("base64url");
  const target = String(params.target_link_uri || launchUrl);
  const url = new URL(config.authLoginUrl);
  const query: Record<string, string> = {
    scope: "openid",
    response_type: "id_token",
    response_mode: "form_post",
    prompt: "none",
    client_id: config.clientId,
    redirect_uri: launchUrl,
    login_hint: loginHint,
    state: createLtiState(secret, { nonce, targetLinkUri: target }),
    nonce,
  };
  if (params.lti_message_hint) query.lti_message_hint = String(params.lti_message_hint);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return { url: url.toString(), nonce };
}

// ---- JWKS + id_token validation ------------------------------------------

type Jwks = { keys: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> };
const jwksCache = new Map<string, { at: number; jwks: Jwks }>();

export async function fetchJwks(url: string, fetchImpl: typeof fetch = fetch, maxAgeMs = 10 * 60_000): Promise<Jwks> {
  const cached = jwksCache.get(url);
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.jwks;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new LtiError("Could not fetch platform JWKS", "LTI_JWKS_UNAVAILABLE", 502);
  const jwks = (await response.json()) as Jwks;
  if (!Array.isArray(jwks?.keys)) throw new LtiError("Invalid platform JWKS", "LTI_JWKS_INVALID", 502);
  jwksCache.set(url, { at: Date.now(), jwks });
  return jwks;
}

export function clearJwksCache() {
  jwksCache.clear();
}

const usedNonces = new Map<string, number>();
function consumeNonce(nonce: string, exp: number, now: number) {
  for (const [key, until] of usedNonces) if (until < now) usedNonces.delete(key);
  if (usedNonces.has(nonce)) throw new LtiError("LTI nonce was already used", "LTI_NONCE_REPLAY", 401);
  usedNonces.set(nonce, Math.max(exp * 1000, now + 60_000));
}

const CLAIM = "https://purl.imsglobal.org/spec/lti/claim/";
const AGS_CLAIM = "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint";

export interface LtiLaunch {
  subject: string;
  name?: string;
  email?: string;
  roles: string[];
  messageType: string;
  deploymentId: string;
  context?: { id: string; label?: string; title?: string };
  resourceLink?: { id: string; title?: string };
  targetLinkUri?: string;
  ags?: { lineitem?: string; lineitems?: string; scope: string[] };
}

export function verifyLtiIdToken(
  idToken: string,
  config: LtiConfig,
  jwks: Jwks,
  expected: { nonce: string; now?: number; clockSkewSeconds?: number },
): LtiLaunch {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new LtiError("Malformed id_token", "LTI_TOKEN_MALFORMED", 401);
  const [h, p, s] = parts;
  const header = JSON.parse(fromB64url(h).toString("utf8"));
  if (header.alg !== "RS256") throw new LtiError("Unsupported id_token algorithm", "LTI_TOKEN_ALG", 401);
  const jwk = jwks.keys.find((key) => (header.kid ? key.kid === header.kid : true) && key.kty === "RSA");
  if (!jwk) throw new LtiError("No matching platform key", "LTI_TOKEN_KID", 401);
  const publicKey = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
  if (!verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, fromB64url(s)))
    throw new LtiError("Invalid id_token signature", "LTI_TOKEN_SIGNATURE", 401);
  const claims = JSON.parse(fromB64url(p).toString("utf8"));
  const now = Math.floor((expected.now ?? Date.now()) / 1000);
  const skew = expected.clockSkewSeconds ?? 60;
  if (claims.iss !== config.issuer) throw new LtiError("id_token issuer mismatch", "LTI_TOKEN_ISS", 401);
  const aud: string[] = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(config.clientId)) throw new LtiError("id_token audience mismatch", "LTI_TOKEN_AUD", 401);
  if (aud.length > 1 && claims.azp !== config.clientId) throw new LtiError("id_token azp mismatch", "LTI_TOKEN_AZP", 401);
  if (typeof claims.exp !== "number" || claims.exp + skew < now) throw new LtiError("id_token expired", "LTI_TOKEN_EXPIRED", 401);
  if (typeof claims.iat !== "number" || claims.iat - skew > now) throw new LtiError("id_token issued in the future", "LTI_TOKEN_IAT", 401);
  if (!claims.nonce || claims.nonce !== expected.nonce) throw new LtiError("id_token nonce mismatch", "LTI_TOKEN_NONCE", 401);
  const deploymentId = String(claims[`${CLAIM}deployment_id`] || "");
  if (!config.deploymentIds.includes(deploymentId)) throw new LtiError("Unknown LTI deployment", "LTI_DEPLOYMENT", 401);
  if (claims[`${CLAIM}version`] !== "1.3.0") throw new LtiError("Unsupported LTI version", "LTI_VERSION", 401);
  const messageType = String(claims[`${CLAIM}message_type`] || "");
  if (!["LtiResourceLinkRequest", "LtiDeepLinkingRequest"].includes(messageType))
    throw new LtiError("Unsupported LTI message", "LTI_MESSAGE_TYPE", 400);
  consumeNonce(String(claims.nonce), Number(claims.exp), now * 1000);
  const context = claims[`${CLAIM}context`];
  const link = claims[`${CLAIM}resource_link`];
  const ags = claims[AGS_CLAIM];
  return {
    subject: String(claims.sub || ""),
    name: claims.name ? String(claims.name) : undefined,
    email: claims.email ? String(claims.email) : undefined,
    roles: Array.isArray(claims[`${CLAIM}roles`]) ? claims[`${CLAIM}roles`].map(String) : [],
    messageType,
    deploymentId,
    ...(context?.id ? { context: { id: String(context.id), label: context.label, title: context.title } } : {}),
    ...(link?.id ? { resourceLink: { id: String(link.id), title: link.title } } : {}),
    targetLinkUri: claims[`${CLAIM}target_link_uri`] ? String(claims[`${CLAIM}target_link_uri`]) : undefined,
    ...(ags ? { ags: { lineitem: ags.lineitem, lineitems: ags.lineitems, scope: Array.isArray(ags.scope) ? ags.scope : [] } } : {}),
  };
}

// ---- Tool keys + AGS -------------------------------------------------------

export function toolPrivateKey(env: NodeJS.ProcessEnv = process.env): KeyObject | null {
  const pem = String(env.LTI_TOOL_PRIVATE_KEY_PEM || "").replace(/\\n/g, "\n").trim();
  if (!pem) return null;
  return createPrivateKey(pem);
}

export function toolJwks(env: NodeJS.ProcessEnv = process.env) {
  const key = toolPrivateKey(env);
  if (!key) return { keys: [] };
  const jwk = createPublicKey(key).export({ format: "jwk" }) as JsonWebKey;
  return { keys: [{ ...jwk, kid: ltiConfig(env).toolKid, alg: "RS256", use: "sig" }] };
}

export function signJwt(payload: Record<string, unknown>, key: KeyObject, kid: string) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const body = b64url(JSON.stringify(payload));
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${body}`), key).toString("base64url");
  return `${header}.${body}.${signature}`;
}

export const AGS_SCORE_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/score";

export async function requestAgsToken(config: LtiConfig, key: KeyObject, fetchImpl: typeof fetch = fetch, now = Date.now()) {
  if (!config.tokenUrl) throw new LtiError("LTI token URL is not configured", "LTI_AGS_NOT_CONFIGURED", 503);
  const iat = Math.floor(now / 1000);
  const assertion = signJwt(
    { iss: config.clientId, sub: config.clientId, aud: config.tokenUrl, iat, exp: iat + 300, jti: randomBytes(16).toString("hex") },
    key,
    config.toolKid,
  );
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
    scope: AGS_SCORE_SCOPE,
  });
  const response = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new LtiError("Platform rejected the AGS token request", "LTI_AGS_TOKEN", 502);
  const data: any = await response.json();
  if (!data?.access_token) throw new LtiError("Platform returned no access token", "LTI_AGS_TOKEN", 502);
  return String(data.access_token);
}

export interface AgsScore {
  userId: string;
  scoreGiven: number;
  scoreMaximum: number;
  comment?: string;
  activityProgress?: "Initialized" | "Started" | "InProgress" | "Submitted" | "Completed";
  gradingProgress?: "FullyGraded" | "Pending" | "PendingManual" | "Failed" | "NotReady";
}

export function scoresUrl(lineitem: string) {
  const url = new URL(lineitem);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/scores`;
  return url.toString();
}

export async function postAgsScore(lineitem: string, accessToken: string, score: AgsScore, fetchImpl: typeof fetch = fetch, now = new Date()) {
  if (!(score.scoreMaximum > 0) || score.scoreGiven < 0 || score.scoreGiven > score.scoreMaximum)
    throw new LtiError("Invalid score", "LTI_AGS_SCORE_INVALID", 400);
  const response = await fetchImpl(scoresUrl(lineitem), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/vnd.ims.lis.v1.score+json" },
    body: JSON.stringify({
      userId: score.userId,
      scoreGiven: score.scoreGiven,
      scoreMaximum: score.scoreMaximum,
      comment: score.comment,
      timestamp: now.toISOString(),
      activityProgress: score.activityProgress || "Completed",
      gradingProgress: score.gradingProgress || "FullyGraded",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new LtiError("Platform rejected the score", "LTI_AGS_SCORE_REJECTED", 502);
  return { status: response.status };
}
