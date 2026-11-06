# Manifest Finance — ETHGlobal Mumbai TODO

Reviewed 6 November 2026 against the current sponsor pages. This is a prioritized implementation plan, not a claim that any sponsor integration or prize qualification is complete. Confirm registration category, submission deadline, and sponsor selections in the event dashboard. Public schedule results differed, so no deadline is assumed here.

Recommended scope: **0G inference + Arkiv report library + Swarm encrypted report storage**. Keep Chainlink as a possible third sponsor. Finish a single coherent demo before adding payments or trading.

## Where we are

- [x] Local app and private GitHub repository: https://github.com/axnima/manifest
- [x] PDF/image/text and common Office document input; chat and follow-up instructions.
- [x] 0G generates real React JSX; local backend compiles with esbuild.
- [x] Sandboxed React preview, source inspection/export, compilation and runtime errors.
- [x] Sanitized local request diagnostics and controlled-response browser tests.
- [x] Fictional finance documents for demos.
- [x] Mainnet 0G integration and successful private-routing inference/compilation evidence.
- [ ] Wallet connection, Arkiv writes/queries, Swarm upload/retrieval.
- [ ] Persistent report library, account/key recovery, multi-user access.
- [ ] Hosted current backend/frontend and judge-ready demo.

The earlier Sites deployment is not the current React-compilation app. Current generation uses mainnet 0G (`0gm-1.0-35b-a3b`) through the local backend. Testnet 0G on Galileo does not establish Router credits or a usable inference provider. Forecast arithmetic is only independently calculated for the original revenue sample; general financial analysis is model-generated.

## P0 — Confirm eligibility and access

- [ ] Confirm whether the entry is from scratch or Continuity. Preserve dated starting commits and identify work done during the permitted window; do not infer eligibility merely from having an existing repo.
- [ ] Confirm exact deadline and allowed sponsor selections in the hacker dashboard. The Arkiv bonus page says it does not consume an additional partner selection.
- [ ] Ask 0G to activate team credits and identify Router vs Direct/testnet access, working model IDs, privacy modes, quotas, and request/proof fields.
- [ ] Ask the 0G team whether our individual freelancer/small-business finance workflow meets their consumer-app focus.
- [ ] Get Arkiv Rabdi access/faucet funds and SDK guidance. This is a separate network from Galileo.
- [ ] Get Swarm Bee/service access, a usable postage batch, its lifetime, and credentials. Establish who provides the batch and how retrieval is demonstrated.
- [ ] Confirm Swarm bonus eligibility for the chosen Arkiv entry category.

## P1 — Make the core 0G demo real

- [x] Move provider credentials and inference into the local backend; load root .env and keep keys out of the browser, previews, logs, and Git.
- [ ] Add user authentication and per-user limits before hosting the backend.
- [x] Replace the main generation call with 0G. Keep React output and compilation intact; do not silently fall back to Gemini when demonstrating private 0G inference.
- [x] Select low-cost 0GM and verify a live complete JSX response within its output limit.
- [x] Add local PDF text extraction and native image transport for 0GM. Scanned PDFs require conversion; no alternate provider receives files.
- [x] Show actual provider IDs, model, requested Private routing, token usage, estimated 0GM cost; log latency.
- [ ] Add independent attestation/proof verification; requested Private routing alone is not proof verification.
- [ ] Test failed inference, exhausted balance, invalid credentials, malformed JSX, compiler failure, and runtime failure.
- [ ] Validate profits as revenue minus expenses for matching periods. Never label revenue extrapolation as projected profit. Mark assumptions, insufficient evidence, and forecasts clearly.
- [ ] Pick one repeat-use story: a freelancer uploads this month's books, compares against last month, and revisits saved reports.
- [ ] Optional iAI: obtain the sponsor's Privy configuration; demonstrate account sign-in and credit consumption on a supported localhost origin.
- [ ] Write the one-sentence dependency explanation: without 0G, document interpretation and custom dashboard generation stop.

Sponsor requirements: inference in the main flow, request IDs, repeat-use value, public code, live link, short video, and team details. Private routing is our product requirement, not an assumption about every 0G model. [0G prize page](https://ethglobal.com/events/mumbai/prizes/0g)

## P2 — Decide the privacy boundary before storing reports

- [ ] Inventory sensitive material: original files, extracted text, prompts, replies, filenames, generated JSX, embedded chart data, and compiled bundles.
- [ ] Use fictional data for all public judging artifacts.
- [ ] Adopt a first-version design: encrypt a saved report package **in the browser before upload**. Use established authenticated encryption (e.g. Web Crypto AES-GCM), fresh randomness, and a versioned format; do not design a custom cipher.
- [ ] Store only ciphertext on Swarm. Put its reference and deliberately minimal, nonsensitive indexing fields in Arkiv.
- [ ] Keep decryption material off public entities, URLs, logs, JSX, and analytics. Never publish a full Bee encrypted reference containing a key.
- [ ] Choose and test key recovery before calling saves durable: for example, a passphrase-protected recovery export. Explain the consequence of losing it.
- [ ] Show users what public metadata remains visible: owner address, activity timing, schema, and any indexed fields. Avoid company names, financial figures, filenames, and private report titles in public attributes.
- [ ] Treat wallet ownership as write authorization, not read confidentiality. Filtering by wallet is not encryption.
- [ ] Do not promise secure deletion: entity expiry removes discoverability, not necessarily historical copies or already-downloaded content.
- [ ] Decide whether source documents are persisted at all. Smallest version saves the generated report and source summary; originals stay local unless explicitly included by the user.
- [ ] Document that private inference, encrypted storage, and a plaintext compilation backend have different trust boundaries. Do not claim full end-to-end confidentiality without addressing all three.

Arkiv is publicly readable. [Arkiv data model](https://docs.arkiv.network/start-here/introduction/)

Swarm is public by default; native encrypted references include a secret. Client-side encryption before handing ciphertext to a gateway is the proposed design, rather than trusting a public gateway with plaintext or a key-bearing reference. [Swarm encryption](https://docs.ethswarm.org/docs/develop/tools-and-features/store-with-encryption/)

Sharing/revocation is later work. ACT can manage access to future versions, but cannot retract plaintext a recipient already obtained. [Swarm access control](https://docs.ethswarm.org/docs/concepts/access-control/)

## P3 — Arkiv + Swarm report library

- [ ] Add wallet connection/signing to the trusted host UI, never the generated iframe.
- [ ] Define a versioned report package: generated JSX, reply, source descriptions, generation receipt, and relevant dates. Exclude API keys and compiled dependencies.
- [ ] Encrypt that package; upload ciphertext to Swarm; verify retrieval before writing the index entry.
- [ ] Define Arkiv entities with an app-specific schema tag, opaque report ID, ciphertext reference, package version, and chosen expiration. Review every public field for leakage.
- [ ] Create real entities through the SDK. Record transaction/entity IDs and handle failed or cancelled writes.
- [ ] Build **My Reports** using real Arkiv queries filtered by owner and app schema. Include loading, empty, pagination, and error states.
- [ ] Reopen a report through its Arkiv entry, fetch the Swarm ciphertext, decrypt with the user's key, validate package bounds, and recompile JSX into the existing isolated preview.
- [ ] Treat downloaded code as untrusted even if its content hash is correct. Never load saved report HTML directly in the privileged host page.
- [ ] Show report versions and an expiration/extend action where useful. Refresh after a write; never pretend a failed save succeeded.
- [ ] Handle missing postage, unavailable chunks, wrong key, corrupt payload, wrong owner, expired entity, and interrupted saves.
- [ ] Demonstrate refresh/restart and a second retrieval session so persistence is visible.
- [ ] Explain the user benefit: a wallet-owned, portable report catalog and retrievable encrypted artifacts, rather than an unused log.

Prize evidence: actual writes plus a feature reading Arkiv; wallet/query examples; an open-source license and AI-use disclosure. Prepare `/arkiv/schema.md`, `/arkiv/friction.md`, `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, and `/arkiv/how-you-use-arkiv.md` for the selected Build track. For the Swarm bonus add `/arkiv/swarm.md` with references, postage/provider details, source paths, reproduction steps, and the demo timestamp. The advertised Build pool is $4,000 per entry category; the relevant Swarm bonus is $500. [Arkiv prizes and bonus](https://ethglobal.com/events/mumbai/prizes/arkiv)

## P4 — Submission and judge access

- [ ] Make the repository public before submission; review current files AND Git history for secrets first. Do not change visibility as part of this planning task.
- [ ] Choose an open-source license and add it with the project owner's agreement.
- [ ] Add architecture diagram, exact setup/environment instructions, demo fixtures, known limits, and AI-assistance disclosure.
- [ ] Record the starting baseline and meaningful incremental commits. Include sponsor evidence and clear code entry points.
- [ ] Deploy the current Python/Node backend and frontend to a host supporting both and esbuild. Bind/configure it deliberately; the current loopback development server is not a production deployment.
- [ ] Provide safe judge access, bounded usage, server-held demo credits, and no requirement to paste a judge's personal API key.
- [ ] Test from a clean browser/machine and use only fictional documents.
- [ ] Rehearse: upload -> ask for projected profit/pink graph -> inspect generated React -> show 0G receipt -> save encrypted report -> query Arkiv -> fetch/decrypt Swarm package -> reopen.
- [ ] Record a core video under 3 minutes; create separate sponsor clips only where required. Clearly identify real, simulated, and unavailable capabilities.
- [ ] Fill in project description, live URL, public repo, team/Telegram/X, applicable contracts, explorer links, and selected sponsor tracks.
- [ ] Recheck sponsor pages immediately before submission; prize rules and infrastructure can change.

## Optional sponsor demos — choose only after the core flow works

These are proposals, not confirmed eligibility or implemented integrations. Pick at most one more substantial extension.

| Sponsor / track | Proposed Manifest Finance demo | Qualification work / recommendation |
| --- | --- | --- |
| Chainlink CRE — $1,500 | Reconcile an uploaded cash ledger against an on-chain treasury balance, then show discrepancies in the generated report. | A real CRE workflow connects blockchain data and an API/LLM; successful CLI simulation is acceptable. Best third-track fit; confirm overlapping wording with organizers. [Requirements](https://ethglobal.com/events/mumbai/prizes/chainlink) |
| Hedera x402 — $6,500 | A budgeted client pays a protected report-generation endpoint, receives the report and settlement receipt. | Must settle a real testnet/mainnet payment, complete a paid request without per-request human approval, and show transaction evidence. Good monetization extension, higher effort. [Requirements](https://ethglobal.com/events/mumbai/prizes/hedera) |
| World Agent Pass — $5,000 | Verify a human before approving a consequential report publication or finance action. | Backend validation plus successful and denied/cancelled paths; current event proofs are mocked. A decorative login does not meet the intended use. Optional, needs a meaningful protected action. [Requirements](https://ethglobal.com/events/mumbai/prizes/world) |
| ENSv2 — $7,000 | An accountant namespace delegates report-related rights to separate agents/accounts. | ENSv2 registry/resolver/access control must be central and functional on an eligible network; simply displaying an ENS name is insufficient. Defer. [Requirements](https://ethglobal.com/events/mumbai/prizes/ens) |
| Ethereum Foundation Anon-RPC — $5,000 | Private treasury reads feeding a finance dashboard. | Default relevant RPC reads must actually use Anon-RPC. Only fits if treasury reads are added. CROPS is a separate possibility requiring a deeper privacy/resilience design. [Requirements](https://ethglobal.com/events/mumbai/prizes/ethereum-foundation) |
| Whitechain Operate — $5,000 | Invoice ingestion, customer checkout, settlement reconciliation, then refund/accounting export. | Real specified test USDT payment, verified contracts, merchant/customer views, feedback, public progress. A transfer button alone is insufficient. Large extension. [Requirements](https://ethglobal.com/events/mumbai/prizes/whitechain) |
| Uniswap — $10,000 fresh-build pool | Treasury asset analysis linked to a useful Uniswap quote/execution workflow. | Genuine Uniswap integration plus FEEDBACK.md and their feedback form. Avoid adding a swap just for a badge. [Requirements](https://ethglobal.com/events/mumbai/prizes/uniswap-foundation) |
| Arc — $3,000 per listed category | Treasury/conditional stablecoin settlement or a service-buying agent. | Every prize requires Arc Studio as the starting point and a shareable Studio project. Current build does not satisfy that; ask before considering an extension. [Requirements](https://ethglobal.com/events/mumbai/prizes/arc) |
| 1inch Aqua — $5,000 fresh-build pool | A genuine sophisticated treasury position. | Official Aqua/SwapVM contracts and demonstrated token-transfer execution. Significant product change; skip for this MVP. [Requirements](https://ethglobal.com/events/mumbai/prizes/1inch) |
| Definitive — $2,500 social advanced-orders track | A collaborative treasury/trading workflow. | Advanced order execution onchain and required social demo submissions. Our document tool lacks the social trading flow; skip for this MVP. [Requirements](https://ethglobal.com/events/mumbai/prizes/definitive) |

0G also advertises a $2,000 self-funding-agent pool: revisit only after there is genuine service revenue automatically reaching the agent's compute balance, with evidence and spending controls. Paying our endpoint and funding 0G are separate integration problems. Physical AI and specialized node tooling would distract from this app.

## First implementation sequence

1. Get one reliable 0G generation request and its receipt.
2. Settle encryption/key recovery and public metadata decisions.
3. Save and reopen one encrypted report via Swarm + Arkiv.
4. Add the report library, verify negative paths, and complete sponsor evidence.
5. Deploy/rehearse and prepare the submission.
6. If time remains, implement the CRE reconciliation demo.

## 0G migration verification — 6 November 2026

Live mainnet fictional CSV generation succeeded with `0gm-1.0-35b-a3b`, Private routing requested, and real esbuild compilation. Provider response ID: `chatcmpl-2752304f-5bdf-4d6b-b000-b7bf9a6c26bb`. Usage: 494 input / 1,092 output tokens; estimated $0.00056368 at catalog promotional rates. Controlled-response browser checks passed; these browser checks do not spend credits. No commits were made.
