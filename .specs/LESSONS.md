# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

### L-001 - When a spec enumerates a set of variants, cover every variant with a table-driven test asserting each listed value
- signal: `ac_gap` · recurrence: 2 feature(s) · scope: `http` · harmful: 0
- features: errors, api-versioning
- evidence: ERR-02 / M5,M6 (http) (+1 more)
- last seen: 2026-10-05T21:27:51Z

### L-006 - Give every database CHECK constraint a raw-insert test asserting its constraint name, not only the ones a prompt lists
- signal: `surviving_mutant` · recurrence: 2 feature(s) · scope: `schema` · harmful: 0
- features: stock-movements, sales
- evidence: validation.md M21,M24,M25 (0002_parallel_forgotten_one.sql:14-18) (schema) (+1 more)
- last seen: 2026-10-05T04:18:30Z

### L-007 - Test composite tenant foreign keys with a raw insert that mixes tenants and assert the FK constraint name
- signal: `surviving_mutant` · recurrence: 2 feature(s) · scope: `schema` · harmful: 0
- features: stock-movements, sales
- evidence: validation.md M22,M26 (0002_parallel_forgotten_one.sql:22-23) (schema) (+1 more)
- last seen: 2026-10-05T04:18:30Z

### L-017 - Test each ORDER BY key with fixtures where that key and the next one disagree
- signal: `surviving_mutant` · recurrence: 2 feature(s) · scope: `worker` · harmful: 0
- features: sync-worker, sync-status
- evidence: validation.md R3,R4,R5 (sync.repository.ts:33) (worker) (+1 more)
- last seen: 2026-10-05T19:12:00Z

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-002 - Assert default values explicitly, not only caller-overridden ones
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `http` · harmful: 0
- features: errors
- evidence: M7 apps/backend/src/http/errors.ts:16 (http)
- last seen: 2026-10-04T02:57:57Z

### L-003 - Test shared middleware through the real app factory, not only a throwaway app
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `http` · harmful: 0
- features: errors
- evidence: M3 apps/backend/src/app.ts:11 (http)
- last seen: 2026-10-04T02:57:57Z

### L-004 - Test each query's soft-delete filter through its own route, not only through a predicate shared with another route
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: auth-tenancy
- evidence: M3b apps/backend/src/modules/auth/auth.repository.ts:39 (TEN-05) (repo-layer)
- last seen: 2026-10-04T03:22:20Z

### L-005 - Test that a validly signed token with out-of-range claims is rejected, not only bad signatures and expiry
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `http` · harmful: 0
- features: auth-tenancy
- evidence: M19 apps/backend/src/infra/jwt.ts:14 (http)
- last seen: 2026-10-04T03:22:20Z

### L-008 - Assert the full error body including the message whenever the spec fixes the message text
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: stock-movements
- evidence: MOV-05 stock-movements.test.ts:285 (routes)
- last seen: 2026-10-04T15:14:36Z

### L-009 - When two tenants share a client-supplied key, test the follow-up lookup by that key in each tenant, not only the creation
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: sales
- evidence: M13 apps/backend/src/modules/sales/sales.repository.ts:36 (SALE-25) (repo-layer)
- last seen: 2026-10-05T04:18:30Z

### L-010 - Assert the full ordered sequence produced by a concurrent run, not only its first element, so ordering mutants are killed deterministically
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `concurrency` · harmful: 0
- features: sales
- evidence: D1 0003_swift_justice.sql:25 (SALE-17, sales.test.ts:457) (concurrency)
- last seen: 2026-10-05T04:18:30Z

### L-011 - When a spec requires a FOR UPDATE read in several flows, give each flow its own lock-holding test (hold the row lock, change the row, then release) so swapping any one read for an unlocked one fails
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `concurrency` · harmful: 0
- features: sync-events
- evidence: M14 products.service.ts:104 (concurrency)
- last seen: 2026-10-05T15:51:13Z

### L-012 - When a spec names an index shape (columns or a partial WHERE), assert its definition from pg_indexes instead of relying on inspection
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `schema` · harmful: 0
- features: sync-events
- evidence: D8 0004_dashing_tiger_shark.sql:28 (schema)
- last seen: 2026-10-05T15:51:13Z

### L-013 - Assert every column default the spec lists on a freshly inserted row, including timestamp defaults such as now()
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `schema` · harmful: 0
- features: sync-events
- evidence: D12 0004_dashing_tiger_shark.sql:14 (schema)
- last seen: 2026-10-05T15:51:13Z

### L-014 - Give every integer field in a request schema a fractional-value rejection test, not only the first one
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: ads-mock
- evidence: validation.md M10, M13 (apps/ads-mock/src/app.ts:34-35) (validation)
- last seen: 2026-10-05T16:08:22Z

### L-015 - Export the env schema separately from the exiting parse so defaults and bounds can be unit tested
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `env` · harmful: 0
- features: ads-mock
- evidence: validation.md M49, M50 (apps/ads-mock/src/env.ts:4-6) (env)
- last seen: 2026-10-05T16:08:22Z

### L-016 - Test SKIP LOCKED claims by holding a row lock in a second transaction and asserting the tick skips those rows
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `worker` · harmful: 0
- features: sync-worker
- evidence: validation.md R1,R2 (sync.repository.ts:35,59) (worker)
- last seen: 2026-10-05T17:51:57Z

### L-018 - Test batch size limits with more due rows than the limit and assert which rows were claimed
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `worker` · harmful: 0
- features: sync-worker
- evidence: validation.md R8,R9 (sync.repository.ts:57-58) (worker)
- last seen: 2026-10-05T17:51:58Z

### L-019 - Assert side effects that run before an external call on the failure path too, where later success-path writes cannot mask them
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `worker` · harmful: 0
- features: sync-worker
- evidence: validation.md W3 (sync.worker.ts:91) (worker)
- last seen: 2026-10-05T17:51:58Z

### L-020 - When a spec says any 2xx is success, test at least one 2xx status other than 200
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `http-client` · harmful: 0
- features: sync-worker
- evidence: validation.md A9 (ads-client.ts:56) (http-client)
- last seen: 2026-10-05T17:51:58Z

### L-021 - When a spec requires work to happen outside a transaction, assert no transaction is open at that point
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `worker` · harmful: 0
- features: sync-worker
- evidence: validation.md W13 (sync.worker.ts:75-77) (worker)
- last seen: 2026-10-05T17:51:58Z

### L-022 - When a test checks output derived from a per-key lookup (by product, tenant), put several keys in the fixture so a lookup that ignores the key fails
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: sync-worker
- evidence: LW8/LW16 apps/backend/src/modules/sync/sync.worker.ts:101 (tests)
- last seen: 2026-10-05T18:59:16Z

### L-023 - Seed ordering tests so the spec's sort key runs against insertion, id and version order, or a query sorted by the wrong column passes
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: sync-status
- evidence: validation.md M18/M30/M31 (sync.repository.ts:214) (tests)
- last seen: 2026-10-05T19:11:54Z

### L-024 - For tenant-scoped routes, send another tenant's id in query, header and body and assert the token's tenant still wins
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: sync-status
- evidence: validation.md M25-M27 (sync.controller.ts:8) (routes)
- last seen: 2026-10-05T19:11:54Z

### L-025 - When a schema must reject unknown keys, unit test it with an extra key at every object level, since generated docs show additionalProperties false either way
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: api-docs
- evidence: validation.md M1-M5 (common.validation.ts:4, strictObject response schemas) (validation)
- last seen: 2026-10-05T20:23:05Z

### L-026 - Parse a real response for each nullable field in its null state, not only the populated case
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: api-docs
- evidence: validation.md M19,M22 (sync.validation.ts:13,21) (tests)
- last seen: 2026-10-05T20:23:05Z

### L-027 - When behavior depends on NODE_ENV or another env flag, test the wiring in each environment value through the app, not only the pure function it calls
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `env` · harmful: 0
- features: api-docs
- evidence: validation.md D1 (docs.controller.ts:7, DOCS-22) (env)
- last seen: 2026-10-05T20:35:59Z

### L-028 - When a regex asserts that a table cell has content, exclude the delimiter so an empty cell fails
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: api-docs
- evidence: validation.md D11,D23 (openapi-description.test.ts:86, DOCS-25) (tests)
- last seen: 2026-10-05T20:35:59Z

### L-029 - When a spec fixes a timeout, assert the literal bound (still pending 1 ms before, done at the bound) and hang each guarded call in its own test, not only the first, nor by advancing an imported constant
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `service` · harmful: 0
- features: health
- evidence: validation.md M12,M13 (health.service.ts:6,50,61) HLT-11 (service)
- last seen: 2026-10-06T16:59:25Z

### L-030 - When a spec names the source of a reported value, compare it to that source queried in the test, not only to a type or range
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: health
- evidence: validation.md M8-M11 (health.repository.ts:14-19, health.service.ts:51) HLT-04 (repo-layer)
- last seen: 2026-10-06T16:59:25Z

### L-031 - When a spec requires logging the cause of a failure, assert the logged arguments include the error, not only that the logger was called
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `service` · harmful: 0
- features: health
- evidence: validation.md M18 (health.service.ts:67) HLT-12 (service)
- last seen: 2026-10-06T16:59:25Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
