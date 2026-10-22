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
