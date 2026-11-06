# Sealed mockup

Dependency-free browser prototype for a company intelligence workspace.

Run from this folder:

```sh
python3 -m http.server 4173 --directory dist --bind 127.0.0.1
```

Open http://localhost:4173. You can also open dist/index.html directly.

Try the revenue, sales, and document prompt presets, then Generate dashboard. Switch to Component JSON or export it. File attachments support selection, drag/drop, removal, extension checks, and a 10 MB limit (eight attachments maximum). Only names and sizes are retained in memory; file contents are never read. Reload clears attachments. No analytics, remote assets, inference requests, or local storage.

This is a visual and interaction mockup, not a live AI integration. Prompts select one of three synthetic fixtures. The page's CSP disables network requests. The financial metrics and documents are fictional. No inference privacy claim is verified by this mockup.

## Checks

```sh
node model.test.cjs
node --check dist/app.js
```

## 0G setup for a live version

1. Open https://pc.0g.ai and connect/sign in using its onboarding.
2. Fund the Router balance using its dashboard. Direct provider balances are a different pool.
3. Create a Router API key pinned to Private under Dashboard → API Keys.
4. Pick an available chat model that supports private inference in the live catalog.
5. Store OG_API_KEY and OG_MODEL in backend-only environment variables. Use https://router-api.0g.ai/v1 as the base URL and X-0G-Provider-Trust-Mode: private on inference requests.
6. Add a backend to authorize users, extract uploaded documents, call inference, and validate returned component JSON before rendering. Update the mockup's CSP only for your own backend. Never put the API key in frontend bundles or commit it.

No validator node, GPU server, smart contract, fine-tuning, or 0G Storage integration is needed for this Router-based approach. This repository does not yet implement that backend.

Official references:
- https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview
- https://0g.ai/blog/data-privacy-on-0g-private-computer
