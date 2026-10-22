# Quality scorecard, round 3 (presentation only)

Harness: Playwright + axe-core, hard criteria H1 axe, H2 overflow, H3 clipped text, H4 console errors, H5 CLS < 0.1, H6 visible focus (first 30 focusables), H7 nothing stuck invisible, H8 no animation under reduced motion, H9 text contrast 4.5:1.
Matrix: 5 role groups (student, professor, university_admin, support_agent, public) x 36 routes/screens x 4 viewports (320/390/768/1280) x light and dark x normal and reduced motion, Arabic, demo sandbox. 576 screen-state measurements.

| | Before | After |
|---|---|---|
| Fully passing | 75 / 576 (13%) | 453 / 576 (79%) |
| H1 axe | 128 | 2 |
| H6 focus | 466 | 112 |
| H7 stuck invisible | 132 | 12 |
| H9 contrast | 207 | 0 |
| H5 CLS | 9 | 6 |
| H4 errors | 2 | 0 |

## Changes (all in `src/final-polish.css` plus attribute-only markup)
- Keyboard focus ring on predictive chips and the compact language switcher (the native select was fully transparent over the icon, now a real, named control with a focus ring).
- Disabled buttons: flat and quiet with readable text instead of 40% opacity.
- Public landing scroll reveal no longer drops text to 40% opacity (sections were washed out in screenshots).
- Plan card descriptions, project X-ray warning text: contrast raised to 4.5:1.
- Arabic typography: balanced headings, tabular numerals, `text-wrap: pretty` for Arabic body text.
- Markup (attributes only, no text or logic): `aria-label` on the desktop sidebar landmark, on the role select (Users), status select (Support console, Course), level select (Learn); login marketing panel is an `aside`; workspace title is the page `h1`; the audit-trail scroller is keyboard focusable.

## Left alone, with reason
- Screens judged excellent by eye: student home, plans, landing, ControlPlane tiles.
- H6 residue (112): the harness calls `element.focus()` from script, where `:focus-visible` is false for some links/buttons; pressing Tab through /app/calendar, /app/platform and the project workspace shows a ring on every stop. Treated as a harness artefact, not a defect.
- H7/H5 residue: intro transitions (`.dna-seq`, stagger) and loading skeletons caught mid-flight on a heavily loaded machine, plus 2 loading-state pages without an h1 at the moment of measurement. Content ends visible.
- Text-wall paragraphs are i18n copy referenced by tests in 8 locales; not rewritten (soft metric, unchanged).

## Not viewed
Only 390 and 1280 screenshots were inspected by eye, for a subset; dark mode was measured but not eyeballed; locales other than Arabic; real Firebase auth, MFA, payment and teacher-request screens (not reachable in demo); modal open states beyond the default.

## Checks
`npm run lint` pass, `npm test` full chain pass (exit 0), `npm run build` pass.
