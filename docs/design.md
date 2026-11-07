# Manifest HQ interface

Primary reference: [Taste Library — Ramp](https://github.com/MartinPuli/taste-library/blob/main/profiles/ramp.md), particularly its “Patterns to adapt” and saved-capture observations: light surfaces, restrained panels, and yellow primary actions suit a finance-document workspace. Linear was considered but its dark presentation was less suitable for reading long documents. These are homepage references, not claims about either product’s internal app.

[Actions evidence](https://github.com/MartinPuli/taste-library/blob/main/data/sections/ramp/actions.json), `/data/button_list/0/visuals/default`, records a solar primary action and dark text; [review](https://github.com/MartinPuli/taste-library/blob/main/data/reviews/ramp.json), `/visual_observation`, describes a light presentation with yellow actions. The extraction is unverified and the review does not establish responsive behavior.

## Current direction

The earlier Ramp reference informed the light surfaces and clear primary action. The current design uses a brighter warm-white (`#fbfcff`), cobalt (`#2457e5`), and aqua palette. Earlier iterations used plum and dusty rose. These are our choices, not measured reference tokens.

Instrument Serif provides the wordmark and display headings; Manrope provides readable interface text. Both are self-hosted under `public/fonts/` with their SIL Open Font License files. No external font service is contacted. The circular logo uses cobalt with an aqua mark.

The wordmark reveals on load with an underline and a delayed HQ badge. A small decorative orbit moves slowly on the privacy card. All animation is restricted to `prefers-reduced-motion: no-preference`; reduced-motion users see the final static state.

Privacy copy is based on [0G's privacy explanation](https://0g.ai/blog/data-privacy-on-0g-private-computer): requested Private routing uses enclave inference, while the Router retains billing/usage metadata rather than prompts or responses. The expandable disclosure explains the plaintext server, temporary PDF files, metadata logs, and absence of independent attestation verification. It deliberately does not claim that nothing is stored anywhere.

The native file input remains transparent over one dropzone, preserving file selection, keyboard access, focus indication, and drag/drop without a second visible picker button.

## Landing page and navigation

The root `public/index.html` introduces Manifest HQ with a bright blue atmospheric background, matching local fonts, an interactive ASCII ocean, a three-step workflow, and privacy details. It does not make inference calls. The single **Open studio** hero button leads to `studio.html`, which retains the complete existing upload/chat/React workspace. The studio wordmark returns home. Landing styles are isolated in `public/landing.css`. Motion respects reduced-motion settings.

## ASCII Sharks

The actual MIT-licensed OceanEngine from [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks) renders two sharks and a fish school as a fixed landing-page backdrop. Upstream source and license are vendored unchanged, with its exact commit recorded in `vendor/ascii-sharks/UPSTREAM.md`. `scripts/landing-ocean.ts` adds a visible pause control and suspends the engine when the tab is hidden. Upstream handles off-screen pausing and static reduced-motion rendering. Resuming after a manual pause starts a fresh scene.

The original dark rendering receives a light CSS color treatment and an even translucent overlay across the viewport; the original rendering and physics are retained. The canvas is decorative and hidden from assistive technology; its caption and controls remain accessible. The existing esbuild dependency creates the checked-in `public/ascii-ocean.js`, including the MIT license. No runtime dependencies or external script hosts were added.

The ASCII canvas now sits behind the full landing page rather than in an illustration card. It ignores pointer hit-testing, keeping links usable; its pause control and attribution remain in a small fixed control group. Translucent reading surfaces preserve text contrast; the backdrop has no left-side white gradient. Header and footer content have responsive internal padding. The studio uses cobalt, pale blue, and navy consistently, including its wordmark accents.

## Product copy

Help text describes uploading, asking, and refining without developer setup instructions. The help dialog groups file limits, privacy/storage, implementation details, and diagnostics in expandable sections. Status and recovery messages work for hosted and local use; setup stays in README.md. Private routing is described as requested, provider retention claims are attributed to 0G, and server plaintext processing and metadata logging remain disclosed.

Optional Gemini fallback is disclosed before generation and in the privacy details. Results identify the actual provider/model and label Gemini as outside 0G private inference. The chat explains the original 0G HTTP failure when fallback produces a result.
