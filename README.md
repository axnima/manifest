# Manifest Finance

Manifest Finance turns uploaded documents into custom React dashboards. Upload files, tell the assistant what to do, and receive a generated answer with suitable summaries, metrics, tables, or charts. Follow-up chat revises the answer. There is no required revenue schema or mandatory forecast.

## Run locally

Requirements: Node.js 20+ with npm, Python 3, and a Gemini API key for live analysis. Install the React and compiler dependencies once. There is no frontend build step: each generated component is compiled on demand by the local backend.

```sh
npm install
npm start
```

Open **http://localhost:5173**. Stop with Ctrl+C. After upgrading from the old static server, stop it and run `npm start` again: Office extraction and React compilation need the new local server. Hard-refresh any existing browser tab.

Alternatively:

```sh
python3 scripts/server.py --port 5173
```

Use a different port if needed. Edit `public/` and refresh to see changes.

## Use

1. Enter your Gemini API key in **Connect Gemini**. Free Tier quotas apply; a billing-enabled key can incur charges.
2. Choose or drag files into **Upload files**. Up to 5 files, 4 MB per file, 8 MB total.
3. Ask what you need: “Summarize this memo,” “Compare expenses with the budget,” “Extract the action items into a table,” or “Forecast next month and explain your assumptions.”
4. Inspect the answer, source/method notes, and the React source tab. Ask follow-ups to refine it.

Files stay in session memory. Text/Office parsing occurs locally; file content and conversation context go directly to Google when you send a message. Your API key is not saved in the repository or sent to the local extraction server. Refreshing clears the key, documents, and chat. Use fictional data for tests; this is not private 0G inference.

## Supported files

| Files | Handling |
| --- | --- |
| PDF | Sent as PDF bytes for Gemini document understanding, including scans; no local PDF text extraction. |
| PNG, JPEG, WebP | Sent as image bytes for Gemini visual understanding. |
| CSV, TSV, JSON, TXT, Markdown, HTML, XML, source code and other UTF-8 text | Decoded locally and sent as text, without a prescribed column schema. HTML and code are never executed. |
| DOCX, XLSX, PPTX, ODT | Text/cached cell values extracted by the local Python server in memory. |

Readable text is limited to 1 MB per file. Office extraction loses formatting and embedded images. Excel formulas are not recalculated; missing cached results are labeled, and sheets use their internal filenames. Encrypted documents, old DOC/XLS/PPT, archives, audio/video, and unsupported binaries require conversion to a supported format. The picker allows any file selection and displays a useful error when it cannot read a format. Failed uploads preserve existing files/results. Adding or removing files resets chat to prevent stale context.

## Repository

```text
public/                 Editable frontend and sample CSV
scripts/server.py       Local web server, extraction, and compilation APIs
scripts/compile.cjs     esbuild compiler with restricted imports
tests/                  Model, extraction, and browser tests
samples/finance/        Fictional PDF reports, spreadsheets, and HTML sources
docs/architecture.md    Processing flow and limitations
```

The root Git history is preserved. Old hosting files are ignored under `.local-artifacts/`; they are not used locally. Local changes are not automatically published to Sites.

## Tests

```sh
npm test
```

Optional browser integration checks with an existing Playwright installation and Chromium:

```sh
node tests/browser.test.cjs /absolute/path/to/playwright /absolute/path/to/chrome
```

Tests use controlled provider responses; a live Gemini run requires your own key. Browser tests launch and stop an isolated local server.

## Limits

Gemini returns real React JSX in a JSON envelope (`title`, `reply`, `source`). The local backend uses esbuild to compile and bundle React; it does not execute the generated module. The browser runs the bundle in an iframe with only `allow-scripts`, an opaque origin, and a restrictive CSP. The generated preview has no access to the parent DOM/API key and ordinary network requests are blocked. Only React imports are allowed; write charts with SVG and styles with inline CSS. Arbitrary packages and external assets are not available. Export downloads `GeneratedApp.jsx`. Compilation errors retain the previous working preview; runtime errors appear in chat. Failed source/error context is sent on follow-ups so Gemini can repair it. Source references, extracted numbers, and model calculations are not independently verified. Forecasts must label assumptions and estimated points. A local linear-trend helper is supplied only when a forecast is requested on the original `month,revenue_usd` sample schema; all other calculations are model-generated. This is a prototype, not an audited financial system.

Generated code is still untrusted: sandboxing does not prevent every browser resource-exhaustion issue, such as an infinite loop. Keep this as a local prototype; shared production execution needs stronger isolation and resource controls.

## Gemini diagnostics

Restart `npm start` after updating. Every completed Gemini attempt sends technical metadata to the local server, which writes `.local-artifacts/gemini.jsonl`. Logs rotate at 1 MB with two backups. They are ignored by Git and not served as public files.

```sh
tail -n 10 .local-artifacts/gemini.jsonl
```

The app's **Request diagnostics** panel shows the latest entry and whether it was saved. Entries include a local request ID, UTC timestamp, model, duration, HTTP status, provider response ID, finish/block reason, processing stage, output length, and token counts when available. Prompts, file names/content, API keys, and generated response text are excluded. If saving fails, the app still displays the diagnostics and original provider result/error. Requests made before this feature was installed cannot be recovered.
