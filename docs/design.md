# Manifest HQ interface

Primary reference: [Taste Library — Ramp](https://github.com/MartinPuli/taste-library/blob/main/profiles/ramp.md), particularly its “Patterns to adapt” and saved-capture observations: light surfaces, restrained panels, and yellow primary actions suit a finance-document workspace. Linear was considered but its dark presentation was less suitable for reading long documents. These are homepage references, not claims about either product’s internal app.

[Actions evidence](https://github.com/MartinPuli/taste-library/blob/main/data/sections/ramp/actions.json), `/data/button_list/0/visuals/default`, records a solar primary action and dark text; [review](https://github.com/MartinPuli/taste-library/blob/main/data/reviews/ramp.json), `/visual_observation`, describes a light presentation with yellow actions. The extraction is unverified and the review does not establish responsive behavior.

## Current direction

The earlier Ramp reference informed the light surfaces and clear primary action. The current design uses an original porcelain (`#faf7f5`), deep plum (`#292330`), and dusty rose palette, rather than Ramp's yellow. These are our choices, not measured reference tokens.

Instrument Serif provides the wordmark and display headings; Manrope provides readable interface text. Both are self-hosted under `public/fonts/` with their SIL Open Font License files. No external font service is contacted. The circular logo uses the matching rose accent.

The wordmark reveals on load with an underline and a delayed HQ badge. A small decorative orbit moves slowly on the privacy card. All animation is restricted to `prefers-reduced-motion: no-preference`; reduced-motion users see the final static state.

Privacy copy is based on [0G's privacy explanation](https://0g.ai/blog/data-privacy-on-0g-private-computer): requested Private routing uses enclave inference, while the Router retains billing/usage metadata rather than prompts or responses. The expandable disclosure explains the local plaintext backend, temporary PDF files, metadata logs, and absence of independent attestation verification. It deliberately does not claim that nothing is stored anywhere.

The native file input remains transparent over one dropzone, preserving file selection, keyboard access, focus indication, and drag/drop without a second visible picker button.
