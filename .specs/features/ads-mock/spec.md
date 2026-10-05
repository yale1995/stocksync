# Ads Mock Specification

## Problem Statement

Part B syncs stock and price to an external advertising service that is rate limited, fails sometimes and sometimes receives the same update twice. The assessment asks for a mock of that service. It is a separate workspace app, `apps/ads-mock`, that simulates another company's API: in-memory state, its own env, no code or database shared with the backend, and deterministic tests through injected randomness and time.

## Goals

- [ ] The mock applies only newer versions per `(tenantId, sku)`, making duplicates and out-of-order deliveries harmless
- [ ] It enforces an API key and a global rate limit, and fails at a configurable rate in three realistic ways
- [ ] Its behavior is fully testable without real randomness or waiting

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| The worker and its `AdsClient` | Feature `sync-worker` |
| Persistence across restarts | The mock keeps state in memory by design |
| Running in compose | Later, separate decision |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/05-sync.md` | Applied as written | Agreed with the user | y |
| Scope of rate limit and failure injection | `POST /updates` only; `GET /ads` only requires the API key | `GET /ads` is an inspection endpoint for the demo; random failures there would only hide the state | y (asked the user) |
| Timeout mode outcome | Holds for `TIMEOUT_DELAY_MS`, then answers 500 without applying | The worker has aborted by then; applying would duplicate the "apply then 500" mode | y (asked the user) |
| Picking a failure mode | One `random()` decides failure (`< FAILURE_RATE`), a second picks the mode in thirds | Simple to inject in tests | y (plan approved) |
| Rate limit algorithm | Sliding 1 s window over accepted requests; `Retry-After` is the seconds until the oldest leaves the window, rounded up | Exact "at most N per second" | y (plan approved) |
| Invalid body vs rate limit | A well-formed body that fails the schema (400) consumes a rate-limit slot; malformed JSON, 401 and 429 do not | Every authenticated, parseable request counts, as in real APIs | y (asked the user) |
| Error body | `{ error: "<message>" }` | The mock is another company's API, not ours | y (plan approved) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Apply updates ⭐ MVP

**Acceptance Criteria**:

1. ADS-01: WHEN `POST /updates` receives a valid batch THEN the mock SHALL apply each item whose `version` is greater than the stored version for `(tenantId, sku)`, ignore the others, and respond 200 `{ applied, ignored }`
2. ADS-02: WHEN an item has a version equal to or lower than the stored one THEN the mock SHALL ignore it and keep the stored state
3. ADS-03: WHEN two tenants send the same SKU THEN the mock SHALL store them independently
4. ADS-04: IF the body is not `{ tenantId: uuid, items: [{ sku, stock, priceCents, version }] }` with 1–100 items, non-empty `sku`, non-negative integer `stock` and `priceCents`, and positive integer `version`, or is not valid JSON THEN the mock SHALL respond 400
5. ADS-05: WHEN `GET /ads?tenantId=` is called THEN the mock SHALL respond 200 with that tenant's ads (`sku`, `stock`, `priceCents`, `version`, `updatedAt`) ordered by `sku`, and 400 if `tenantId` is not a uuid

### P1: Access control and rate limit ⭐ MVP

**Acceptance Criteria**:

1. ADS-06: IF the `X-Api-Key` header is missing or differs from `API_KEY` THEN the mock SHALL respond 401 on every route
2. ADS-07: WHEN more than `RATE_LIMIT_PER_SECOND` requests to `POST /updates` arrive within one second, across all tenants THEN the mock SHALL respond 429 with a `Retry-After` header in whole seconds and apply nothing
3. ADS-08: WHEN the window has passed THEN the mock SHALL accept requests again

### P1: Failures ⭐ MVP

**Acceptance Criteria**:

1. ADS-09: WHEN a request is selected to fail (probability `FAILURE_RATE`) THEN the mock SHALL fail in one of three modes chosen at random: immediate 500, a 500 held for `TIMEOUT_DELAY_MS`, or apply the batch and then respond 500
2. ADS-10: WHEN the mode is immediate 500 or held 500 THEN the mock SHALL apply nothing
3. ADS-11: WHEN the mode is apply-then-500 THEN the state SHALL reflect the batch
4. ADS-12: WHEN `FAILURE_RATE` is 0 THEN the mock SHALL never fail

### P1: Configuration ⭐ MVP

**Acceptance Criteria**:

1. ADS-13: The mock SHALL read `PORT` (4000), `API_KEY` (required), `FAILURE_RATE` (0.2, between 0 and 1), `RATE_LIMIT_PER_SECOND` (5) and `TIMEOUT_DELAY_MS` (5000) through a Zod schema and exit with a readable error when invalid
2. ADS-14: The app SHALL be built by `createApp({ apiKey, failureRate, rateLimitPerSecond, timeoutDelayMs, random, now })` so tests inject randomness and time

---

## Edge Cases

- WHEN one batch carries the same SKU twice THEN the items SHALL be applied in order, each against the state left by the previous one
- WHEN a 429 or 401 is returned THEN the request SHALL not count against the rate limit

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ADS-01 | P1: Apply updates | Execute | Implemented |
| ADS-02 | P1: Apply updates | Execute | Implemented |
| ADS-03 | P1: Apply updates | Execute | Implemented |
| ADS-04 | P1: Apply updates | Execute | Implemented |
| ADS-05 | P1: Apply updates | Execute | Implemented |
| ADS-06 | P1: Access control and rate limit | Execute | Implemented |
| ADS-07 | P1: Access control and rate limit | Execute | Implemented |
| ADS-08 | P1: Access control and rate limit | Execute | Implemented |
| ADS-09 | P1: Failures | Execute | Implemented |
| ADS-10 | P1: Failures | Execute | Implemented |
| ADS-11 | P1: Failures | Execute | Implemented |
| ADS-12 | P1: Failures | Execute | Implemented |
| ADS-13 | P1: Configuration | Execute | Implemented |
| ADS-14 | P1: Configuration | Execute | Implemented |

**Coverage:** 14 total, 14 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm --filter ads-mock test`, `pnpm typecheck` and `pnpm lint:check` pass
- [ ] Tests never wait on real randomness and only on short injected delays
