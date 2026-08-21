# AcademicOS

**The Operating System for Human Learning in the AI Age**  
**From Assignment to Evidence.**

AcademicOS turns an assignment, rubric, brief, dataset or project file into a structured academic workspace. The production path is server-centric: Firebase Authentication → Express API → Firestore / Cloud Storage → AI Gateway. Every application route requires the production authentication and persistence path.

## What this build actually implements

- Firebase Authentication with ID-token verification and role/tenant custom claims.
- Tenant- and owner-scoped server authorization.
- Student onboarding persisted to Firestore.
- Universal Assignment Intake: text plus up to 10 files in one assignment.
- DOCX, PPTX, XLSX, ZIP and text extraction; PDF/image/audio/video multimodal hand-off.
- Prompt-injection-aware Assignment Compiler with versioned system prompt and structured output.
- Project DNA plus real persisted Adaptive Workspaces: only the relevant Research/Writing/Data/Spreadsheet/Code/Engineering/Lab/Design/Media/Presentation/Portfolio/Survey/Simulation studios appear for each project, with saved work items mapped to deliverables and Rubric criteria.
- Next Best Action / Semester dashboard / calendar / in-app smart notifications.
- Evidence Studio, Rubric Readiness, Submission Audit and Project Twin with stored workspace-artifact → deliverable/Rubric relationships.
- Transactional project revision history plus per-Workspace-item revisions/restore, comments, activity timeline and guarded destructive actions.
- Same-tenant group invitations, accepted-member project access and Team Studio contribution evidence.
- ProfessorOS / CourseOS core with Assignment Builder, cloning, outcome mapping and quality checks.
- Permission-aware global catalog search, Support workflow, tenant Feature Flags and Integration Configuration Center.
- SHA-256 provenance for uploaded assignment files.
- Viva Simulator with persisted responses and Proof of Learning.
- Skill Genome evidence rules and private Academic Passport.
- Secure original-file storage plus time-limited signed URLs.
- Real JSON, Markdown and ZIP project exports, including persisted Adaptive Workspace artifacts and their project relationships.
- Download My Data JSON export for the signed-in user.
- Institution Control Plane with tenant-scoped project, audit, AI-cost and incident data.
- Tenant-scoped user administration: directory/search, bounded role assignment, suspend/unsuspend, reason-required audit logging, Root protection and active-session revocation after access changes.
- Health-driven incident/maintenance banner; maintenance mode blocks write routes while preserving read access.
- AI provider abstraction; Gemini adapter is the configured adapter in this build.
- Billing abstraction with disabled-by-default state and optional Stripe Checkout adapter.
- Root Owner bootstrap via environment/setup command; no hardcoded admin password.
- Server security headers, configurable CORS, request/file limits, rate limiting, revoked-token verification and maintenance write-lock.
- Firestore and Storage direct-client deny rules for sensitive application data.
- Premium responsive design: Arabic-first RTL, LTR direction support, dark mode, reduced motion, desktop sidebar, mobile navigation and command palette.
- Public product/security/integrity/pricing/legal-readiness pages and PWA shell.

## Important truth about scope

The master prompt contains hundreds of requirements across student, professor, institutional, national, employer, integrations, analytics, billing, operations and long-term platform infrastructure. This repository now contains a substantially stronger **functional core**, but it would be inaccurate to claim that every external/institutional layer is production-complete. See [`docs/PROMPT_COVERAGE.md`](docs/PROMPT_COVERAGE.md), [`docs/PROMPT_MATRIX.md`](docs/PROMPT_MATRIX.md), [`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md), and [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md).

## Local development

Prerequisites: Node.js 20+ and an npm registry that can resolve the dependencies in `package.json`.

```bash
cp .env.example .env
npm install
npm run dev
```

There is no authentication bypass. Local verification uses the Firebase Auth/Firestore emulators with real tokens, claims and persisted records.

## Production configuration

1. Create a Firebase / Google Cloud project.
2. Enable Firebase Authentication, Firestore and Cloud Storage.
3. Deploy `firestore.rules`, `storage.rules` and `firestore.indexes.json`.
4. Configure all required variables from `.env.example` in your deployment secret/config system.
5. Configure `GEMINI_API_KEY`, `GEMINI_MODEL` and Firebase Admin credentials/ADC for production assignment compilation.
6. Build and deploy the app.
7. Bootstrap the first Root Owner with `ROOT_OWNER_EMAIL` and `npm run bootstrap:root` from a trusted administrative environment.
8. Run end-to-end tests against staging before opening production traffic.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for detail.

## Commands

```bash
npm run dev
npm run typecheck
npm run build
npm run start
npm run bootstrap:root
```

## Security

See [`SECURITY.md`](SECURITY.md). API keys belong on the server only. Production Firestore/Storage access is denied directly from the client for protected collections/objects and goes through server authorization.

## Testing note for this delivered archive

Core dependency-free logic was executed in the build workspace: Office/ZIP extraction, Project DNA generation, adaptive modules, Submission Audit behavior, Viva/Proof of Learning creation and ZIP export validation including saved workspace-artifact payloads. A full Vite build/browser E2E could not be executed in the delivery environment because its internal npm mirror returned HTTP 404 for required packages and direct public-registry DNS was blocked; no build PASS is claimed for that unavailable step. Run `npm install && npm run typecheck && npm run build` in staging with normal package-registry access, commit the verified generated `package-lock.json`, then use `npm ci` in CI/CD.
