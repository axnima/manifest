# Sealed — generative revenue studio

Upload a real CSV, ask for a forecast in chat, and render a dashboard layout returned by Gemini. Follow-up messages can change a line chart to bars, reorder metrics, or add a table. The former preset/mock dashboard generator has been removed.

## Try it

1. Download `dist/sample-quarterly-revenue.csv` (fictional July–September 2026 revenue).
2. Open the published Site, or serve locally:

```sh
python3 -m http.server 5173 --directory dist --bind 127.0.0.1
```

3. Open http://localhost:5173, upload the CSV, or click **Use sample**.
4. Get a Gemini API key at https://aistudio.google.com/apikey using a **Free Tier project**. Do not enable billing just to test. Account/region/model quotas can vary; a key on a billing-enabled project can incur charges. This app cannot verify billing tier.
5. Enter the key in **Connect Gemini**. It remains in page memory; it is not stored, exported, logged, embedded in source, or sent to Sites. It is sent directly to Google in the `x-goog-api-key` header. Clear it when done.
6. Ask: “Forecast revenue for next month. Show the trend and the predicted amount.”
7. Follow up: “Use a bar chart and put the forecast metric first,” or “Add a monthly data table.” Inspect Component JSON to see the actual returned layout, verified data, model name, and provider response ID when supplied.

Use synthetic data. Google’s free-tier policy allows content use for product improvement. This is not confidential inference and does not use 0G. No private company documents should be used for this test.

## CSV contract

```csv
month,revenue_usd
2026-07,350000
2026-08,410000
2026-09,480000
```

Exactly these two columns; 3–36 consecutive months; unique YYYY-MM dates between 2000 and 2099; non-negative USD values up to 1 billion, with at most two decimals. No currency symbols or thousands separators. Unsorted rows, UTF-8 BOM, CRLF, and simple quoted cells are accepted. Maximum 100 KB. PDF/DOCX extraction and arbitrary CSV schemas are not implemented.

## How it works

- `dist/model.js`: parses and validates CSV, computes a one-month linear regression forecast, calls Gemini 3.5 Flash-Lite using structured JSON, and validates the output against allowed components/bindings.
- `dist/app.js`: in-memory chat, uploads, data-driven SVG charts, metrics, tables, error states, export. The latest four successful conversation turns and current layout inform follow-ups. UI displays at most 24 chat bubbles.
- `dist/index.html` / `dist/style.css`: responsive interface and connection instructions. CSP allows only same-origin and Google API connections; model output is rendered as text and predefined components, never executable code.
- `dist/sample-quarterly-revenue.csv`: the only demo business dataset. It is not automatically substituted for your uploaded CSV.

Gemini selects component types, order, titles, and a conversational reply. Numeric chart values and metrics are bound to local calculations, not invented by the model. A required line/bar chart contains actual monthly values and one explicitly marked next-month estimate. There is no streaming/partial rendering; the validated dashboard appears when the API request finishes. Failures never fall back to a mock response. Replacing a CSV resets the conversation; reloading clears all data and the key.

The supplied sample totals **$1,240,000** and projects **$543,333.33 for October 2026** using ordinary least squares over the three monthly observations. Estimates are floored at zero. This is a basic trend demonstration, not a calibrated forecasting model; it does not model seasonality or uncertainty. AI-written chat replies may still be inaccurate; verify claims against the bound chart/table values.

## Verification

```sh
node model.test.cjs
node --check dist/app.js
```

Optional browser checks (requires an installed Playwright package and Chromium):

```sh
node browser.test.cjs /absolute/path/to/playwright /absolute/path/to/chrome
```

The browser test intercepts Gemini requests and checks upload, follow-up context, chart changes, error recovery, data replacement, and mobile overflow. It does not call live inference.

Tests include arithmetic, CSV errors, zero/declining revenue, date rollover, unsafe/invalid layouts, follow-up request context, and API failure handling. The provider tests use test doubles. A live inference test requires your own API key and quota.

## Production / 0G later

This is a personal bring-your-own-key prototype. Before shared production use, move inference and credentials behind an authenticated backend, add authorization and private document handling, and use the provider’s appropriate data policies. Keep the validated component schema and replace the provider call with 0G private inference when credits are available. Direct browser keys are not a production secret-storage design.

References:
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://aistudio.google.com/apikey
