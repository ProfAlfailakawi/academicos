# AcademicOS

**The Operating System for Human Learning in the AI Age — From Assignment to Evidence.**

AcademicOS turns an assignment, rubric, brief, dataset or project file into a structured academic workspace: it extracts the requirements and rubric into a Project DNA, opens only the studios the project needs, keeps a verifiable record of how the work was produced, and prepares the student to defend it (Viva). Faculty get CourseOS / ProfessorOS, a submissions desk and anonymous cohort insight; institutions get a tenant-scoped Control Plane. The UI is Arabic-first (RTL) with 8 languages.

> النسخة العربية: [README.ar.md](README.ar.md)

**Live:** <https://academicos-edu.web.app> (official domain). `academicos-kw.web.app` and the raw Cloud Run URL redirect to it.

[![CI](https://github.com/ProfAlfailakawi/academicos/actions/workflows/ci.yml/badge.svg)](https://github.com/ProfAlfailakawi/academicos/actions/workflows/ci.yml)
[![Deploy to Cloud Run](https://github.com/ProfAlfailakawi/academicos/actions/workflows/deploy-cloud-run.yml/badge.svg)](https://github.com/ProfAlfailakawi/academicos/actions/workflows/deploy-cloud-run.yml)

> **Production readiness, as reported by the live `GET /api/health` on 2026-11-12:** no AI provider is configured (`aiConfigured: false`), the Cloud Storage bucket is not reachable (`STORAGE_BUCKET_NOT_FOUND`), billing is `disabled`, OCR / malware scanning / email-push-SMS notifications are not configured, and the **demo sandbox is enabled**. Features that depend on those services (AI compilation, Copilot, Writer, Learn Studio, original-file storage, checkout) fall back to deterministic/scaffold output or return a "not configured" error until the owner sets the corresponding variables from [.env.example](.env.example).

---

## Feature map / خريطة الميزات

Status legend: **Works** = wired end to end (UI → API → Firestore) and covered by tests · **Needs config** = code is complete but depends on a service that is off in production today · **Experimental (تجريبي)** = server logic/API exists but there is no UI, or it is a scaffold.

Routes under `/app/*` require sign-in; faculty/admin routes are additionally role-guarded in [src/App.tsx](src/App.tsx).

### Student

| Feature | What it does | Live route | Code | Status |
|---|---|---|---|---|
| Public site & marketing pages | Home, students/faculty, pricing, about, FAQ, contact, security, privacy, terms, accessibility | [/](https://academicos-edu.web.app/), [/p/pricing](https://academicos-edu.web.app/p/pricing) | [src/pages/PublicHome.tsx](src/pages/PublicHome.tsx), [src/pages/PublicPage.tsx](src/pages/PublicPage.tsx) | Works |
| Sign-in, MFA, onboarding | Firebase Auth with ID-token verification, role/tenant claims, optional MFA enrolment, persisted onboarding | [/login](https://academicos-edu.web.app/login), `/mfa-setup`, `/app/onboarding` | [src/pages/Login.tsx](src/pages/Login.tsx), [src/pages/MfaSetup.tsx](src/pages/MfaSetup.tsx), [src/pages/Onboarding.tsx](src/pages/Onboarding.tsx), [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) | Works |
| Demo sandbox | One-hour demo session isolated from real Firestore (enabled on production) | via [/login](https://academicos-edu.web.app/login) | [src/server/demoSandbox.ts](src/server/demoSandbox.ts), [src/server/demoFirestore.ts](src/server/demoFirestore.ts), [server.ts](server.ts) (`/api/demo/*`) | Works |
| Mission Control / role home | Student home: next best action, semester view, quick intake; other roles get a role home | `/app` | [src/pages/MissionControl.tsx](src/pages/MissionControl.tsx), [src/pages/RoleHome.tsx](src/pages/RoleHome.tsx) | Works |
| Universal Assignment Intake | Text + up to 10 files; DOCX/PPTX/XLSX/ZIP/text extraction, SHA-256 provenance, compiles a Project DNA | `/app/upload` | [src/pages/UploadAssignment.tsx](src/pages/UploadAssignment.tsx), [src/server/file-extract.ts](src/server/file-extract.ts), [src/server/project-engine.ts](src/server/project-engine.ts), [src/server/native-compiler.ts](src/server/native-compiler.ts) | Works (AI compile: Needs config) |
| Projects list & archive | All projects, archived projects | `/app/projects`, `/app/archive` | [src/pages/Projects.tsx](src/pages/Projects.tsx), [src/pages/Archive.tsx](src/pages/Archive.tsx) | Works |
| Adaptive project workspace | Project DNA, only the relevant studios, revisions/restore, comments, activity timeline | `/app/project/:id` | [src/pages/ProjectWorkspace.tsx](src/pages/ProjectWorkspace.tsx), [src/components/dna/DnaKit.tsx](src/components/dna/DnaKit.tsx) | Works |
| Requirement matrix & rubric drill-down | Links each rubric criterion to workspace items/evidence, lists what is missing, turns a gap into the next action | inside `/app/project/:id` | [src/components/project/RequirementMatrixStudio.tsx](src/components/project/RequirementMatrixStudio.tsx), [src/components/project/RubricDrilldown.tsx](src/components/project/RubricDrilldown.tsx), [src/server/rubric-drilldown.ts](src/server/rubric-drilldown.ts), [src/server/routes/rubric.ts](src/server/routes/rubric.ts) | Works |
| Project Writer | Section-by-section writing studio with persisted drafts | inside `/app/project/:id` | [src/components/project/ProjectWriterStudio.tsx](src/components/project/ProjectWriterStudio.tsx), [src/server/project-writer.ts](src/server/project-writer.ts) | Works (generation: Needs config) |
| Project Copilot (retrieval) | Answers grounded in the project's own indexed material | inside `/app/project/:id` | [src/components/project/ProjectCopilot.tsx](src/components/project/ProjectCopilot.tsx), [src/server/copilot.ts](src/server/copilot.ts), [src/server/retrieval.ts](src/server/retrieval.ts) | Needs config (AI) |
| Evidence Studio & Evidence Capsule | Evidence items mapped to deliverables/rubric; exportable capsule verifiable publicly | inside `/app/project/:id` | [src/components/project/EvidenceStudio.tsx](src/components/project/EvidenceStudio.tsx), [server.ts](server.ts) (`/api/projects/:id/evidence*`) | Works |
| Authorship record (process evidence) | Timeline of drafts, revisions, viva answers and source checks; server-signed report (SHA-256 + HMAC) | inside `/app/project/:id` | [src/components/project/ProcessEvidenceTimeline.tsx](src/components/project/ProcessEvidenceTimeline.tsx), [src/server/process-evidence.ts](src/server/process-evidence.ts), [src/server/routes/process-evidence.ts](src/server/routes/process-evidence.ts) | Works (self-reported evidence, see [SECURITY-TODO.md](SECURITY-TODO.md) §7) |
| Evidence verification page | Public verification of a signed authorship report | [/verify-evidence](https://academicos-edu.web.app/verify-evidence) | [src/pages/VerifyEvidence.tsx](src/pages/VerifyEvidence.tsx) | Works |
| Authorship & integrity check | Explains style/integrity signals an assessor may ask about; does **not** claim AI detection | inside `/app/project/:id` | [src/components/project/AuthorshipIntegrityModal.tsx](src/components/project/AuthorshipIntegrityModal.tsx), [src/server/deep-ai-detector.ts](src/server/deep-ai-detector.ts) | Works |
| Viva Simulator & Proof of Learning | Oral-defence practice with voice input (ar-KW dictation), extended time, screen-reader flow | inside `/app/project/:id` | [src/components/project/VivaStudio.tsx](src/components/project/VivaStudio.tsx), [src/server/viva.ts](src/server/viva.ts), [src/lib/viva-access.ts](src/lib/viva-access.ts), [src/lib/speech.ts](src/lib/speech.ts) | Works |
| Reverse assessment, red-teaming, Grade-Loss Map, Ghost Cohort | Student writes the examiner's questions; adversarial review; where marks are lost; anonymous (k ≥ 5) pacing of past cohorts | inside `/app/project/:id` | [src/components/project/ReverseAssessmentStudio.tsx](src/components/project/ReverseAssessmentStudio.tsx), [src/components/project/RedTeamingArena.tsx](src/components/project/RedTeamingArena.tsx), [src/components/project/GradeLossMap.tsx](src/components/project/GradeLossMap.tsx), [src/components/project/GhostCohortPanel.tsx](src/components/project/GhostCohortPanel.tsx), [src/server/advanced/routes.ts](src/server/advanced/routes.ts) | Works |
| Other project studios | Source checks (DOI/search), data visualiser, auto-presentation, citation-style formatter, academic dossier, portfolio badge | inside `/app/project/:id` | [src/components/project/LiveScholarVerifier.tsx](src/components/project/LiveScholarVerifier.tsx), [src/components/project/DynamicDataVisualizer.tsx](src/components/project/DynamicDataVisualizer.tsx), [src/components/project/AutoPresentationStudio.tsx](src/components/project/AutoPresentationStudio.tsx), [src/components/project/CrossStyleFormatter.tsx](src/components/project/CrossStyleFormatter.tsx), [src/components/project/AcademicDossierModal.tsx](src/components/project/AcademicDossierModal.tsx) | Works |
| Assignment clarifications (student side) | Shows official clarifications posted by the instructor | inside `/app/project/:id` | [src/components/project/AssignmentClarifications.tsx](src/components/project/AssignmentClarifications.tsx), [src/server/routes/instructor.ts](src/server/routes/instructor.ts) | Works |
| Team Studio & invitations | Same-tenant group invitations, member access, contribution evidence | `/app/invitations`, inside `/app/project/:id` | [src/components/project/TeamStudio.tsx](src/components/project/TeamStudio.tsx), [src/pages/Invitations.tsx](src/pages/Invitations.tsx), [src/server/project-access.ts](src/server/project-access.ts) | Works |
| Exports & public share links | JSON / Markdown / ZIP export bundle; time-limited public share page | `/share/:token` | [src/server/export.ts](src/server/export.ts), [src/pages/PublicShare.tsx](src/pages/PublicShare.tsx), [src/server/routes/public-share.ts](src/server/routes/public-share.ts) | Works |
| Learn Studio (tutor / solver) | Explain, guided solve and practice with disclosure; scaffold output when AI is off | `/app/learn` | [src/pages/LearnStudio.tsx](src/pages/LearnStudio.tsx), [src/server/routes/ai.ts](src/server/routes/ai.ts), [src/server/tutor.ts](src/server/tutor.ts), [src/server/solver.ts](src/server/solver.ts), [src/server/learn-cache.ts](src/server/learn-cache.ts) | Needs config (AI) |
| Calendar, notifications, search | Deadlines calendar, in-app notifications (SSE), permission-aware catalog search | `/app/calendar`, `/app/notifications`, `/app/search` | [src/pages/Calendar.tsx](src/pages/Calendar.tsx), [src/pages/Notifications.tsx](src/pages/Notifications.tsx), [src/pages/SearchWorkspace.tsx](src/pages/SearchWorkspace.tsx), [src/server/notifications.ts](src/server/notifications.ts), [src/server/realtime.ts](src/server/realtime.ts) | Works |
| Skill Genome & Academic Passport | Evidence-based skills and a private passport | `/app/skills`, `/app/passport` | [src/pages/Skills.tsx](src/pages/Skills.tsx), [src/pages/Passport.tsx](src/pages/Passport.tsx) | Works |
| Offline mode | Active project's matrix and drafts cached locally; edit queue replays on reconnect | any `/app` route | [src/lib/offline-store.ts](src/lib/offline-store.ts), [src/lib/offline-sync.ts](src/lib/offline-sync.ts), [src/components/OfflineBanner.tsx](src/components/OfflineBanner.tsx) | Works |
| Plans & checkout | Plan cards; checkout via Stripe / Tap / MyFatoorah / Lemon Squeezy | `/app/plans` | [src/pages/Plans.tsx](src/pages/Plans.tsx), [src/server/billing.ts](src/server/billing.ts), [src/server/routes/billing.ts](src/server/routes/billing.ts), [docs/PAYMENT_SETUP_AR.md](docs/PAYMENT_SETUP_AR.md) | Needs config (billing disabled in production) |
| Settings, data export, support | Profile, notification preferences, "Download my data", teacher-account request card, support tickets | `/app/settings`, `/app/support` | [src/pages/Settings.tsx](src/pages/Settings.tsx), [src/components/TeacherAccountCard.tsx](src/components/TeacherAccountCard.tsx), [src/pages/Support.tsx](src/pages/Support.tsx) | Works |

### Faculty

| Feature | What it does | Live route | Code | Status |
|---|---|---|---|---|
| ProfessorOS | Faculty home: courses, assignment builder, faculty copilot/automation | `/app/professor` | [src/pages/ProfessorOS.tsx](src/pages/ProfessorOS.tsx) | Works |
| CourseOS | Course page: assignments, outcome mapping, quality checks, enrolment codes | `/app/course/:id` | [src/pages/CourseOS.tsx](src/pages/CourseOS.tsx) | Works |
| Submissions desk | Per-assignment submissions, scores and receipts | `/app/course/:courseId/assignment/:assignmentId/submissions` | [src/pages/AssignmentSubmissions.tsx](src/pages/AssignmentSubmissions.tsx) | Works |
| Cohort insight & clarification room | Anonymous view of where the class is stuck; post official clarifications to students | inside `/app/course/:id` | [src/components/course/CohortInsightDialog.tsx](src/components/course/CohortInsightDialog.tsx), [src/server/cohort-insight.ts](src/server/cohort-insight.ts), [src/server/routes/instructor.ts](src/server/routes/instructor.ts) | Works |
| Teacher account requests | Users request a teacher role; owners approve/reject with audit and anti-self-promotion rules | `/app/teacher-requests` (admins) | [src/pages/TeacherRequests.tsx](src/pages/TeacherRequests.tsx), [src/server/teacher-requests.ts](src/server/teacher-requests.ts), [src/server/routes/teacher-requests.ts](src/server/routes/teacher-requests.ts) | Works |
| LTI 1.3 (Moodle, Canvas, Blackboard, Brightspace) | OIDC login, id_token validation, JWKS, AGS score passback | `/app/integrations` | [src/server/lti.ts](src/server/lti.ts), [src/server/routes/lti.ts](src/server/routes/lti.ts), [src/components/LtiPanel.tsx](src/components/LtiPanel.tsx) | Experimental (tool-side scaffold; needs platform registration) |

### Institution & platform

| Feature | What it does | Live route | Code | Status |
|---|---|---|---|---|
| Institution Control Plane | Tenant-scoped projects, audit, AI-cost and incident data | `/app/control` | [src/pages/ControlPlane.tsx](src/pages/ControlPlane.tsx), [src/server/platform-store.ts](src/server/platform-store.ts) | Works |
| Curriculum Twin | Department-level curriculum model and simulation | `/app/curriculum-twin` | [src/pages/CurriculumTwin.tsx](src/pages/CurriculumTwin.tsx), [src/server/intelligence.ts](src/server/intelligence.ts) | Works |
| User administration | Directory, bounded role assignment, suspend, reason-required audit, Root protection, session revocation; read-only impersonation (off unless `IMPERSONATION_ENABLED=true` **and** tenant policy) | `/app/users` | [src/pages/UserManagement.tsx](src/pages/UserManagement.tsx), [src/server/security-controls.ts](src/server/security-controls.ts), [src/server/audit.ts](src/server/audit.ts) | Works |
| Platform hub, feature flags, integrations | Platform records/versions, tenant feature flags, integration status | `/app/platform`, `/app/integrations` | [src/pages/PlatformHub.tsx](src/pages/PlatformHub.tsx), [src/pages/Integrations.tsx](src/pages/Integrations.tsx), [src/server/capability-registry.ts](src/server/capability-registry.ts) | Works |
| Support console & jobs | Support-agent ticket console; background job list with cancel | `/app/support-console`, `/app/jobs` | [src/pages/SupportConsole.tsx](src/pages/SupportConsole.tsx), [src/pages/Jobs.tsx](src/pages/Jobs.tsx) | Works |
| Status & security report | Public service status / incident banner and security report | [/status](https://academicos-edu.web.app/status), [/security-report](https://academicos-edu.web.app/security-report) | [src/pages/Status.tsx](src/pages/Status.tsx), [src/pages/SecurityReport.tsx](src/pages/SecurityReport.tsx) | Works |
| "Updating" page during deploys | Branded page shown instead of Google's default while Cloud Run rolls out | — | [public/updating.html](public/updating.html), [src/lib/updating-notice.ts](src/lib/updating-notice.ts) | Works |
| Browser error sensor (ORBIT) | Anonymous client error notes (no query strings, no user data) | — | [public/orbit-sensor.js](public/orbit-sensor.js) | Works |
| PWA + responsive shell | Installable PWA, dark mode, reduced motion, tablet rail (600–1023 px), iPhone Duo folded posture | — | [public/manifest.webmanifest](public/manifest.webmanifest), [public/sw.js](public/sw.js), [src/components/Layout.tsx](src/components/Layout.tsx), [src/duo.css](src/duo.css) | Works |
| Native iOS / iPadOS / Mac shell | Capacitor wrapper that loads the live site, with store metadata and release script | — | [apple/capacitor.config.json](apple/capacitor.config.json), [apple/apple-release.sh](apple/apple-release.sh), [apple-release](apple-release) | Experimental (needs Xcode/App Store submission) |

### Server-only APIs without a UI (Experimental / تجريبي)

These endpoints exist and are unit-tested in [tests/advanced.test.ts](tests/advanced.test.ts) / [tests/frontier.test.ts](tests/frontier.test.ts), but no page in `src/` calls them yet:

| Feature | Endpoint | Code |
|---|---|---|
| Peer explanation bank | `POST /api/courses/:courseId/peer-explanations` | [src/server/advanced/peer-explanation.ts](src/server/advanced/peer-explanation.ts) |
| Learning Black Box verification (client recorder was removed) | `POST /api/projects/:id/black-box/verify` | [src/server/advanced/learning-black-box.ts](src/server/advanced/learning-black-box.ts) |
| Alumni Legacy listing | `POST /api/projects/:id/legacy-listing` | [src/server/advanced/alumni-legacy.ts](src/server/advanced/alumni-legacy.ts) |
| WhatsApp intake webhook | `GET/POST /api/whatsapp/webhook` | [src/server/advanced/whatsapp-gateway.ts](src/server/advanced/whatsapp-gateway.ts) |
| Frontier engines: accreditation dossier, deadline congestion, assignment-integrity lint, grader fairness, federated graph | `/api/intelligence/*` | [src/server/frontier.ts](src/server/frontier.ts), [docs/FRONTIER_ENGINES.md](docs/FRONTIER_ENGINES.md) |
| Sandboxed code execution | `POST /api/tools/code/execute` (returns 503 until a sandbox is configured) | [src/server/external-adapters.ts](src/server/external-adapters.ts) |
| OCR for scanned documents | used by intake when configured (off in production) | [src/server/ocr.ts](src/server/ocr.ts) |

---

## Architecture

- **Client:** React 19 + React Router + Vite 6 + Tailwind CSS 4, lazy-loaded pages in [src/pages](src/pages), shared UI in [src/components](src/components), API client in [src/lib/api.ts](src/lib/api.ts), i18n in [src/lib/i18n.tsx](src/lib/i18n.tsx).
- **Server:** one Express app in [server.ts](server.ts) (security headers/CSP, rate limits, maintenance write-lock, SPA fallback) plus domain route modules in [src/server/routes](src/server/routes) and [src/server/advanced/routes.ts](src/server/advanced/routes.ts).
- **Data:** Firebase Auth + Firestore + Cloud Storage via Firebase Admin **from the server only**. [firestore.rules](firestore.rules) and [storage.rules](storage.rules) deny direct client access (users may read only their own profile).
- **AI:** provider abstraction in [src/server/ai.ts](src/server/ai.ts) (Gemini, OpenAI, Anthropic, local and institution gateway adapters); prompts in [src/server/prompts.ts](src/server/prompts.ts).
- **Hosting:** Firebase Hosting site `academicos-edu` rewrites everything to Cloud Run service `academicos-app` (europe-west2) — see [firebase.json](firebase.json) and [Dockerfile](Dockerfile).

Key endpoints:

| Endpoint | File |
|---|---|
| `GET /api/health`, `/api/health/live`, `/api/health/firestore`, `/api/version` | [server.ts](server.ts) |
| `POST /api/projects/compile`, `/api/projects`, `/api/projects/:id/*` (export, copilot, writer, evidence, viva, audit) | [server.ts](server.ts) |
| `/api/projects/:id/rubric-drilldown`, `/api/projects/:id/rubric/:criterionId/gap-task` | [src/server/routes/rubric.ts](src/server/routes/rubric.ts) |
| `/api/projects/:id/process-evidence`, `POST /api/public/process-evidence/verify` | [src/server/routes/process-evidence.ts](src/server/routes/process-evidence.ts) |
| `/api/learn/intake`, `/api/learn/explain`, `/api/learn/solve`, `/api/translate` | [src/server/routes/ai.ts](src/server/routes/ai.ts) |
| `/api/courses/:courseId/assignments/:assignmentId/cohort-insight`, `.../clarifications` | [src/server/routes/instructor.ts](src/server/routes/instructor.ts) |
| `/api/teacher-requests`, `/api/admin/teacher-requests` | [src/server/routes/teacher-requests.ts](src/server/routes/teacher-requests.ts) |
| `/api/lti/login`, `/api/lti/launch`, `/api/lti/jwks`, `/api/lti/ags/score` | [src/server/routes/lti.ts](src/server/routes/lti.ts) |
| `/api/billing/status`, `/api/billing/checkout`, `/api/billing/webhook/*` | [src/server/routes/billing.ts](src/server/routes/billing.ts) |
| `/api/public/share/:token` | [src/server/routes/public-share.ts](src/server/routes/public-share.ts) |
| `/api/demo/config`, `/api/demo/session`, `/api/demo/reset`, `/api/demo/end` | [server.ts](server.ts) |

More background: [docs/ARCHITECTURE_REFACTOR.md](docs/ARCHITECTURE_REFACTOR.md), [docs/LEARNING_ENGINES.md](docs/LEARNING_ENGINES.md), [docs/PROJECT_COPILOT_RETRIEVAL.md](docs/PROJECT_COPILOT_RETRIEVAL.md), [docs/RESILIENCE_AND_ROLEPLAY.md](docs/RESILIENCE_AND_ROLEPLAY.md).

## Run locally

Prerequisites: Node.js 20+ (CI uses Node 24), Firebase CLI from devDependencies for the emulators.

```bash
cp .env.example .env
npm ci
npm run emulators        # Auth + Firestore + Storage emulators (project academicos-local)
npm run emulators:seed   # optional seed data
npm run dev              # tsx server.ts (API + Vite middleware)
```

There is no authentication bypass: local work uses the emulators with real tokens and claims.

| Script | What it does |
|---|---|
| `npm run dev` | Run the server with Vite in dev mode (`tsx server.ts`) |
| `npm run build` | PWA check, `vite build`, then bundle the server to `dist/server.cjs` |
| `npm run start` | Run the built server |
| `npm run preview` | Vite preview of the client build |
| `npm run clean` | Remove `dist/` |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` |
| `npm run lint:eslint` | ESLint (jsx-a11y, react-hooks) |
| `npm run audit:launch` / `audit:release` / `audit:global-ui` | Static release gates ([scripts/static-release-audit.mjs](scripts/static-release-audit.mjs), [scripts/global-ui-audit.cjs](scripts/global-ui-audit.cjs), [scripts/ts-syntax-audit.cjs](scripts/ts-syntax-audit.cjs)) |
| `npm run verify:pwa` / `verify:production` / `verify:launch-gates` | PWA, production-env and launch-gate checks |
| `npm run emulators`, `emulators:seed`, `emulators:seed:realistic` | Local Firebase emulators and seed data ([scripts/seed-emulator.mjs](scripts/seed-emulator.mjs), [scripts/seed-realistic.mjs](scripts/seed-realistic.mjs)) |
| `npm run emulators:auth:test`, `emulators:workflow:test`, `emulators:student-flow:test`, `emulators:teacher-approval:test`, `emulators:writer-persistence:test` | End-to-end flows against the emulators |
| `npm run bootstrap:root` | Bootstrap the first Root Owner from `ROOT_OWNER_EMAIL` (trusted environment only) |
| `npm run secrets:generate` | Generate local secrets |
| `npm run deploy:cloudrun` | Deploy via [scripts/deploy-cloud-run.sh](scripts/deploy-cloud-run.sh) |
| `npm run ai:configure`, `firebase:iam`, `firebase:repair-runtime` | AI provider and Cloud Run ↔ Firebase IAM helpers |
| `npm test` | Typecheck + every test suite + scale benchmark |
| `npm run test:ci` | All test suites (what CI runs) |

## Tests & quality gates

- Test suites (Node test runner via `tsx --test`) live in [tests](tests): e.g. [tests/core.test.ts](tests/core.test.ts), [tests/security-regressions.test.ts](tests/security-regressions.test.ts), [tests/project-access.test.ts](tests/project-access.test.ts), [tests/process-evidence.test.ts](tests/process-evidence.test.ts), [tests/rubric-drilldown.test.ts](tests/rubric-drilldown.test.ts), [tests/lti.test.ts](tests/lti.test.ts), [tests/teacher-requests.test.ts](tests/teacher-requests.test.ts), [tests/lemonsqueezy.test.ts](tests/lemonsqueezy.test.ts), [tests/demo-isolation-share.test.ts](tests/demo-isolation-share.test.ts), [tests/offline-queue.test.ts](tests/offline-queue.test.ts), [tests/duo-layout.test.ts](tests/duo-layout.test.ts).
- CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push and PR to `main`: `npm ci` → `audit:launch` → `typecheck` → `lint:eslint` (warnings only, non-blocking) → `build` → `test:ci`.
- Local run on 2026-11-12: `audit:launch` pass, `build` pass, `test:ci` 223/223 tests pass, ESLint 0 errors / 110 warnings. CI on GitHub is green for the current `main`.
- Reports: [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md), [docs/QA_AUDIT_REPORT.md](docs/QA_AUDIT_REPORT.md), [docs/QUALITY-SCORECARD.md](docs/QUALITY-SCORECARD.md), [design-qa.md](design-qa.md).

## Deployment

- Deploys are **manual only**: [.github/workflows/deploy-cloud-run.yml](.github/workflows/deploy-cloud-run.yml) is triggered by `workflow_dispatch` (automatic deploys were switched off on 2026-10-28 to cut costs). Merging to `main` does **not** deploy.
- The workflow re-runs the CI gates, authenticates to Google Cloud with Workload Identity Federation (no stored key), runs [scripts/deploy-cloud-run.sh](scripts/deploy-cloud-run.sh) against Cloud Run service `academicos-app` (europe-west2), then checks `https://academicos-edu.web.app/` and `/api/health/firestore`.
- One-time setup of the deploy identity: [docs/deploy-academicos.md](docs/deploy-academicos.md). Go-live checklist: [docs/GO_LIVE_RUNBOOK.md](docs/GO_LIVE_RUNBOOK.md); general guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md); runtime variables: [.env.example](.env.example).
- Firebase Hosting ([firebase.json](firebase.json)): `academicos-edu` rewrites to Cloud Run; `academicos-kw` 302-redirects to `academicos-edu`. A privacy-policy page is served statically from [hosting/privacy-policy.html](hosting/privacy-policy.html).

## Scope and honesty note

The original master prompt covered student, professor, institutional, national, employer, integrations, analytics, billing and operations layers. This repository contains a strong functional core, but not every external/institutional layer is production-complete — see the "Experimental" rows above and [docs/PROMPT_COVERAGE.md](docs/PROMPT_COVERAGE.md), [docs/PROMPT_MATRIX.md](docs/PROMPT_MATRIX.md), [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md).

## Security

See [SECURITY.md](SECURITY.md) and the open items in [SECURITY-TODO.md](SECURITY-TODO.md) (e.g. `'unsafe-eval'` is still allowed in `script-src` for reCAPTCHA/App Check). API keys belong on the server only; protected Firestore/Storage data is reachable only through server authorization. Root Owner is bootstrapped from the environment — there is no hard-coded admin password.

---

آخر تحديث للتوثيق: 2026-11-12
