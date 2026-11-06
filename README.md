# Manifest Finance

Manifest Finance turns uploaded documents into custom React dashboards. Upload files, tell the assistant what to do, and receive a generated answer with suitable summaries, metrics, tables, or charts. Follow-up chat revises the answer. There is no required revenue schema or mandatory forecast.

## Run locally

Requirements: Node.js 20+ with npm, Python 3, and a mainnet 0G API key for live analysis. Install the React and compiler dependencies once. PDF text extraction also requires `pdftotext` (Poppler; `poppler-utils` on Debian/Ubuntu or `poppler` on Arch). There is no frontend build step: each generated component is compiled on demand by the local backend.

```sh
npm install
cp .env.example .env
# Edit .env and supply your mainnet 0G API key.
npm start
```

Open **http://localhost:5173**. Stop with Ctrl+C. After upgrading from the old static server, stop it and run `npm start` again: Office extraction and React compilation need the new local server. Hard-refresh any existing browser tab.

Alternatively:

```sh
python3 scripts/server.py --port 5173
```

Use a different port if needed. Edit `public/` and refresh to see changes.

## Use

1. Configure `.env` at the repository root, then restart `npm start`:

   ```dotenv
   ZERO_G_API_KEY=your_mainnet_api_key
   ZERO_G_BASE_URL=https://router-api.0g.ai/v1
   ZERO_G_MODEL=0gm-1.0-35b-a3b
   ```

   Process environment variables override `.env`. Values are literal, optionally quoted; shell expansion is not supported. Keep `.env` private; Git ignores it.
2. Choose or drag files into **Upload files**. Up to 5 files, 4 MB per file, 8 MB total.
3. Ask what you need: “Summarize this memo,” “Compare expenses with the budget,” “Extract the action items into a table,” or “Forecast next month and explain your assumptions.”
4. Inspect the answer, source/method notes, and the React source tab. Ask follow-ups to refine it.

Files and conversations stay in session memory. The browser calls the same-origin `/api/generate` endpoint. The backend holds the key and sends document text/images, conversation, and previous source to 0G with `X-0G-Provider-Trust-Mode: private`. It never silently falls back to another provider or lower trust tier. The backend handles plaintext; this is not end-to-end encryption of the whole app. Use fictional data during testing.

Generation is limited to one in-flight request and 6,000 output tokens, with a 180-second provider timeout and no automatic retries. A timeout or closing the tab does not guarantee cancellation of provider billing. Receipts show provider/local request IDs, requested private routing, token usage, and an estimated cost for 0GM based on current promotional rates ($0.08/M input, $0.48/M output). This is an estimate, not a billing balance or verified attestation; prices can change. Check actual credits in your 0G dashboard.

## Supported files

| Files | Handling |
| --- | --- |
| PDF | Extracted locally using `pdftotext`, up to 100 pages; larger PDFs are rejected. Temporary files are removed after extraction. Scanned PDFs need conversion to text or images. |
| PNG, JPEG, WebP | Sent through the backend as native image input; requires a vision-capable model such as the configured 0GM model. |
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

Tests use controlled provider responses; a live 0G run uses your configured key and compute credits. Browser tests launch and stop an isolated local server.

## Limits

0G returns real React JSX in a JSON envelope (`title`, `reply`, `source`). The local backend uses esbuild to compile and bundle React; it does not execute the generated module. The browser runs the bundle in an iframe with only `allow-scripts`, an opaque origin, and a restrictive CSP. The generated preview has no access to the parent DOM/API key and ordinary network requests are blocked. Only React imports are allowed; write charts with SVG and styles with inline CSS. Arbitrary packages and external assets are not available. Export downloads `GeneratedApp.jsx`. Compilation errors retain the previous working preview; runtime errors appear in chat. Failed source/error context is sent on follow-ups so 0G can repair it. Source references, extracted numbers, and model calculations are not independently verified. Forecasts must label assumptions and estimated points. A local linear-trend helper is supplied only when a forecast is requested on the original `month,revenue_usd` sample schema; all other calculations are model-generated. This is a prototype, not an audited financial system.

Generated code is still untrusted: sandboxing does not prevent every browser resource-exhaustion issue, such as an infinite loop. Keep this as a local prototype; shared production execution needs stronger isolation and resource controls.

## 0G diagnostics

Restart `npm start` after updating. The backend logs technical metadata for every inference attempt to `.local-artifacts/inference.jsonl`. Logs rotate at 1 MB with two backups. They are ignored by Git and not served as public files.

```sh
tail -n 10 .local-artifacts/inference.jsonl
```

The app's **Request diagnostics** panel shows the latest entry and whether it was saved. Entries include a local request ID, UTC timestamp, model, duration, HTTP status, provider response ID, finish/block reason, processing stage, output length, and token counts when available. Prompts, file names/content, API keys, and generated response text are excluded. If saving fails, the app still displays the diagnostics and original provider result/error. Requests made before this feature was installed cannot be recovered.
