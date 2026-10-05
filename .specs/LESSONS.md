# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

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

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When a spec enumerates a set of variants, cover every variant with a table-driven test asserting each listed value
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `http` · harmful: 0
- features: errors
- evidence: ERR-02 / M5,M6 (http)
- last seen: 2026-10-04T02:57:57Z

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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
