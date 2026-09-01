# AcademicOS Deployment — 2026-08-11

## 1. Install and verify

```bash
npm ci
npm run typecheck
npm run test:core
npm run test:intelligence
npm run test:security
npm run test:scale
npm run build
npm audit --omit=dev
```

Deploy the generated client/server only after staging passes the role/tenant negative tests and the enabled provider workflows.

## 2. Firebase

Configure the normal Firebase client values plus server credentials/bucket. Protected Firestore/Storage data is server-only under the included deny-by-default rules.

For App Check, set the client site key and enforce only after the deployed origin is registered:

```bash
VITE_FIREBASE_APPCHECK_SITE_KEY=...
REQUIRE_APP_CHECK=true
```

Privileged administrative roles require MFA automatically in production. The flag also enables the same gate in staging; recent authentication protects sensitive actions:

```bash
REQUIRE_ADMIN_MFA=true
PRIVILEGED_REAUTH_MAX_AGE_SECONDS=600
```

## 3. AI gateway

Gemini can remain the primary Google-stack provider, but business logic is provider-neutral. Configure one or more providers and optional fallback aliases using `.env.example`:

- `GEMINI_*`
- `OPENAI_GATEWAY_*`
- `ANTHROPIC_GATEWAY_*`
- `LOCAL_AI_*`
- `INSTITUTION_AI_*`
- `AI_PROVIDER`, `AI_PROVIDER_FALLBACKS`
- economy/balanced/high-risk provider and fast/strong model aliases

Do not expose these secrets through Vite/client variables.

## 4. Isolated workers and connectors

The following are intentionally disabled until their HTTPS endpoint/token/provider credentials are configured:

- `PDF_RENDER_SERVICE_*`
- `VIRUS_SCAN_*` (`REQUIRE_VIRUS_SCAN=true` can make scan failure a hard upload gate)
- `OCR_PRIMARY_*` and optional `OCR_SECONDARY_*` (`REQUIRE_OCR=true` makes verified OCR a hard upload gate; `OCR_ALLOWED_HOSTS` is mandatory in production)
- `BACKUP_WORKER_*`
- `CODE_SANDBOX_*`
- `SEMANTIC_INDEX_*`
- `TRANSLATION_SERVICE_*`
- communication/LMS/productivity/SSO/speech/CRM settings shown in `.env.example`

A configured state must correspond to real credentials. Never replace these gates with success placeholders.

## 5. Global billing and optional regional gateways

Billing stays disabled until merchant onboarding is complete. Select exactly one server-side provider with `BILLING_PROVIDER=disabled|stripe|tap|myfatoorah`; the implementation already supports Stripe Checkout, Tap hosted regional charges, and MyFatoorah Execute Payment. Configure only that provider's credentials from `.env.example`, register its HTTPS webhook route, and exercise a signed sandbox payment/refund/cancellation cycle before enabling paid access.

The public application URL must be HTTPS in production. Provider event IDs are claimed atomically and only verified paid events can activate an entitlement.

## 6. Optional regional digital-identity adapters

The product defaults to Firebase Authentication globally. Country-specific identity adapters remain hidden and disabled unless their regional credentials are explicitly provisioned. For the optional PACI adapter, configure `PACI_*` only for deployments that require it, then complete signed-callback, replay, tenant-binding and failure-path tests before exposing that adapter.

## 7. Initial Platform Owner

The repository already includes the environment-driven bootstrap command; no password is hardcoded:

```bash
ROOT_OWNER_EMAIL="owner@example.com" ROOT_OWNER_TENANT_ID="platform" npm run bootstrap:root
```

After sign-in/token refresh, the Root Owner can grant permitted roles through audited User Management. Enable admin MFA before live privileged use.

## 8. Institution policy and brand

Use Platform Control Plane records for brand, retention, data residency, provider/routing, SSO/LMS and other institution policies. Sensitive changes require the appropriate elevated role/reason and are versioned/audited.

## 9. Emulator and scale verification

Use `.env.emulator.example` for local isolation. `npm run test:auth-emulator` checks authentication claims and pagination against the Firebase Auth emulator; `npm run seed:emulator -- --records=100000` exercises the Firestore emulator; `npm run test:scale` runs the bounded million-record workload.

Emulator results validate application behavior, not production quotas or vendor latency. Run a staged load test with the real deployment topology, distributed rate limiting, observability, backup and restore before a public launch.

## 10. Release gate

Before production traffic, run the checks in `TEST_RESULTS.md`, perform a real backup + restore test with the configured worker, verify all enabled integrations, and complete jurisdiction-specific legal/DPA/retention review. Keep unconfigured integrations disabled.

## 11. Evidence Capsule signing and key rotation

Evidence Capsules work in hash-only mode without a signing key. For deployment-authenticated capsules, generate an Ed25519 key outside the repository and store the private material in the deployment secret manager:

```bash
openssl genpkey -algorithm Ed25519 -out evidence-capsule.pem
base64 < evidence-capsule.pem | tr -d '\n'
```

Set the resulting value as `EVIDENCE_CAPSULE_ED25519_PRIVATE_KEY_B64`. Never commit the PEM or encoded private key.

The public verification endpoint distinguishes a valid self-contained signature from a signer trusted by the current AcademicOS deployment. During key rotation, retain old public SPKI values in the comma-separated `EVIDENCE_CAPSULE_TRUSTED_PUBLIC_KEYS` setting so previously issued capsules remain recognizable without retaining old private keys. Remove a retired public key only when the institution intentionally wants that signer to stop being trusted.
