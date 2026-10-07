<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/images/logo-light.svg">
    <img alt="StockSync" src=".github/images/logo-light.svg" width="340">
  </picture>
</div>

<div align="center">
  <h3>Multi-tenant inventory that keeps your ads in sync with your stock.</h3>
</div>

<div align="center">
  <a href="https://github.com/yale1995/stocksync/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/yale1995/stocksync/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="node 24" src="https://img.shields.io/badge/node-24-007ec6">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6">
  <img alt="PostgreSQL 18" src="https://img.shields.io/badge/PostgreSQL-18-336791">
</div>

<br>

<div align="center">
  <img alt="StockSync products screen" src=".github/images/screenshot.png">
</div>

A multi-tenant inventory platform where sales never oversell and every stock or price change is synced to an external advertising service in the background.

## Contents

- [Quickstart](#quickstart)
- [Tests](#tests)
- [Requirements map](#requirements-map)
- [Tech choices](#tech-choices)
- [Architecture](#architecture)
- [Key decisions and trade-offs](#key-decisions-and-trade-offs)
- [API documentation](#api-documentation)
- [Known limitations and what I would do with more time](#known-limitations-and-what-i-would-do-with-more-time)
- [AI usage and validation](#ai-usage-and-validation)

## Quickstart

**Prerequisites:** Node 24 (see `.nvmrc`), pnpm 10 (`corepack enable`) and Docker. Docker Compose runs only PostgreSQL, the one infrastructure service; the apps run with pnpm.

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Create the three `.env` files with the required variables (every other variable has a default, see [the full reference](#environment-variables)):

   ```bash
   # apps/backend/.env
   PORT=3333
   DATABASE_URL=postgres://stocksync:stocksync@localhost:5432/stocksync
   JWT_SECRET=<at least 32 characters, e.g. the output of `openssl rand -hex 32`>
   CORS_ORIGIN=http://localhost:5173
   ADS_API_URL=http://localhost:4000
   ADS_API_KEY=local-ads-key
   ```

   ```bash
   # apps/ads-mock/.env
   API_KEY=local-ads-key
   ```

   ```bash
   # apps/frontend/.env
   VITE_API_URL=http://localhost:3333/api/v1
   ```

   The mock's `API_KEY` must be equal to the backend's `ADS_API_KEY`.

3. Start PostgreSQL, run the migrations and seed two tenants:

   ```bash
   pnpm db:up && pnpm db:migrate && pnpm db:seed
   ```

4. Start the API, the ads mock and the frontend:

   ```bash
   pnpm dev
   ```

5. In a second terminal, start the sync worker:

   ```bash
   pnpm dev:worker
   ```

   The worker is a separate process on purpose: it shares the backend code but runs independently of the API, and the two only talk through the database (see [Architecture](#architecture)).

| What | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:3333/api/v1 |
| API reference | http://localhost:3333/docs |
| Health | http://localhost:3333/health |
| Ads mock | http://localhost:4000 |

### Seeded users

| Tenant | Role | Email | Password |
|---|---|---|---|
| Acme | admin | `admin@acme.test` | `acme-admin-password` |
| Acme | operator | `operator@acme.test` | `acme-operator-password` |
| Globex | admin | `admin@globex.test` | `globex-admin-password` |
| Globex | operator | `operator@globex.test` | `globex-operator-password` |

Each tenant has two products, one of them out of stock. The SKU `CAM-P` exists in both tenants on purpose, to show that SKUs are unique per tenant and that tenants never see each other's data.

### Environment variables

<details>
<summary>Full reference</summary>

**`apps/backend`** (API and worker)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | required | API port |
| `DATABASE_URL` | required | PostgreSQL connection string; tests derive `stocksync_test` from it |
| `JWT_SECRET` | required | HS256 signing key, at least 32 characters |
| `CORS_ORIGIN` | required | Origin allowed to call the API with credentials (the frontend) |
| `ADS_API_URL` | required | Base URL of the ads service |
| `ADS_API_KEY` | required | Key sent as `X-Api-Key` to the ads service |
| `NODE_ENV` | `development` | `production` turns on the `Secure` cookie flag and hides the seeded users from the docs |
| `LOG_LEVEL` | `info` | pino log level |
| `SYNC_BATCH_SIZE` | `50` | Maximum events per batch (1 to 100) |
| `SYNC_RATE_LIMIT_PER_SECOND` | `5` | Requests per second the worker sends to the ads service |
| `SYNC_REQUEST_TIMEOUT_MS` | `3000` | Timeout of each request to the ads service |
| `SYNC_MAX_ATTEMPTS` | `5` | Attempts before an event becomes `failed` |
| `SYNC_BACKOFF_BASE_MS` | `1000` | Base delay of the exponential backoff |
| `SYNC_BACKOFF_MAX_MS` | `60000` | Maximum backoff delay |
| `SYNC_POLL_INTERVAL_MS` | `1000` | Worker wait when no event is due |

**`apps/ads-mock`**

| Variable | Default | Purpose |
|---|---|---|
| `API_KEY` | required | Expected `X-Api-Key`; must equal the backend's `ADS_API_KEY` |
| `PORT` | `4000` | Mock port |
| `FAILURE_RATE` | `0.2` | Probability that a request fails (error, timeout, or applied and then failed) |
| `RATE_LIMIT_PER_SECOND` | `5` | Requests per second before answering 429 |
| `TIMEOUT_DELAY_MS` | `5000` | How long a simulated timeout holds the request |
| `NODE_ENV` | `development` | Environment name |
| `LOG_LEVEL` | `info` | pino log level |

**`apps/frontend`**

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | required | API base URL including `/api/v1` |

</details>

## Tests

```bash
pnpm test                          # every app
pnpm --filter stocksync-api test   # one app: stocksync-api, ads-mock or frontend
```

The backend tests run against a real PostgreSQL database, `stocksync_test`, in the same container. It is created and migrated automatically from `DATABASE_URL`, and the tables are truncated between tests, so `pnpm db:up` is the only prerequisite. The frontend uses Vitest, Testing Library and MSW; the ads mock has its own tests.

CI runs lint, typecheck and the tests on every pull request and on every push to `main`.

The four tests the assessment asks for:

| Requirement | Test |
|---|---|
| Concurrent sales cannot oversell | `sales.test.ts`: "sells exactly the available stock under 10 parallel sales" (plus "does not deadlock sales of A+B and B+A running in parallel") |
| Tenant isolation | `products.test.ts`: "never returns products of another tenant" (more in the auth, stock movement and sync status tests) |
| Idempotency | `sales.test.ts`: "replays the original sale for the same key and items" (plus "creates one sale when the same key is sent in parallel") |
| Retry of the sync | `sync.worker.test.ts`: "ends sent with attempts = 2 after two failures and a success" (plus "follows min(max, base × 2^(attempts−1)) × random and ends failed at the maximum") |

## Requirements map

Every required item and all four bonus items are implemented.

**Part A: Core API**

| Requirement | Where |
|---|---|
| Login returns a token | `POST /auth/login`, JWT in an `httpOnly` cookie |
| Every user belongs to one tenant and never sees another's data | Tenant taken only from the token, every query filtered by `tenant_id`, composite foreign keys |
| Roles admin and operator | Product writes and stock adjustments require admin; both roles read products and register sales |
| Seed with two tenants and both roles | `pnpm db:seed` (Acme and Globex) |
| Products CRUD with SKU unique per tenant | `GET/POST /products`, `GET/PATCH/DELETE /products/:id` |
| Pagination and a filter | `?page`, `?limit`, `?search` (name or SKU) and `?outOfStock` |
| `POST /sales` with one or more items | `POST /sales` |
| Stock never negative under concurrency | Ordered `FOR UPDATE` locks on every product of the sale |
| All-or-nothing | One transaction; a 409 lists every item without enough stock |
| Idempotency key | `Idempotency-Key` header; a retry replays the original sale |
| Stock movement history exposed | `GET /products/:id/stock-movements` (who, when, why, quantity) |
| Validated input and consistent errors | Zod schemas; every error is `{ error: { code, message } }` |
| No internal details leaked | Unexpected errors become a generic 500 and are logged server side |

**Part B: Asynchronous sync**

| Requirement | Where |
|---|---|
| Mock accepts batches of `sku`, `stock`, `price` | `apps/ads-mock`, `POST /updates` |
| Mock allows at most 5 requests per second | 429 with `Retry-After` |
| Mock fails about 20% of the time | Errors, timeouts, and updates applied and then failed (`FAILURE_RATE`) |
| Mock sometimes receives the same update twice | Applied-then-failed requests are retried; the mock ignores versions it already has |
| Changes published for async processing | `sync_events` outbox written in the same transaction as the change |
| Batches respecting the rate limit | Worker token bucket, `SYNC_BATCH_SIZE` events per batch |
| Retry with backoff, then failed | Exponential backoff with jitter, `failed` after `SYNC_MAX_ATTEMPTS` |
| Safe against duplicates and out-of-order delivery | Global `version` per event; older events are `superseded` and the mock ignores older versions |
| Sync status per tenant | `GET /sync/status` (pending, sent, failed, superseded, last successful sync, recent failures) |
| Tenant isolation in background jobs | Every batch belongs to a single tenant |

**Part C: Frontend**

| Requirement | Where |
|---|---|
| Login | `/login` |
| Product list with loading, empty and error states | `/products` |
| Sale form with clear insufficient-stock feedback | `/sales/new` |
| Sync status page with polling | `/sync`, refreshed every 5 seconds |

**Part D: Quality**

| Requirement | Where |
|---|---|
| The four required tests | See [Tests](#tests) |
| README | This file |

**Bonus**

| Item | Where |
|---|---|
| Structured logging with a request ID | pino in the API, worker and mock; `X-Request-Id` accepted or generated and echoed |
| Health endpoint | `GET /health` (server, database, sync queue size, oldest pending event, last sync) and a `/health` page in the frontend |
| OpenAPI documentation | `/docs` and `/openapi.json` |
| CI with lint and tests | `.github/workflows/ci.yml` |

## Tech choices

**Backend: Express 5** (instead of NestJS). No dependency injection container or decorators: modules import what they use, so the route → service → SQL path stays explicit, and the few dependencies worth swapping (the worker's ads client, clock and random source) are passed as parameters. Express 5 handles errors thrown by async routes natively. *Trade-off:* the layers are kept by convention, not enforced by the framework.

**Frontend: React with Vite, as a single-page app** (instead of Angular). TanStack Query manages server state and the sync status polling, TanStack Router gives typed routes and search params (the product filters live in the URL), and Tailwind with shadcn/ui provides accessible components on top of Radix. *Trade-off:* no server-side rendering, which an internal tool does not need.

**Database: PostgreSQL 18** (instead of MySQL). Row locks with `FOR UPDATE` and `SKIP LOCKED`, partial unique indexes (required by soft delete, so a deleted SKU can be reused), CHECK constraints, identity sequences, native `uuidv7()` and `timestamptz`. *Trade-off:* MySQL 8 also has `SKIP LOCKED`; partial indexes are what tipped the choice.

**Queue: a transactional outbox in PostgreSQL, consumed by a worker with `SKIP LOCKED`** (instead of BullMQ on Redis or RabbitMQ). The sync event is written in the same transaction as the stock or price change, so there is no dual write: a committed sale can never lose its message, and a rolled-back sale can never send one. It needs no extra infrastructure, and the queue is plain SQL, so the sync status is a `GROUP BY`. *Trade-offs:* the worker polls (up to one second of latency when idle), the queue adds load to the main database at high volume, and the worker keeps a transaction open during the call to the ads service, which limits how many workers can run. At scale, the outbox would feed a broker (through a relay or change data capture) instead of being polled.

**Supporting tools**

| Tool | Why |
|---|---|
| Drizzle | Typed SQL that stays close to the queries, with explicit `FOR UPDATE` and plain SQL migrations |
| Zod | Request validation, the OpenAPI document generated from the same schemas, and environment validation |
| jose and bcryptjs | JWT signing and password hashing without native dependencies |
| pino | Structured JSON logs |
| Vitest and Supertest | Fast tests over HTTP against a real database |
| Biome | Lint and formatting in one tool |
| pnpm and Turborepo | Monorepo with three apps and one command per task |

## Architecture

```mermaid
flowchart LR
  browser["Browser<br/>React SPA"] -->|"HTTPS, httpOnly cookie"| api["API<br/>Express"]
  api -->|"one transaction per change:<br/>data + sync_events"| db[("PostgreSQL")]
  worker["Sync worker"] -->|"claim with SKIP LOCKED,<br/>record outcome"| db
  worker -->|"POST /updates<br/>batches, max 5 req/s"| ads["Ads service<br/>(mock)"]
```

The API and the worker are separate processes built from the same backend code. They never call each other: the API writes sync events to the outbox, and the worker reads them.

**Backend layers**

- `http/`: Express controllers, Zod validation schemas and middlewares (auth, roles, logging, errors).
- `modules/<feature>/`: services with the business rules and transactions, repositories with the Drizzle queries, and the feature's tests. Every repository query is filtered by `tenant_id`.
- `infra/`: database connection, schemas, migrations, seed, error classes, environment and logger.

```text
apps/
  backend/    API and sync worker (src/http, src/modules, src/infra)
  ads-mock/   mock of the advertising service
  frontend/   React SPA (src/routes, src/components, src/api)
.specs/       spec-driven artifacts and the decision log
```

## Key decisions and trade-offs

### Tenancy and auth

**Shared database, tenant from the token.** Every tenant-owned table has `tenant_id`, the tenant comes only from the JWT (never from the body, query or headers), and every repository query filters by it. Composite foreign keys on `(tenant_id, id)` make a cross-tenant reference impossible in the database itself, so a sale item cannot point to another tenant's product even through a bug. A resource of another tenant answers 404, so its existence is not revealed. *Trade-off:* without row-level security, a forgotten filter in a new query is not caught by the database; the isolation tests cover every resource, and RLS is the next layer of defense.

**JWT in an `httpOnly` cookie.** A one-hour HS256 token in an `httpOnly`, `SameSite=Lax` cookie, so JavaScript, and therefore an XSS payload, can never read it. *Trade-off:* there is no refresh token and no revocation, so a removed user's token stays valid until it expires and every user logs in again after an hour.

### Stock correctness

**One path changes stock, under ordered locks.** Sales and manual adjustments both go through one function. It locks every product involved in a single `SELECT … ORDER BY id FOR UPDATE`, so two sales of A+B and B+A always lock in the same order and cannot deadlock. It checks every item before writing anything, and a `CHECK (stock >= 0)` constraint is the last line of defense. *Trade-off:* sales of the same product run one after another; a conditional `UPDATE … WHERE stock >= quantity` would avoid the explicit lock but cannot report every short item at once.

**All-or-nothing with a complete answer.** When stock is insufficient, the 409 lists every short item with the available and requested quantities, not just the first one, so the user can fix the whole sale in one go.

**An append-only ledger.** `stock_movements` is never updated or deleted. Each movement records direction, source (initial, adjustment or sale), quantity, the stock after it, the user and the time, so the sum of the movements always equals the product's stock. A wrong adjustment is corrected with an opposite one. Beyond the brief, admins can adjust stock through `POST /products/:id/stock-adjustments`, with a required reason.

### Idempotency

**The sale is written first, and the unique index is the lock.** The transaction starts by inserting the sale with its `Idempotency-Key` under a unique `(tenant_id, idempotency_key)` index. A concurrent request with the same key waits on that index; if the first one commits, the second gets a unique violation and replays the stored sale (201 with `Idempotent-Replayed: true`). A SHA-256 hash of the items, order-insensitive, detects a key reused with a different body and answers 409. *Trade-offs:* only successful sales keep their key, so a retry after an insufficient-stock 409 runs again (and can succeed if stock was replenished); and a duplicate request waits for the first one to finish. An advisory lock with a lookup before the insert gives the same guarantee with more code; a generic table that stores every response, errors included, needs a separate transaction, a "processing" state and a cleanup job.

### Sync

**Ordering and duplicates by version.** Every sync event takes its `version` from one table-wide identity sequence, assigned after the product row is locked, so a later change to a product always has a greater version. The worker sends only the newest event per product and marks the older ones `superseded`; the mock ignores any version less than or equal to the one it has. Duplicates and late deliveries are therefore harmless. *Trade-off:* a per-product counter was rejected because it breaks when a SKU is deleted and recreated.

**Worker loop.** Each tick takes a rate-limit token before opening a transaction, picks the tenant with the oldest due event, claims up to `SYNC_BATCH_SIZE` of its events with `SKIP LOCKED`, sends them as one single-tenant batch and records the outcome in the same transaction. If the worker crashes mid-call, the transaction rolls back and the events are immediately due again. *Trade-off:* holding a transaction during an external call does not scale to many workers; a lease on `next_attempt_at` would remove that limit.

**Retry with backoff.** A failed batch is retried with full-jitter exponential backoff (1 s × 2^(attempts − 1), capped at 60 s), and its events become `failed` after 5 attempts. A 429 does not count as an attempt and is rescheduled by `Retry-After`. *Trade-offs:* the whole batch is retried together, because the mock has no per-item errors; and a `failed` event has no requeue action yet.

### API conventions

- Every error has the shape `{ error: { code, message } }`; anything unexpected becomes a generic 500 and is logged with its stack, never sent to the client.
- Money is stored as integer cents; no floating point.
- SKUs are stored uppercase and cannot change, because the ads service identifies products by SKU.
- Deletes are soft deletes, and unique constraints are partial indexes over the active rows.
- Business routes live under `/api/v1`, and the OpenAPI document is generated from the same Zod schemas that validate the requests.
- Beyond the brief, the frontend has a public `/health` page that shows the server, database and sync queue.

The full decision log, with every decision and the reason behind it, is in [`.specs/STATE.md`](.specs/STATE.md).

## API documentation

- http://localhost:3333/docs is an interactive API reference, and http://localhost:3333/openapi.json is the OpenAPI 3.1 document.
- Business routes are served under `/api/v1`; `/health`, `/docs` and `/openapi.json` stay at the root.
- The document is generated from the same Zod schemas the controllers validate with, and a test compares the mounted routes with the documented ones, so the documentation cannot drift from the API.

## Known limitations and what I would do with more time

**Sync**

- The rate-limit token bucket lives in the worker's memory, so two workers would together exceed 5 requests per second: move the bucket to PostgreSQL or Redis.
- The worker holds a transaction open during the call to the ads service: replace it with a lease on `next_attempt_at` to run many workers.
- `failed` events are never retried: a scheduled job that requeues them after a cool-down, a few rounds at most, plus an alert so a permanent failure does not stay hidden.

**Security**

- No row-level security: add PostgreSQL RLS as a second layer of tenant isolation.
- No refresh token and no revocation: short-lived access tokens with rotating refresh tokens.

## AI usage and validation

I led the project and made every decision; the code was written by AI (Claude Code).

**How it was used**

- **Design before code.** Each part started with a design discussion before any code was written. I made the decisions, and several of them went against the AI's suggestions (for example the error format, handling the idempotency conflict instead of taking an advisory lock, and calling the API through an axios client configured by an environment variable instead of a dev-server proxy).
- **Spec-driven implementation.** The agreed decisions became a spec, a design and atomic tasks for each feature, recorded in [`.specs/`](.specs/) together with the decision log, and each feature was delivered as a small pull request.
- **Frontend design.** Visual directions were compared as real screens before choosing the category-standard look; the design system is recorded in `apps/frontend/DESIGN.md`.

**How the output was validated**

- I reviewed every pull request before merging it.
- CI runs lint, typecheck and every test on each pull request and on `main`.
- The backend tests run against a real PostgreSQL database, including the concurrency and idempotency tests, which run requests in parallel.
- Each feature was checked against its spec by an independent verifier (the agent that verifies is not the one that wrote the code), and every requirement needed evidence from a test. The verifier also broke the code on purpose to confirm the tests catch it; the reports are in `.specs/features/*/validation.md`.
