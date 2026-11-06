# Document analysis flow

1. `public/model.js` identifies PDF/image signatures, decodes UTF-8 text, or calls `/api/extract` for supported Office formats. There is no revenue-only upload filter.
2. `scripts/server.py` serves `public/` on loopback and extracts DOCX, XLSX, PPTX, and ODT in memory. It bounds compressed input, total uncompressed ZIP size, entry count, and extracted text size. It rejects XML DTD/entity declarations and cross-origin extraction requests. It does not write uploaded documents to disk, execute macros, or recalculate formulas.
3. The browser holds up to five attachments. Changing the attachment set resets the conversation. Text previews are truncated only for display; the accepted full text is retained for inference.
4. Sending chat calls Gemini 3.1 Flash-Lite directly with attachments, recent conversation, the previous React module (or failed module plus its error), and the latest instruction. The API key stays in the parent page and is sent only to Google.
5. Gemini returns `{title, reply, source}`. `source` is a complete JavaScript JSX module with a default component export. The response is bounded to 200 KB of source. There is no predefined dashboard component menu.
6. The browser sends only the source to `POST /api/compile`. Python starts `scripts/compile.cjs` as a bounded-time Node process. esbuild parses/bundles React and JSX without executing the module. A resolver plugin permits only React imports from generated source and denies file paths, URLs, node builtins, and arbitrary npm dependencies. No generated dependencies are installed and no generated source is stored on disk. The server returns a self-contained JavaScript bundle.
7. The parent navigates an iframe to the fixed `preview.html`, with `sandbox="allow-scripts"` and no same-origin permission. A fixed bootstrap (`preview.js`) accepts one bundle from its parent and loads it through a temporary blob URL. The preview CSP blocks network connections, external assets, forms, objects, and base URL changes; inline styles and the bundled script are permitted. Parent keys and raw attachments are never posted into the iframe. Any data embedded by Gemini is naturally present in the generated module.
8. React mounts the default export inside an error boundary. Preview ready/runtime-error messages are accepted only from the current frame. Compile failure leaves the previous working frame intact. Follow-up generation receives failed source and the visible error so it can attempt a correction. React source is available in the source tab and as a JSX download. Exports contain the source and its embedded data, not the API key or raw attachment bytes.
9. Gemini finish reasons, token counts, and provider IDs remain in sanitized diagnostics. Compiler success/failure and runtime failure are separate entries correlated by the local request ID. Compiler error details are visible in chat; code and runtime error content are not written to the diagnostic log.

## Calculations

The sample monthly revenue parser and least-squares forecast remain as an optional local helper. They run only for forecast/prediction requests on a compatible CSV. For the three supplied observations, the estimate is $543,333.33 for October. The model is instructed to prefer these verified calculations when provided, but displayed values still require review. General document calculations and forecasts are model-generated, not a validated computation engine.

## Boundaries

This local prototype is not a shared authenticated service. It has no persistent document storage, tenant isolation, or production credential management. Browser sandboxing is not a full resource isolation system: generated infinite loops or extreme allocations can still degrade the browser. Server compilation is limited by input size and a subprocess timeout, not a production container sandbox. Google receives the documents and applies its data policy. Browser keys remain in memory. Move inference to an authenticated backend before shared deployment. Do not expose the local server publicly.

Gemini reference: https://ai.google.dev/gemini-api/docs/generate-content/document-processing
