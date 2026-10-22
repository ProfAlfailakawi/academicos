# Visual polish audit

Scope: visual layer only. No logic, routes, data, i18n keys, tests or deps were changed.
Guards honoured: `scripts/global-ui-audit.cjs` (logical RTL classes only, no literal JSX text, no direct locale formatting) and `scripts/static-release-audit.mjs`.

Method: demo mode (`/api/demo/session`) run locally, screenshots at 390px and 1280px (student and professor roles, Arabic and English) for the home, projects, learn, plans, calendar, notifications, skills, archive, jobs, invitations, upload, support, passport, settings and search routes, with a horizontal-overflow check (0px on all). Other screens were reviewed from source only (not rendered): CourseOS, ProjectWorkspace and its studios, AssignmentSubmissions, ControlPlane, Platform, Integrations, TeacherRequests, UserManagement, Onboarding, MfaSetup, Login, PublicHome, PublicPage, PublicShare, VerifyEvidence, Status, SecurityReport.

## Overall finding
The design system (DNA kit, tone tiles, eyebrow/section-title hierarchy, pill tabs, stat tiles, skills radar, learning map) is already consistent and calm. Remaining pollution was local, not systemic.

## Findings and actions

| Screen / component | Finding | Action |
|---|---|---|
| Passport, Portfolio Builder (`src/pages/Passport.tsx`, project toggle button) | The "Private" state label wrapped mid-word ("Privat / e") in narrow cards; toggle had no pressed state for assistive tech | Status is now a non-wrapping, non-shrinking label with brand colour when selected; added `aria-pressed` |
| Settings, grid (`src/pages/Settings.tsx` line ~192) | Appearance card stretched to the Accessibility card height, leaving a large empty block | `items-start` on the grid |
| Settings, digit-style buttons (`Settings.tsx` ~272) | "Eastern Arabic" label clipped (nowrap) at desktop width | Allow wrapping with tight leading; buttons keep `min-h-11` |
| ProfessorOS home, `LiteCard` (`src/pages/ProfessorOS.tsx` line 104) | 56px/26px icon tile inconsistent with the 44px/19px tile used on every other card | Aligned to 44px/19px |
| Student home, Plans, Calendar, Notifications, Skills, Archive, Jobs, Invitations, Upload, Support, Search | Reviewed at 390 and 1280: hierarchy and spacing fine, no overflow | Left alone |
| ControlPlane, CourseOS, ProjectWorkspace, studios, Notifications (source) | Several explanatory `body-copy` paragraphs per card | Left alone: copy is i18n in 8 locales and some strings are referenced by tests/audits; not rendered here so a change could not be verified |
| Public pages, Login, Onboarding, MFA | Reviewed in source and by earlier `design-qa.md`; no change needed | Left alone |
| Passport empty credentials state | Tall empty card | Left alone (shared `EmptyState`, used widely) |

## Not verified
Authenticated flows with real Firebase, payment screens with live data, and non-demo roles other than student/professor were not rendered.

---

## Round 2 (motion system + elevation)

Scope: presentation only. New layer `src/motion.css`, imported last in `src/main.tsx`. Two small markup changes: `ControlPlane` `Metric` tile and a `data-motion="off"` attribute on the grading desk root.

### Coverage
Rendered in demo mode at 390 and 1280 (Arabic), 0px horizontal overflow on all: student (home, projects, project workspace, upload, learn, notifications, onboarding, plans, settings, passport, skills, jobs, calendar), professor (home, professor space, CourseOS, AssignmentSubmissions, project workspace, notifications, projects), university_admin (home, ControlPlane, Platform, Integrations, Users, curriculum twin), support_agent (support console), public (home, login, status, security report, verify evidence, /p/about). Viewed closely: ControlPlane (before/after), CourseOS, ProjectWorkspace (student, 390), Notifications (after). Others were captured and overflow-checked but not individually inspected.
Not reachable in demo: TeacherRequests (redirects to /app for the demo roles), MfaSetup (redirects to /login), PublicShare, real Firebase login/MFA states, payment/checkout. The English professor run was not repeated this round.

### Changes by screen
| Screen | Change | Left alone and why |
|---|---|---|
| ControlPlane | Seven counters became icon-tile + display-numeral + short label (one-row layout on phones). Values and labels are the same props. | Funnel/gauge/flags/audit panels: already infographic; copy is i18n and not edited. |
| Notifications | Rings now draw once to their real value (CSS only, stroke-dashoffset). | Card text and actions untouched. |
| CourseOS, ProjectWorkspace, Platform, Integrations, Users, Login, public pages | Only the shared motion layer applies (stagger, hover, press, focus, disclosure, dialog). CourseOS and ProjectWorkspace viewed: already calm with good hierarchy, so no markup was added. | Wordy paragraphs kept: i18n strings and tests reference them. |
| AssignmentSubmissions (grading) | `data-motion="off"`: no animation or press-scale in the whole subtree. | Rubric score entry and submission untouched. |

### Motion inventory (tokens: `--m-ease: cubic-bezier(.2,.7,.2,1)`, 120/180/260ms, step 40ms)
- Stagger fade+rise 8px, once on mount, max 8 items (260ms): cards/panels inside `.grid` and `.space-y-*` in `.app-main`; skipped when the card contains a textarea, form or contenteditable.
- Notification rings (620ms) and `.tone-meter` / job-progress fills (520ms, scaleX): once, to the real value; end state equals the static look.
- Tab panels and opened `<details>` content: 180ms fade + 6px. Closing is not animated (no JS added).
- Dialogs (`role=dialog aria-modal`): 260ms fade + rise; status/alert messages 180ms fade.
- Micro-interactions: hover lift (-1px + soft shadow) on link cards and quick rows, press scale .98 on buttons, directional-icon nudge, eased focus ring and nav colour fade.
- All inside `prefers-reduced-motion: no-preference` and `html:not(.a11y-reduced-motion)`. No infinite loops added. Content is fully visible without JS.
- Verified with Playwright on /app/control: after settle, 0 running finite animations, 0 elements below opacity 1, 0 infinite animations; with reducedMotion emulation, 0 `m-*` animations start.

### Checks run
`node scripts/global-ui-audit.cjs` 26/26; `node scripts/static-release-audit.mjs` 33/33; `npm run lint` (tsc) pass; `npm test` full chain pass; `npm run build` pass.

### Not verified
Modal/toast exit animations (entry only); the active-nav indicator is a colour fade, not a sliding element; dark-mode look of new tiles (token use only); other locales not re-rendered; real-data states beyond the demo seed; animation end-state check was run on one route.
