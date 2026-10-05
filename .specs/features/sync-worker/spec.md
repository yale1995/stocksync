# Sync Worker Specification

## Problem Statement

`sync_events` (feature `sync-events`) accumulates `pending` events. Part B requires sending them to the ads service in batches that respect its rate limit, retrying failures with backoff, moving events to `failed` after a maximum number of attempts, staying safe against duplicates and out-of-order delivery, and keeping tenant isolation in background jobs. This feature adds the worker: a separate process running backend code, with an `AdsClient` abstraction, a token bucket and a tick that claims, coalesces, sends and records the outcome in one transaction.

## Goals

- [ ] Pending events reach the ads service in single-tenant batches, at most 5 requests per second
- [ ] Failures are retried with exponential backoff and full jitter and end `failed` after `SYNC_MAX_ATTEMPTS`
- [ ] Only the newest state of each product is sent, and older events never overwrite it
- [ ] A crash mid-tick loses nothing

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `GET /sync/status` | Feature `sync-status` |
| Leases instead of a transaction held during the call | README trade-off |
| Distributed rate limiter, multiple workers | README trade-off |
| Running worker and mock in compose | Later, separate decision |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/05-sync.md` | Applied as written | Agreed with the user | y |
| Token bucket capacity | 1 token, refilled at `SYNC_RATE_LIMIT_PER_SECOND` per second (one request every 200 ms) | A bucket of 5 would allow 5 at once plus refills, up to 9 in one second, which the mock's sliding window rejects | y (asked the user) |
| Items order in a batch | Sorted by `version` | The service's version check already makes the final state independent of order; sorting keeps a deleted and recreated SKU in the order the changes happened, so the service reports both items applied | y (asked the user) |
| `Retry-After` parsing | Integer seconds; missing or invalid falls back to 1 s | The mock sends seconds; HTTP dates are not needed | y (plan approved) |
| Unexpected exception in a tick (not an `AdsResult`) | Propagates, the transaction rolls back, `run` logs it and waits one poll interval | Same as a crash: events stay due and untouched | y (prompt: crash rolls back) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Configuration and entry point ⭐ MVP

**Acceptance Criteria**:

1. WRK-01: The backend env SHALL require `ADS_API_URL` and `ADS_API_KEY` and default `SYNC_BATCH_SIZE` 50, `SYNC_RATE_LIMIT_PER_SECOND` 5, `SYNC_REQUEST_TIMEOUT_MS` 3000, `SYNC_MAX_ATTEMPTS` 5, `SYNC_BACKOFF_BASE_MS` 1000, `SYNC_BACKOFF_MAX_MS` 60000, `SYNC_POLL_INTERVAL_MS` 1000
2. WRK-02: The backend SHALL provide `src/worker.ts` with `worker` and `dev:worker` scripts that load the same `.env` as the API and stop on SIGINT/SIGTERM

### P1: AdsClient ⭐ MVP

**Acceptance Criteria**:

1. WRK-03: The HTTP `AdsClient` SHALL `POST {ADS_API_URL}/updates` with header `X-Api-Key` and body `{ tenantId, items: [{ sku, stock, priceCents, version }] }`
2. WRK-04: WHEN the response is 2xx THEN the client SHALL return ok; WHEN 429 THEN rate limited with `Retry-After` in milliseconds; WHEN any other status THEN error `HTTP <status>`
3. WRK-05: WHEN no response arrives within `SYNC_REQUEST_TIMEOUT_MS` THEN the client SHALL return error `timeout`; WHEN the connection fails THEN error `network error`

### P1: Tick ⭐ MVP

**Acceptance Criteria**:

1. WRK-06: The worker SHALL take a token from an in-memory token bucket before opening the transaction, so it sends at most `SYNC_RATE_LIMIT_PER_SECOND` requests in any second
2. WRK-07: The worker SHALL pick the tenant whose due pending event (`status = 'pending' AND next_attempt_at <= now`) is the oldest by `next_attempt_at, version`, and claim up to `SYNC_BATCH_SIZE` due pending events of that tenant ordered by `version` with `FOR UPDATE SKIP LOCKED`
3. WRK-08: WHEN no event is due THEN the tick SHALL send nothing and report that nothing was claimed
4. WRK-09: The worker SHALL keep only the highest-version event per product, mark the others `superseded`, and send one item per kept event, sorted by `version`
5. WRK-10: A batch SHALL contain events of a single tenant; events of two tenants SHALL be delivered in separate batches
6. WRK-11: WHEN the send succeeds THEN the kept events SHALL become `sent` with `sent_at`, and older `pending` or `failed` events of the same products SHALL become `superseded`
7. WRK-12: WHEN the service answers 429 THEN the kept events SHALL get `next_attempt_at = now + Retry-After` and `last_error = 'HTTP 429'`, without incrementing `attempts`
8. WRK-13: WHEN the send fails (5xx, timeout, network error) THEN each kept event SHALL get `attempts + 1` and `last_error`; IF `attempts` reaches `SYNC_MAX_ATTEMPTS` THEN it SHALL become `failed`; otherwise `next_attempt_at = now + min(BACKOFF_MAX, BACKOFF_BASE × 2^(attempts−1)) × random()`
9. WRK-14: IF the tick throws before committing THEN every claimed event SHALL stay `pending` and due, with unchanged `attempts`
10. WRK-15: The worker loop SHALL tick again immediately after claiming events and wait `SYNC_POLL_INTERVAL_MS` otherwise
11. WRK-16: The worker SHALL log each event by `SKU vVERSION`: superseded events with the version that replaced them; a sent batch with the service's `applied`/`ignored` counts when the response has them; each failed event with its error, `attempt N/MAX` and the retry delay, or `-> failed` at the maximum; and a rate-limited batch with its `Retry-After`

---

## Edge Cases

- WHEN two failures are followed by a success THEN the event SHALL end `sent` with `attempts = 2`
- WHEN a product is deleted and recreated with the same SKU and both events are in one batch THEN the item of the recreated product SHALL come last

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| WRK-01 | P1: Configuration and entry point | Execute | Implemented |
| WRK-02 | P1: Configuration and entry point | Execute | Implemented |
| WRK-03 | P1: AdsClient | Execute | Implemented |
| WRK-04 | P1: AdsClient | Execute | Implemented |
| WRK-05 | P1: AdsClient | Execute | Implemented |
| WRK-06 | P1: Tick | Execute | Implemented |
| WRK-07 | P1: Tick | Execute | Implemented |
| WRK-08 | P1: Tick | Execute | Implemented |
| WRK-09 | P1: Tick | Execute | Implemented |
| WRK-10 | P1: Tick | Execute | Implemented |
| WRK-11 | P1: Tick | Execute | Implemented |
| WRK-12 | P1: Tick | Execute | Implemented |
| WRK-13 | P1: Tick | Execute | Implemented |
| WRK-14 | P1: Tick | Execute | Implemented |
| WRK-15 | P1: Tick | Execute | Implemented |
| WRK-16 | P1: Tick | Execute | Implemented |

**Coverage:** 16 total, 16 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
- [ ] Worker and mock run together locally and the ads reflect the seeded products and later changes
