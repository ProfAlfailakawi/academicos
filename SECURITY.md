# AcademicOS Security Notes

## Trust boundaries

- The browser is untrusted.
- Authorization is enforced on the server using a verified Firebase ID token, `tenantId`, role and resource ownership.
- Assignment files and their extracted contents are untrusted data. The AI compiler receives a separate system instruction that explicitly rejects prompt-injection attempts embedded in files.
- AI/provider and billing secrets never belong in frontend variables.
- There is no authentication bypass; local test users still obtain verified Firebase emulator tokens and tenant/role claims.

## Data access

- Production project reads/writes are scoped by both `tenantId` and `userId` in the server store.
- Institution Control Plane reads are scoped to the authenticated tenant.
- Original uploads are stored under tenant/user paths and opened through short-lived signed URLs after an ownership check.
- `firestore.rules` and `storage.rules` deny broad direct-client access to protected data; sensitive writes are backend-only.

## Privileged roles

The first `root_owner` is created with `scripts/bootstrap-root.mjs` using `ROOT_OWNER_EMAIL`. Credentials are not hardcoded. Privileged roles require MFA in production; sensitive actions also require recent authentication. Organizational access controls and recovery procedures remain identity-layer deployment responsibilities.

## Request hardening

- Security headers are set by the Express server.
- CORS is configurable with `ALLOWED_ORIGINS`.
- Payload/file count and size limits are enforced server-side.
- ZIP extraction has entry/expanded-size limits.
- Public shares use expiring, allowlisted snapshots, asynchronous password hashing and bounded lockout after repeated failures.
- Payment entitlements are created only from signed provider webhooks with atomic event idempotency.
- API read/write rate limits are configurable per server instance.
- `MAINTENANCE_MODE=true` disables API write actions.

For multi-instance/global production, place a distributed edge rate limiter / WAF in front of the service; the included in-process limiter is a working last-line safeguard, not a global quota service.

## Reporting

Do not publish a security-reporting address until the operating entity owns and monitors it. Add the real responsible-disclosure contact before public launch.
