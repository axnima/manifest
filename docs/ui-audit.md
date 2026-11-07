# Manifest HQ UI audit

Reviewed 7 November 2026 using Impeccable 4.8.0. Review only: no UI changes or new live inference requests.

## Implementation integrity verdict

**Pass with release fixes required.** The landing page and studio share a recognizable blue identity, local fonts, and real product navigation. The ASCII backdrop is intentional, credited, pausable, and respects reduced motion. Uploads feed a real React-generation/compilation workflow rather than a decorative demo. The main gaps are accessibility and the studio's task hierarchy on small screens.

## Health score

These are scoped review scores, not accessibility certification or production readiness ratings.

| Dimension | Score / 4 | Evidence |
| --- | --- | --- |
| Accessibility | 2 | Verified low-contrast labels and an unnamed dialog; keyboard dismissal and focus restoration work. |
| Performance | 3 | Local fonts, a small local animation bundle, no new runtime dependencies, and visibility/reduced-motion handling. Physical-device animation performance remains unmeasured. |
| Theming | 2 | Some tokens exist, but both stylesheets still duplicate numerous literal color and type values. |
| Responsive design | 3 | No horizontal overflow at 320, 390, 768, or 1440 CSS px; mobile task placement and target sizes need improvement. |
| Implementation integrity | 3 | Coherent product-specific implementation; small text and duplicated presentation rules have returned during iteration. |
| **Total** | **13 / 20** | **Acceptable: significant accessibility and usability work remains.** |

Verified issue groups: **0 P0, 2 P1, 4 P2, 0 P3**. The detector produced 48 raw findings; these include duplicates, stylistic warnings, and false positives and are not 48 independent defects.

## Findings

### P1 — Some secondary text fails minimum contrast

- **Location:** `public/landing.css:4` (`.eyebrow`, `.step-number`, intro-strip labels and privacy indices); `public/style.css:35` (`.eyebrow`).
- **Category:** Accessibility.
- **Evidence:** Browser-computed colors give approximately 3.42:1 for landing workflow labels and 3.52:1 for eyebrows on the nominal light background; privacy indices are 3.81:1 on solid `#173d9c`. The studio eyebrow is 4.07:1. These are normal-sized text, requiring 4.5:1. The moving-canvas background was not sampled pixel by pixel, so these are CSS color-pair measurements rather than a certification of every animation frame.
- **Impact:** Supporting information becomes difficult to read for users with reduced vision and in poor viewing conditions.
- **Standard:** [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Recommendation:** Darken small text on light surfaces, lighten the privacy indices, and consolidate accessible secondary-text colors into shared tokens. Recheck hover states too.
- **Suggested command:** `$impeccable colorize`.

### P1 — The Details dialog has no accessible name

- **Location:** `public/studio.html:72–73`, `#privacy-dialog` and its heading.
- **Category:** Accessibility.
- **Evidence:** The native dialog is exposed with a dialog role but has neither `aria-label` nor `aria-labelledby`; its heading has no ID. Escape dismissal and return of focus to Details both passed.
- **Impact:** Assistive technology cannot announce a meaningful dialog title when it opens.
- **Standard:** WCAG 4.1.2; [WAI modal-dialog labeling guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- **Recommendation:** Give the visible heading an ID and reference it with `aria-labelledby` on the dialog. Preserve native modal behavior.
- **Suggested command:** `$impeccable harden`.

### P2 — Small text has crept back into the design

- **Location:** `public/landing.css:4,6,24,29`; `public/style.css:44`.
- **Category:** Accessibility / readability.
- **Evidence:** Mobile landing eyebrows are 9px, step labels and the ASCII attribution link are 10px, and the studio's 0G kicker is 10px. Main chat/input text remains 16px.
- **Impact:** Some content is still harder to read than the main interface, contrary to the requested larger typography.
- **Standard:** Readability issue; WCAG does not prescribe a universal minimum font size.
- **Recommendation:** Use at least 12–14px for meaningful secondary content. Prefer removing redundant labels over squeezing them into microtype.
- **Suggested command:** `$impeccable typeset`.

### P2 — Mobile studio makes users scroll before they can start

- **Location:** `public/studio.html:27–47`; `public/style.css:34` and the stacked page-heading breakpoint.
- **Category:** Responsive design / task hierarchy.
- **Evidence:** On a fresh 390×844 viewport, the upload area begins around y=911px and Generate around y=1424px. At 320px wide, upload begins around y=963px. The brand introduction and privacy card come before the task.
- **Impact:** Users arriving from Try Manifest see another introduction rather than an immediate way to use the product.
- **Recommendation:** Keep the landing page expressive, but compact the studio introduction. Retain a concise privacy explanation and make its full explanation expandable so upload/chat appear sooner.
- **Suggested command:** `$impeccable layout`.

### P2 — Several controls have small touch targets

- **Location:** `public/style.css:71` and `.remove-file`; `public/landing.css:24–25,29`.
- **Category:** Responsive design / accessibility.
- **Evidence:** Details, Use sample, and New chat are about 29px high. After loading a sample, the remove-file button measures roughly 16.8×32px. The mobile ASCII attribution link is about 65.7×15px. Synthesized touch successfully activated Use sample.
- **Impact:** Small controls are harder to activate precisely, especially the narrow file-removal button.
- **Standard:** Aim for 44×44px usability targets. Do not treat every small control as an automatic AA failure: [SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) allows spacing and other exceptions; those exceptions were not exhaustively assessed here.
- **Recommendation:** Add hit-area padding to small actions, especially remove-file and animation controls, without shrinking nearby text.
- **Suggested command:** `$impeccable adapt`.

### P2 — Design values are duplicated across the two surfaces

- **Location:** `public/landing.css:3–4`; `public/style.css:3–8` and repeated literal colors throughout both files.
- **Category:** Theming / implementation integrity.
- **Evidence:** Landing uses `--primary` and `--accent`; studio uses a different accent naming scheme plus many inline hex values. Several almost-identical secondary blues and border colors are maintained independently.
- **Impact:** Future palette changes can miss a surface or reintroduce contrast differences. The small-text regressions show the same type-scale drift.
- **Recommendation:** Extract only the shared palette and typography tokens needed by both surfaces, keeping their layouts separate. Dark mode is not an existing requirement and is not counted as a missing feature.
- **Suggested command:** `$impeccable extract`.

## Detector triage

- **Confirmed:** Contrast issues and undersized secondary text.
- **False positive:** The detector reported cramped workflow/intro padding; computed desktop workflow padding is `100px 32px`, and mobile rules add 20px inline padding.
- **False positive:** Crushed tracking was calculated against a 16px headline. Its actual desktop size is approximately 106.56px, so the reported ratio does not describe the rendered heading.
- **Not a release defect by itself:** Instrument Serif being described as overused, numbered steps, and the requested animated ASCII background. They are existing design choices; no ignores were added.
- **Excluded from contrast defect count:** The HQ brand badge and decorative empty-state glyph. Brand names and purely decorative content have contrast exceptions. Disabled controls were also excluded.
- **Unconfirmed:** A dark-page glow warning does not establish a defect on the actual light studio background.

## What works

- Both surfaces fit the tested desktop, tablet, and mobile widths without horizontal overflow.
- The fixed backdrop ignores pointer hit-testing, so it does not block navigation or form controls.
- Pause/resume, static reduced-motion rendering, and the ASCII attribution link pass browser checks.
- Native file-picker keyboard activation and focus indication work in the existing browser suite.
- Mobile sample upload via synthesized touch works. Native dialog Escape and focus restoration work.
- The controlled-response browser suite passes React compilation, pink chart rendering, hooks, follow-ups, source export, isolation, and compile/runtime/truncation failure handling.
- Privacy details distinguish requested Private routing, metadata retention, temporary PDF files, and the local plaintext backend. The review does not certify 0G's infrastructure.
- No runtime JavaScript errors or paid inference calls occurred during this audit.

## Suggested order

1. `$impeccable harden`: label the dialog.
2. `$impeccable colorize`: correct verified contrast issues while preserving the blue direction.
3. `$impeccable typeset`: remove 9–10px meaningful text.
4. `$impeccable layout` and `$impeccable adapt`: prioritize upload/chat and enlarge small controls.
5. `$impeccable extract`: consolidate the shared tokens.
6. `$impeccable polish`: final visual and interaction pass, then rerun `$impeccable audit`.

These can be run one at a time, together, or in another order.

## Scope and limits

Evidence: headless Chromium with desktop/mobile viewports and synthesized touch, source inspection, Impeccable's detector, and the controlled-response browser suite. Screenshots and detailed measurements are under ignored `.local-artifacts/audit-*` and `.local-artifacts/ui-audit-evidence.json`.

Not checked: physical phones, Safari/Firefox, screen-reader output, actual browser zoom/text-only scaling, GPU/battery performance, live inference, or arbitrary model-generated UI accessibility. The full-viewport canvas and composited filters warrant a lower-powered-device performance check before launch; no measured frame-rate regression is claimed here. The existing generated-code sandbox is not a full browser resource-isolation boundary.
