# AcademicOS launch design QA

- source visual truth: `public/assets/academicos-project-journey.png`
- rendered desktop implementation: `.codex-qa/home-desktop-1200.jpg`
- rendered mobile implementation: `.codex-qa/home-mobile-after-top.png`
- rendered login state: `.codex-qa/login-desktop.jpg`
- focused source/implementation comparison: `.codex-qa/hero-comparison.png`
- viewport and density: desktop `1200 × 900` CSS px at device scale 1; mobile `390 × 844` CSS target at device scale 1, with the top `390 × 900` full-page region retained for readable evidence
- pixel dimensions: source `1536 × 1024`; desktop `1200 × 900`; mobile full capture `390 × 3698`; mobile evidence crop `390 × 900`; focused comparison `1840 × 620`
- normalization: the 3:2 source asset and its 3:2 rendered slot were both fit into equal `900 × 600` comparison frames without cropping
- state: Arabic RTL, light theme, unauthenticated student launch; login shown in the intentional “Firebase not configured” production-safe state

## Full-view comparison evidence

The desktop capture preserves the intended visual system: warm off-white canvas, deep green hierarchy, bold Arabic headline, restrained borders/shadows, and a clear 1:1 hero split. The illustration is sharp, uncropped, and visually dominant without overwhelming the primary CTA. The mobile implementation collapses to a single reading column, hides secondary navigation, keeps the CTA pair visible, and moves the real illustration below the proof cards. DOM measurements reported `scrollWidth === innerWidth` at both desktop and mobile widths, with no overflowing element.

## Focused-region comparison evidence

The hero source and rendered implementation were compared in `.codex-qa/hero-comparison.png`. Subject, palette, transparency/background treatment, aspect ratio, and the green/cream art direction remain intact. The app uses the generated bitmap directly; no placeholder, CSS drawing, emoji, or reconstructed SVG replaces it.

## Required fidelity surfaces

- Fonts and typography: bold display hierarchy is consistent across desktop/mobile; Arabic wrapping stays intentional; body copy retains readable line height; small labels remain visually secondary.
- Spacing and layout rhythm: desktop hero columns are balanced; cards align to the existing grid; mobile gaps, radii, and section cadence are consistent; no horizontal overflow was detected.
- Colors and visual tokens: brand green, cream background, subtle mint/sand/blue cards, semantic warning color, and hairline borders consistently use the existing token system.
- Image quality and asset fidelity: source asset is loaded at an appropriate 3:2 slot, remains sharp, and uses `object-fit` without distortion.
- Copy and content: the value proposition is student-first and concrete; price, no-subscription model, variation promise, source safety, and optional Teacher Lite are visible without exposing deferred university positioning.

## Findings

- No actionable P0, P1, or P2 visual mismatch remains.
- P3: authenticated Plans, Writer, and Teacher Lite screens could not be browser-captured because production Firebase credentials are intentionally absent. Their components were typechecked, production-built, and their backend flow has a Firebase emulator test script ready, but the local machine has no Java runtime for Firestore Emulator execution.

## Comparison history

1. First mobile pass found a P2 accessibility issue: the header identity and footer legal links had hit areas below the intended touch height.
2. Fix applied in `src/pages/PublicHome.tsx`: header identity now has a minimum 44px height; legal links are inline-flex controls with a minimum 44px height.
3. Post-fix evidence: `.codex-qa/home-mobile-after-top.png`; programmatic touch-target recheck found no interactive control below 40px in height, no horizontal overflow, and no console warnings/errors.

## Primary interactions tested

- Public home rendered at desktop and mobile breakpoints.
- Student CTA, journey, pricing, and Teacher Lite navigation targets were present and semantically exposed.
- `/p/universities` redirected to `/`, confirming deferred university pages are hidden.
- Login rendered the explicit safe configuration state without a demo-auth bypass.
- Browser console was checked after the final build: no errors or warnings.

## Follow-up polish

- No visual change is required before credentialed staging. Repeat authenticated screenshots after the owner adds Firebase/payment credentials.

final result: passed
