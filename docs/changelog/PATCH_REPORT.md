# Academicos Global UI + Launch Hardening Patch

Source reviewed: academicos(3).zip

## Final static gates
- Release/security invariants: 22/22 PASS
- Global UI/i18n invariants: 24/24 PASS
- TypeScript syntax audit: 107 files, 0 syntax errors

## Major fixes in this patch
- Fixed shared App Shell RTL/LTR layout collision and responsive sidebar/content spacing.
- Added pre-React locale/direction bootstrap to prevent wrong-direction flash.
- Hardened long-translation overflow and medium/mobile topbar behavior.
- Completed eight launch locales across routed UI and runtime metadata.
- Removed Kuwait/KWD/ar-KW product assumptions from user-facing defaults.
- Restored discoverable student utility routes without sidebar clutter.
- Localized platform/integration runtime metadata and enum/status labels.
- Localized project, learning-evidence, citation, and course-archive exports.
- Kept raw machine statuses in canonical data while adding human localized labels.
- Re-removed client-side fake/local authentication regression.
- Added Global UI audit and TypeScript syntax audit to release tooling.
- Updated GitHub Actions to Node-24-native action versions and npm ci.
- Added static launch gates to CI before typecheck/build/tests.

## CI note
A real `npm ci` was attempted in the working environment but timed out because dependency download networking was unavailable/too slow. Therefore this report does NOT claim a completed dependency-backed `tsc`, Vite build, or E2E run in this environment. GitHub CI remains the authoritative dependency-backed gate.
