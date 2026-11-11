# IntentLock

**The agent can be wrong. The money can't.**

An intent-bound purchase agent for the **Airwallex Agentic Banking Hackathon, Track 2**. A user states what they need to buy in plain language. An AI agent proposes the purchase, deterministic code makes the financial decision, and an Airwallex virtual card is issued that can pay for **that purchase and nothing else**.

![Track](https://img.shields.io/badge/Airwallex%20Hackathon-Track%202-6366F1?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-60%20passing-success?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)

<p align="center">
  <img src="docs/screenshots/02-command-center.png" alt="IntentLock Command Center: natural-language intent, live metrics and 12-week cash runway" width="920" />
</p>

| | |
|---|---|
| **Demo video** | https://youtu.be/O0X9ScKVNW0 |
| **Repository** | https://github.com/zeeshansaeed6/IntentLock |

---

## Table of contents

1. [The problem](#the-problem)
2. [The solution](#the-solution)
3. [How it works](#how-it-works)
4. [Three enforcement layers](#three-enforcement-layers)
5. [Live vs simulated: what is real](#live-vs-simulated-what-is-real)
6. [Features and pages](#features-and-pages)
7. [Screenshots](#screenshots)
8. [Judge Mode: the 3-minute demo](#judge-mode-the-3-minute-demo)
9. [Airwallex integration](#airwallex-integration)
10. [Tech stack](#tech-stack)
11. [Quick start](#quick-start)
12. [Configuration](#configuration)
13. [Scripts](#scripts)
14. [API reference](#api-reference)
15. [Security model](#security-model)
16. [Testing](#testing)
17. [Repository structure](#repository-structure)
18. [Known limitations and roadmap](#known-limitations-and-roadmap)
19. [Credits and license](#credits-and-license)

---
- The model turns a request into a typed proposal. It never does money math, never holds a card number, and cannot change a limit after the contract is signed.
- Deterministic code checks the proposal against company policy and a 12-week cash runway, then **signs** the result as an Intent Contract (HMAC-SHA256).
- Only then is a virtual card created, with limits, merchant category (MCC) and currency taken **from the signed contract**, not from the model.
- Every authorization is checked again against that contract, and anything suspicious freezes the card.

**Worst-case loss is bounded by the card limit**, whatever the model does.

---

## How it works

```mermaid
flowchart TD
    U["User request (natural language)"] --> W["Untrusted-data wrapper"]
    W --> L["LLM boundary: scripted / Gemini / OpenAI"]
    L --> P["Typed PurchaseProposal (Zod)"]
    P --> T["Treasury engine: 12-week runway vs reserve floor"]
    T --> POL["Policy engine: 7 deterministic rules"]
    POL --> C["Signed Intent Contract (HMAC-SHA256)"]
    C --> A{"Over approval threshold?"}
    A -- "yes" --> H["Human approval, bound to the exact signature"]
    A -- "no" --> G
    H --> G["Gateway: Live Airwallex sandbox or Mock"]
    G --> CARD["Virtual card: limit, MCC, currency, expiry from the contract"]
    CARD --> AUTH["Authorization (simulated)"]
    AUTH --> V["Verify against contract"]
    V -- "rule violation" --> D["Decline, card stays active"]
    V -- "integrity anomaly" --> F["Freeze card + audit event"]
    V -- "all checks pass" --> OK["Cleared"]
    WH["Webhooks + fallback poller"] --> LED["Ledger and hash-chained audit log"]
    OK --> LED
    D --> LED
    F --> LED
```

An architecture diagram is also available at `docs/assets/architecture.svg`.

### The treasury decision

The agent does not only pay, it **decides**. For a SaaS purchase it compares monthly and annual billing against a 12-week cash projection and the company's reserve floor:

- **Annual** is chosen only if cash never drops below the reserve floor.
- Otherwise **monthly**, or **defer** if neither is safe.
- The LLM reads vendor terms and explains the result. **Code computes the numbers.**

The seed company ("Northstar Labs Inc.") has $21,000 cash, a $12,000 reserve floor and a $300 approval threshold, so the default SaaS request needs human approval.

### Purchase templates

| Template | Default merchant | Allowed MCCs |
|---|---|---|
| `saas` | PixelForge Design | 5734, 7372 |
| `cloud_gpu` | Lambda GPU Cloud | 7379, 7372 |

Different purchase types reuse the same pipeline with only a template change.

---

## Three enforcement layers

| Layer | What it checks | If it fails |
|---|---|---|
| **1. Contract integrity** | HMAC-SHA256 over the canonical contract (merchant, amount, currency, MCCs, dates, limits). Detects tampering. | **Integrity anomaly:** card is frozen and a security event is logged. |
| **2. Card controls** | Airwallex card limits, MCC allowlist, currency, and transaction count set on the card at issuance. | The authorization is **declined** by the card (e.g. `TRANSACTION_LIMIT_EXCEEDED`, `MCC_NOT_ALLOWED`, `CURRENCY_NOT_ALLOWED`). |
| **3. Runtime policy** | Remaining contract balance, contract state, expiry, budget and approval binding, re-verified on every authorization. | **Policy decline:** the card stays active unless integrity is compromised. |

Ordinary rule violations decline without freezing. Only integrity problems (bad signature, unknown card, merchant mismatch, expired contract, or Airwallex and local verdicts disagreeing) freeze the card.

---

## Live vs simulated: what is real

IntentLock runs in two modes, set by `DEMO_MODE`.

| Capability | `scripted` (default, no credentials) | `live` (Airwallex sandbox) |
|---|---|---|
| Contract signing, policy, treasury engine | Real code | Real code |
| Virtual card issuance | Mock gateway | **Airwallex sandbox API** |
| Card freeze / unfreeze | Mock gateway | **Airwallex sandbox API** |
| Authorizations | Mock gateway | **Airwallex sandbox simulation** (`simulation/issuing`) |
| Funding | Mock | Sandbox deposit simulation |
| Reconciliation | n/a | Webhooks plus a fallback poller |
| LLM | Scripted (deterministic) | Scripted, Gemini or OpenAI via `LLM_PROVIDER` |

**Honesty guarantees**

- No real money moves anywhere. This is **sandbox only**.
- Authorizations are **simulated** with Airwallex's sandbox simulation endpoint. There is no real merchant checkout.
- In live mode, if the tenant does not have Airwallex Issuing enabled, the gateway falls back to a simulated result **only on an explicit "issuing not enabled" error**. Any other error is surfaced, never hidden.
- Every fallback is flagged `isSimulated` and shown in the UI as an amber **SIMULATED FALLBACK** badge. Judge Mode narration says "real Airwallex sandbox cards" only when no fallback happened in the run.
- Real Airwallex card IDs can be checked in the Airwallex dashboard under Issuing > Cards.

---

## Features and pages

| Route | Page | What it shows |
|---|---|---|
| `/` | Landing | Product overview and the core principle. |
| `/login` | Login | Session login (httpOnly cookie). |
| `/console` | Command Center | Natural-language intent box with quick prompts, key metrics, the 12-week cash runway chart, and the enforcement pipeline. |
| `/analytics` | Treasury Analytics | Executive dashboard for budget and runway. |
| `/intents` | Intents | Every signed contract, approval inbox, and the **Tamper Test** that flips a field and shows the signature check failing. |
| `/cards` | Cards | Virtual card visuals (masked number, limit, remaining, status, badges) with Freeze and Unfreeze. |
| `/transactions` | Transactions | Ledger of cleared and declined authorizations with the exact decline reason, plus a reconcile button. |
| `/audit` | Audit Trail | Append-only, hash-chained log of proposals, approvals, card events and anomalies. |
| `/redteam` | Red-Team Lab | Adversarial scenarios: hostile vendor documents, limit-inflation and MCC-evasion attempts, shown being blocked. |

---

## Screenshots

> Captured in `scripted` mode (header shows "Airwallex: Mock Gateway"), so card IDs in these images are mock IDs. In `live` mode the same screens show real Airwallex sandbox card IDs.

### Landing page
<p align="center"><img src="docs/screenshots/01-landing.png" alt="IntentLock landing page" width="900" /></p>

### 1. Propose, then require human approval
The agent turns the request into a signed contract. Anything over the policy threshold stops for a human, and the approval is bound to the contract's exact signature.

<p align="center"><img src="docs/screenshots/02b-human-approval.png" alt="Human approval modal showing merchant, cap, treasury decision and contract seal" width="900" /></p>

### 2. Signed intent contracts
Each contract carries the merchant, cap, MCCs, currency and validity window, sealed with HMAC-SHA256. The Tamper Test breaks the seal on purpose.

<p align="center"><img src="docs/screenshots/03-intents-contract.png" alt="Intent contracts with signature and tamper test" width="900" /></p>

### 3. Intent-bound virtual cards
The card's limit, MCC and currency come from the signed contract, with one-click freeze.

<p align="center"><img src="docs/screenshots/04-cards.png" alt="Virtual commercial card bound to a contract" width="900" /></p>

### 4. Judge Mode and the clearing ledger
Seven runtime scenarios run end to end. Passes clear, and violations are declined with the exact reason.

<p align="center">
  <img src="docs/screenshots/09-judge-mode.png" alt="Judge Mode stepping through enforcement scenarios" width="440" />
  <img src="docs/screenshots/05-transactions.png" alt="Card authorization ledger with cleared and declined transactions" width="440" />
</p>

### 5. Red-Team Lab and audit trail
Hostile vendor documents and limit-inflation attempts are neutralized, and every event is recorded in the hash-chained audit log.

<p align="center">
  <img src="docs/screenshots/06-red-team-lab.png" alt="Red-Team Lab showing an attack neutralized" width="440" />
  <img src="docs/screenshots/07-audit-trail.png" alt="Audit trail of proposals, approvals and anomalies" width="440" />
</p>

### 6. Treasury analytics
<p align="center"><img src="docs/screenshots/08-analytics.png" alt="Treasury and analytics dashboard" width="900" /></p>

---

## Judge Mode: the 3-minute demo

Click **Judge Mode** in the top bar. It steps through seven runtime scenarios with narration:

| Step | Scenario | Expected result |
|---|---|---|
| 1 | Valid SaaS purchase | Cleared within the bound limit and allowed MCC. |
| 2 | Per-transaction limit exceeded | Declined (`TRANSACTION_LIMIT_EXCEEDED`). |
| 3 | Unauthorized MCC (5812 Dining) | Declined (`MCC_NOT_ALLOWED`). |
| 4 | Currency mismatch (EUR on a USD contract) | Declined (`CURRENCY_NOT_ALLOWED`). |
| 5 | Prompt injection in a vendor document | Parsed safely; limits and merchant stay locked. |
| 6 | Post-approval price hike | Old card frozen, re-decision under a new contract. |
| 7 | Full verification suite | All checks together. |

### Suggested 3-minute walkthrough

1. **Intent (0:00).** In the Command Center, submit *"Buy a team plan for our design tool, 10 seats."* Show the runway chart and the agent's reasoning steps.
2. **Contract (1:00).** Open Intents. Show the signed contract, then click **Tamper Test** and watch verification fail.
3. **Approval and card (1:30).** Approve the contract (amount is over the $300 threshold). Open Cards and show the issued card and its limit.
4. **Enforcement (2:00).** Run Judge Mode. Point out the pass, the three declines, and the price-hike freeze.
5. **Attack (2:40).** Open the Red-Team Lab and show a hostile vendor document being blocked.
6. **Audit (3:00).** Open the Audit Trail to show everything is traceable.

---

## Airwallex integration

All calls go to the **sandbox** (`https://api.sandbox.airwallex.com`) through a rate-limited client with token caching and idempotent `request_id` handling.

| Purpose | Airwallex API |
|---|---|
| Authentication | `POST /api/v1/authentication/login` |
| Funding account | List and create global accounts |
| Sandbox funding | `POST /api/v1/simulation/deposit/create` |
| Cardholder | `POST /api/v1/issuing/cardholders/create` |
| Virtual card | `POST /api/v1/issuing/cards/create` (authorization controls: limits, MCC, currency, active window, transaction count) |
| Freeze / close | `POST /api/v1/issuing/cards/{id}/update` |
| Authorization simulation | `POST /api/v1/simulation/issuing/create` |
| Reconciliation | `GET /api/v1/issuing/transactions` |
| Webhooks | `issuing.transaction.succeeded` and `issuing.transaction.failed`, signature-verified and deduplicated |

Webhook verification uses the raw request body, a 5-minute timestamp tolerance, and event-id deduplication.

> **Not implemented:** Airwallex real-time remote authorization. It is a production-hardening item on the roadmap, so this prototype does not claim it.

---

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS v4, React Router, Zustand, Recharts, Framer Motion |
| Backend | Node.js 20+, Express 5, TypeScript (strict), Zod |
| Data | In-memory repository by default; optional MongoDB repository |
| LLM | Provider-agnostic boundary: scripted (default), Gemini, OpenAI. Structured, schema-validated output only. |
| Security | bcrypt, helmet, express-rate-limit, NoSQL input sanitization, httpOnly cookies |
| Testing | Vitest (60 tests, 16 suites) |
| Tooling | npm workspaces monorepo, Playwright for the recorded walkthrough |

---

## Quick start

### Prerequisites
- Node.js 20 or newer
- npm 10 or newer

### 1. Install
```bash
git clone https://github.com/zeeshansaeed6/IntentLock.git
cd IntentLock
npm install
```

### 2. Configure
```bash
cp .env.example .env          # macOS / Linux
# Copy-Item .env.example .env # Windows PowerShell
```
`.env` is git-ignored. Never commit it.

### 3. Run (no credentials needed)
```bash
npm run demo
```
- Web UI: http://localhost:5173
- API: http://localhost:4100

In development the API generates random admin and demo-user passwords at startup and **prints them once in the terminal**. The admin email is `admin@intentlock.io` and the demo user is `user@intentlock.io`. To use fixed passwords, set `ADMIN_INITIAL_PASSWORD` (and optionally `DEMO_USER_PASSWORD`) in `.env`.

### 4. Optional: live Airwallex sandbox
1. Create an Airwallex **sandbox** account and generate API credentials (Account > Developer > API keys).
2. Edit `.env`:
   ```env
   DEMO_MODE=live
   AIRWALLEX_BASE_URL=https://api.sandbox.airwallex.com
   AIRWALLEX_CLIENT_ID=your_sandbox_client_id
   AIRWALLEX_API_KEY=your_sandbox_api_key
   AIRWALLEX_WEBHOOK_SECRET=your_webhook_secret
   WALLET_CURRENCY=USD
   ```
3. Verify the connection:
   ```bash
   npm run smoke
   ```
4. Run `npm run demo` and run Judge Mode. Cards created in live mode appear in the Airwallex dashboard under Issuing > Cards.

> **Issuing must be enabled** on your sandbox account. If it is not, IntentLock shows the **SIMULATED FALLBACK** badge instead of pretending a real card was created. Contact Airwallex developer support to enable it.

### 5. Optional: real LLM
```env
LLM_PROVIDER=gemini        # or openai, or scripted (default)
LLM_MODEL=gemini-2.5-flash
LLM_API_KEY=your_llm_api_key
```
The model can only return a schema-validated purchase proposal. All amounts, limits and decisions are computed by code.

---

## Configuration

Validated at startup in `apps/api/src/config/env.ts`.

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `production` refuses to start without the two secrets below. |
| `API_PORT` | `4100` | API port. |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed CORS origin. |
| `DEMO_MODE` | `scripted` | `scripted` (mock gateway) or `live` (Airwallex sandbox). |
| `WALLET_CURRENCY` | `USD` | Wallet currency used by the gateway. |
| `AIRWALLEX_BASE_URL` | sandbox URL | Airwallex API base URL. |
| `AIRWALLEX_CLIENT_ID` | none | Sandbox client ID (server-side only). |
| `AIRWALLEX_API_KEY` | none | Sandbox API key (server-side only). |
| `AIRWALLEX_WEBHOOK_SECRET` | none | Webhook signature secret. |
| `LLM_PROVIDER` | `scripted` | `scripted`, `gemini` (alias `google`) or `openai`. |
| `LLM_MODEL` | none | Model name. |
| `LLM_API_KEY` | none | LLM API key (server-side only). |
| `INTENT_HMAC_SECRET` | random in dev | Contract-signing secret. **Required in production**, at least 8 characters (32+ recommended). |
| `ADMIN_INITIAL_PASSWORD` | random in dev | Admin password. **Required in production**. |
| `ADMIN_EMAIL` | `admin@intentlock.io` | Admin login email. |
| `MONGODB_URI` | none | Optional MongoDB connection string. Without it the app uses the in-memory store. |
| `BACKUP_ENCRYPTION_KEY` | none | Encryption key for database backups. Set a strong, unique value. |

All secrets live only on the server, loaded from `.env`. No secret is bundled into the frontend.

---

## Scripts

Run from the repository root.

| Command | What it does |
|---|---|
| `npm run demo` | Seeds demo data and starts the API and web app together. |
| `npm run dev` | Starts the API and web app in watch mode. |
| `npm run build` | Builds the shared package, API and web app. |
| `npm run typecheck` | Strict TypeScript checks across all workspaces. |
| `npm test` | Runs the API test suite (Vitest). |
| `npm run smoke` | Exercises the real Airwallex sandbox path (login, funding, cardholder, card, simulated authorizations, freeze). |
| `npm run seed` | Loads the seed company model. |
| `npm run backup` | Creates an encrypted database backup. |
| `npm run restore` | Restores from an encrypted backup (supports a dry-run). |
| `npm run record` | Records a headless-browser walkthrough of Judge Mode. |

> Run `npm run build` once before `npm test` on a fresh clone so the shared package is compiled.

---

## API reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Service health, mode, and Airwallex connectivity. |
| `POST` | `/api/auth/register` | Public, rate-limited | Create an account. |
| `POST` | `/api/auth/login` | Public, rate-limited | Log in and set an httpOnly session cookie. |
| `POST` | `/api/auth/logout` | Session | End the session. |
| `GET` | `/api/auth/me` | Session | Current user and role. |
| `POST` | `/api/intents` | Session, rate-limited | Create an intent from natural language. |
| `GET` | `/api/intents` | Session | List the caller's intents. |
| `GET` | `/api/intents/:id` | Session (owner or admin) | Get one intent. |
| `POST` | `/api/intents/:id/approve` | Session (owner or admin) | Approve, bound to the contract's `expectedSignature`. |
| `POST` | `/api/intents/:id/reject` | Session (owner or admin) | Decline a pending contract; no card is ever issued. |
| `POST` | `/api/intents/:id/revoke` | Session (owner or admin) | Kill switch: revoke the contract and freeze its card. |
| `GET` | `/api/cards` | Session | List the caller's cards. |
| `POST` | `/api/cards/:id/freeze` | Session (owner or admin) | Freeze or unfreeze a card. |
| `GET` | `/api/transactions` | Session | List the caller's transactions. |
| `GET` | `/api/audit` | Session | Audit trail for the caller. |
| `GET` | `/api/company` | Session | Seed company and treasury configuration. |
| `POST` | `/api/scenarios/:name/run` | **Admin** | Run a scenario: `pass`, `limit`, `mcc`, `currency`, `redteam`, `pricehike`, `judge`. |
| `POST` | `/api/reconcile` | **Admin** | Poll Airwallex and reconcile transactions. |
| `POST` | `/api/reset` | **Admin, non-production only** | Reset the demo store. |
| `GET` | `/api/stream` | Session | Server-Sent Events feed, filtered per user (admins see all). |
| `POST` | `/api/webhooks/airwallex` | Signature | Raw-body, HMAC-verified Airwallex webhook receiver. |

Errors use a consistent shape `{ error: { code, message } }`. Internal errors return only a generic message and a request ID.

---

## Security model

### Design rules

| Rule | Implementation |
|---|---|
| **Bounded loss** | Card limit is `min(user budget, remaining department budget)`, computed in integer minor units. No agent output can raise it after issuance. A property-style test enforces this. |
| **Single-use scope** | Contracts carry a transaction count, MCC allowlist, currency allowlist and expiry window. |
| **Anomaly isolation** | Ordinary declines do not freeze the card. Integrity anomalies do. |
| **Credential isolation** | The model never sees card numbers or API keys. Only the last four digits are stored and shown. |
| **Untrusted model boundary** | External text (vendor terms, invoices) is wrapped as data. The model returns only a Zod-validated proposal. |
| **Contract immutability** | HMAC-SHA256 over the canonical contract. Any change breaks the signature. |
| **Approval binding** | Approval requires the exact contract signature. If the contract changed, approval fails. |
| **Idempotency** | Idempotency keys on mutations; webhooks deduplicated by event ID. |
| **Fail closed** | Missing card, bad signature, or an ambiguous state means block. |

### Application hardening

- Passwords hashed with **bcrypt (cost 12)**; common passwords rejected; generic login error messages.
- **httpOnly, SameSite** session cookies; sessions use 256-bit random tokens.
- **Helmet** with a strict Content-Security-Policy, HSTS, and `x-powered-by` disabled.
- **Rate limiting:** 30 requests per 15 minutes on auth routes and 40 per minute on expensive routes.
- **Input validation** with Zod on every route, a 100 KB body limit, and NoSQL operator sanitization.
- **Per-user scoping** of data reads and of the live event stream.
- **Centralized error handler** that never returns stack traces or upstream error bodies.
- **Production guard:** the API refuses to start in production without `INTENT_HMAC_SECRET` and `ADMIN_INITIAL_PASSWORD`. No credentials are hardcoded.
- **Encrypted backups** (AES-256-GCM with an integrity tag, 14-day retention) and a scheduled daily backup workflow.
- **Hash-chained audit log** with a verification function.
- Dependency audit: `npm audit` reports no known vulnerabilities at the time of writing.

See [SECURITY.md](SECURITY.md) for the full verification report, restore procedure and threat model.

---

## Testing

```bash
npm run build && npm run typecheck && npm test
```

**60 tests across 16 suites** covering:

- Contract canonicalization, HMAC signing and tamper detection.
- Money math (integer minor units, no floating-point drift).
- The policy engine, approval binding, and a property test that card limits never exceed `min(user budget, remaining budget)`.
- The treasury engine (monthly vs annual vs defer, reserve-floor breach).
- The Airwallex gateway with mocked fetch (payloads, fallback only on the explicit error, plain 400s are not swallowed), the status mapper, and webhook signature, replay and dedupe handling.
- Scenario runner behavior, LLM boundary, environment validation, security headers, auth and backup/restore.

---

## Repository structure

```text
IntentLock/
├── apps/
│   ├── api/                 Express 5 backend
│   │   ├── src/
│   │   │   ├── agent/         LLM boundary (scripted, Gemini, OpenAI), agent graph, event bus
│   │   │   ├── auth/          Sessions, bcrypt, role checks
│   │   │   ├── config/        Env validation, logger, input sanitizer
│   │   │   ├── domain/        Contracts, policy engine, treasury engine, templates, money
│   │   │   ├── enforcement/   Runtime authorization checks
│   │   │   ├── integrations/airwallex/   Client, gateway (live and mock), payloads, mapper, webhooks
│   │   │   ├── scenarios/     Judge Mode and red-team scenarios
│   │   │   ├── seed/          Seed company model
│   │   │   └── store/         In-memory and MongoDB repositories
│   │   └── scripts/         Encrypted backup and restore
│   └── web/                 React + Vite frontend (pages, components, state, API client)
├── packages/shared/         Shared Zod schemas and types
├── docs/assets/             Architecture diagram
├── scripts/                 Recording and presentation scripts
├── .github/workflows/       Daily encrypted backup workflow
├── SECURITY.md              Security report and threat model
└── LICENSE                  MIT
```

---

## Known limitations and roadmap

**Current limitations (stated plainly)**

- **Sandbox prototype.** No real money moves; authorizations are simulated through Airwallex's sandbox simulation endpoint.
- **Issuing availability.** Real card creation needs Airwallex Issuing enabled on the sandbox account; otherwise results are clearly marked as simulated fallbacks.
- **USD policy.** The sandbox policy currently allows USD only. Using another wallet currency also needs the policy allowlist updated.
- **Default data store is in memory.** State resets on restart unless MongoDB is configured. The audit hash chain is verified in the in-memory store; MongoDB audit records are not yet chained.
- **Scripted LLM by default,** so the demo is deterministic. Real model providers are optional.
- **No remote authorization.** Airwallex real-time remote authorization is not implemented.

**Roadmap**

- Airwallex real-time remote authorization as a second enforcement layer.
- Hash-chained audit records in MongoDB.
- More purchase templates (travel, recurring SaaS renewals) and multi-currency policy.
- A real merchant-checkout executor in an isolated sandbox.
- Per-organization tenants and approval workflows with multiple approvers.

---

## Credits and license

Built for the **Airwallex Agentic Banking Hackathon**, Track 2: Intent-Bound Purchase Agent, using the Airwallex Issuing sandbox APIs.

The analytics dashboard styling is adapted from the **Capitalio** dashboard theme. Please see that template's original license and credit its authors.

Released under the [MIT License](LICENSE).
