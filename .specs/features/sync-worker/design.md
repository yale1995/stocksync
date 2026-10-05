# Sync Worker Design

**Spec**: `.specs/features/sync-worker/spec.md`

Builds on AD-016/AD-017 (outbox, version) and AD-019 (mock contract). Introduces AD-020 (worker tick).

## Components

| File | Responsibility |
| ---- | -------------- |
| `src/infra/env.ts`, `vitest.config.ts` | `ADS_*` and `SYNC_*` variables; test values |
| `src/modules/sync/ads-client.ts` | `AdsClient` interface, `AdsResult`, `createHttpAdsClient({ baseUrl, apiKey, timeoutMs })` using `fetch` + `AbortSignal.timeout` |
| `src/modules/sync/token-bucket.ts` | `createTokenBucket({ ratePerSecond, now, sleep })`, capacity 1 |
| `src/modules/sync/sync.repository.ts` | `pickDueTenant`, `claimDueEvents` (`FOR UPDATE SKIP LOCKED`), `markSuperseded`, `markSent`, `supersedeOlderEvents`, `rescheduleEvents`, `recordFailure` — all with `tenant_id` except the cross-tenant pick |
| `src/modules/sync/sync.worker.ts` | `createSyncWorker({ client, clock, random, sleep, config })` → `{ tick, run }`; pure helpers `coalesce` and `backoffMs` |
| `src/worker.ts` | Entry point: HTTP client, real clock, `Math.random`, abortable sleep, signal handling, `pool.end()` |

## Tick

```
token bucket take()                       -- outside the transaction
BEGIN
  tenant  = pickDueTenant(now)            -- SKIP LOCKED
  events  = claimDueEvents(tenant, now, batchSize)
  if none: COMMIT, return false
  kept, superseded = coalesce(events)     -- highest version per product
  markSuperseded(superseded)
  result  = client.sendUpdates(tenant, kept sorted by version)
  ok      -> markSent(kept, now); supersedeOlderEvents(kept)
  429     -> rescheduleEvents(kept, now + retryAfter, 'HTTP 429')
  error   -> per event: attempts+1; failed at max, else now + backoff
COMMIT, return true
```

Every timestamp written by the worker comes from the injected clock, so tests control due times without sleeping.

## Testing

- `ads-client.test.ts`: the HTTP client against a local `node:http` server (2xx, 429 + `Retry-After`, 500, timeout, refused connection, request headers and body).
- `token-bucket.test.ts`: spacing and the "at most N in any second" property with a fake clock.
- `sync.worker.test.ts`: real database, fake `AdsClient`, fake clock, fixed `random`; every worker bullet of the prompt plus crash rollback and rate-limited ticks.
