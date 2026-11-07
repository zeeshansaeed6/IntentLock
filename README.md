# IntentLock

IntentLock is a security-focused prototype for AI-assisted procurement. The AI may propose a purchase intent, but deterministic code enforces the actual decision before any spending moves. Each intent is turned into a signed contract and checked against policy, card limits, and user authorization before the workflow can continue.

## What the project does

- Accepts a natural-language spend request and converts it into a typed purchase intent.
- Produces a signed contract that binds merchant, cap, MCC, currency, and validity rules.
- Blocks unsafe or tampered spend with fail-closed policy checks.
- Issues sandboxed virtual cards and enforces merchant, MCC, currency, and transaction limits.
- Shows real-time event streams scoped to each authenticated user, with admins seeing all events.
- Keeps an append-only audit trail with a hash chain so records can be verified.

## Architecture

This workspace is a TypeScript monorepo:

- API: `apps/api`
- Web app: `apps/web`
- Shared schemas/types: `packages/shared`

The app enforces a 3-layer model:

1. Contract integrity
   - HMAC-signed intent contracts are validated before approval or execution.
   - Any tampering or signature mismatch triggers a fail-closed response.

2. Card controls
   - MCC, currency, max per transaction, total cap, and merchant allowlists are enforced.
   - Frozen or closed cards cannot be used.

3. Runtime policy
   - Budget, runway, approval thresholds, and transaction limits are evaluated before a request is allowed.

## Actual decline reasons used by the demo

The app uses the following concrete reasons in policy and gateway checks, matching the current implementation:

- `CARD_FROZEN`
- `CARD_CLOSED`
- `CURRENCY_NOT_ALLOWED`
- `MCC_NOT_ALLOWED`
- `MERCHANT_NOT_ALLOWED`
- `MERCHANT_CATEGORY_NOT_ALLOWED`
- `TRANSACTION_LIMIT_EXCEEDED`
- `LIMIT_EXCEEDED`
- `ALL_TIME_LIMIT_EXCEEDED`
- `MAX_TRANSACTIONS_EXCEEDED`
- `INVALID_CONTRACT_SIGNATURE`
- `CONTRACT_*` (for state-based contract blocks)
- `UNKNOWN_INTENT_OR_CARD`
- `OUT_OF_CONTRACT_TIME_WINDOW`

These are the real reasons surfaced by the system; they are not generic placeholders.

## Live sandbox and Airwallex notes

The project can run in a sandboxed Airwallex mode via `DEMO_MODE=live`, but the repository does not claim any fixed real-world Airwallex card IDs. Any card ID seen in the sandbox is environment-specific and should be treated as a runtime value, not a hard-coded production identifier.

## Quick start

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
git clone https://github.com/zeeshansaeed6/IntentLock.git
cd IntentLock
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Or on PowerShell:

```powershell
Copy-Item .env.example .env
```

### Run locally

```bash
npm run demo
```

This starts the API and React dashboard together.

- Web UI: http://localhost:5173
- API: http://localhost:4100
- Default admin email: `admin@intentlock.io`

## Environment variables

The app reads its configuration from `.env.example` and validates the values in `apps/api/src/config/env.ts`.

Key variables include:

- `NODE_ENV`
- `API_PORT`
- `WEB_ORIGIN`
- `WALLET_CURRENCY` (default: `USD`)
- `DEMO_MODE` (`scripted` or `live`)
- `AIRWALLEX_BASE_URL`
- `AIRWALLEX_CLIENT_ID`
- `AIRWALLEX_API_KEY`
- `AIRWALLEX_WEBHOOK_SECRET`
- `INTENT_HMAC_SECRET`
- `ADMIN_INITIAL_PASSWORD`
- `ADMIN_EMAIL`
- `MONGODB_URI`

## Scripts

```bash
npm run dev        # start api + web in watch mode
npm run build      # compile all workspaces
npm run typecheck  # TypeScript validation
npm run test       # run API tests
npm run smoke      # Airwallex sandbox smoke validation
npm run demo       # populate demo state and launch both apps
npm run backup     # create encrypted backup
npm run restore    # restore from encrypted backup
npm run record     # record a judge-mode walkthrough
```

## Security notes

This project intentionally demonstrates fail-closed and least-privilege behavior. It includes:

- secure session handling and role checks
- rate limiting on sensitive endpoints
- `helmet` security headers
- NoSQL-style payload sanitization
- webhook signature verification
- encrypted backup support
- append-only audit logging with hash-chain verification

See [SECURITY.md](SECURITY.md) for reporting and disclosure guidance.

## Project status

IntentLock is a hackathon-style prototype focused on intent-bound buying, policy enforcement, and AI safety in financial workflows. It is intended for demos, evaluation, and controlled experimentation rather than production-grade banking deployment.

## License and disclosures

This repository includes an MIT license in [LICENSE](LICENSE). For security issues, see [SECURITY.md](SECURITY.md).
