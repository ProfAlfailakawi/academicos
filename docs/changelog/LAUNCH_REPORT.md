# AcademicOS Launch Candidate — Implementation Report

## What changed
- Production authentication now fails closed; no local/root-owner fallback.
- Privileged routes are role-guarded and production MFA/App Check gates are enforced by configuration.
- Student UX centers on a universal academic intake, project/rescue/exam routing, submission readiness, and voice Viva.
- ProfessorOS includes class pulse, assignment drop, AI policy controls, and teacher copilot surfaces.
- Control Plane includes product funnel, AI quality/cost visibility, emergency controls, and Fair-Use telemetry.
- Style & Integrity Guardian replaces unsupported AI/Turnitin claims.
- Crossref-backed source identity verification replaces planted reference data.
- Requirement, visual, red-team, presentation, portfolio and dossier surfaces are evidence-bound.
- Global-first i18n supports Arabic, English, Turkish, Chinese, Hindi, Spanish, French and Urdu with RTL/LTR handling.
- Project/export language flows into HTML/DOCX/PPTX/XLSX direction and Office language metadata.
- Billing defaults to global USD launch prices rather than KWD product identity.
- Fair-Use Shield protects free benefits using verified email, App Check, installation token, coarse privacy-preserving device signals, hashed email/network signals, velocity and atomic expiring reservations. It deliberately does not use MAC/canvas/audio/font fingerprinting.
- Firebase runtime config is deployment-injected; no developer Firebase project is shipped in the patch.

## Release gates completed in this environment
- `node scripts/static-release-audit.mjs`: 22/22 PASS.
- `git diff --check`: PASS.

## Gate not completed in this environment
- `npm ci` timed out because dependency installation/network access did not complete, so TypeScript/build/E2E could not be truthfully certified here.

## Production launch requirements
1. Populate `.env.production.example` values using production secrets/configuration.
2. Configure production Firebase Auth, App Check, Firestore/Storage and privileged MFA.
3. Configure at least one AI provider and current models.
4. Configure the chosen payment provider for public paid launch.
5. Run `npm ci`, `npm run typecheck`, `npm run build`, `npm run test:ci`, emulator workflows, and `npm run verify:production` in CI/staging.
6. Deploy to staging, test Student / Professor / Admin personas, payment webhook, file uploads, voice Viva, Crossref, and free-preview abuse cases.
7. Only then promote the same immutable build to production.

## Pricing recommendation
Launch base: Free Preview, $6.99 Project, $8.99 Project + Viva, $12.99 Team Project. Measure activation-to-checkout and repeat-project conversion before lowering further.
