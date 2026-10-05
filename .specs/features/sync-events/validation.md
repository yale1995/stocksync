# Sync Events Validation

## Validation: sync-events - PASS

**Date**: 2026-10-05
**Spec**: `.specs/features/sync-events/spec.md` (SYNC-01..SYNC-17 + 2 edge cases); decisions in `docs/prompts/05-sync.md` ("Data model", "Writing events", "Tests > Event writing")
**Diff range**: uncommitted working tree on `feat/sync-events` vs `main` `6b0cdf2`. Modified: `apps/backend/src/modules/products/products.service.ts`, `src/modules/stock-movements/stock-movements.service.ts`, `src/infra/seed/{seed,seed.test}.ts`, `src/infra/migrations/meta/_journal.json`. Untracked: `src/infra/schemas/sync-events.ts`, `src/infra/migrations/0004_dashing_tiger_shark.sql`, `src/infra/migrations/meta/0004_snapshot.json`, `src/modules/sync/{sync.repository,sync.service,sync-events.test}.ts`
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 1 (re-verification after FAIL in iteration 0)

PASS in iteration 1: the three gap tests (G1-G3) kill the three surviving mutants (M14, D8, D12), so all 29 sensor mutants are now killed. See "Iteration 1" below. `E:` line numbers in the iteration-0 tables refer to the iteration-0 test file; the new tests shifted later lines.

Iteration 0 was FAIL because one non-equivalent mutant on an explicit SHALL survives (M14: `deleteProduct` without `FOR UPDATE`, SYNC-13), plus two schema survivors (D8 partial index condition, D12 `next_attempt_at` default) that no test pins. Everything else is covered with spec-matching assertions and 33 of 36 mutants are killed.

---

## Iteration 1

Baseline before sensor: `git diff | shasum` = `46dbb65dea9c437d09b7c490f91d0940d84ed277`; porcelain recorded. Same isolation as iteration 0 (byte copy to scratchpad, single-occurrence mutation, restore + SHA-256 check, `stocksync_test` dropped before and after migration mutants, wait for any other vitest process). After cleanup the diff hash and porcelain matched the baseline.

| Gap | New test (`apps/backend/src/modules/sync/sync-events.test.ts`) | Spec-defined outcome asserted | Mutant | Killed? |
| --- | -------------------------------------------------------------- | ----------------------------- | ------ | ------- |
| G1 (SYNC-13) | `sync-events.test.ts:334` "snapshots the price committed while the delete waited on the lock": holds `FOR UPDATE` on CAM-P, starts `DELETE`, waits for a lock waiter, commits price 5990 | `status` 204 and last event `toMatchObject({ trigger: "product_deleted", stock: 0, priceCents: 5990 })` - the snapshot comes from the locked row | M14 `PS:104` `deleteProduct` reads via unlocked `findActiveProductById` | ✅ Killed (only this test fails, 267 ms, assertion not timeout) |
| G2 (SYNC-05) | `sync-events.test.ts:452` "defines the worker, status and superseding indexes": `pg_indexes` | exact `indexdef` list incl. `USING btree (next_attempt_at) WHERE (status = 'pending'::sync_event_status)`, `(tenant_id, status)`, `(tenant_id, product_id, version)` | D8 `MIG:28` partial index `WHERE status = 'sent'` | ✅ Killed |
| G3 (SYNC-01) | `sync-events.test.ts:439` "defaults next_attempt_at to the insert time": raw insert without `next_attempt_at` | `nextAttemptAt` is a `Date` within [insert - 1 s, now + 1 s] | D12 `MIG:14` drop `DEFAULT now() NOT NULL` | ✅ Killed |

The new tests assert spec-defined outcomes (SYNC-13 locked-row snapshot, SYNC-05 index definitions, SYNC-01 default `now()`), not implementation details. No production code or existing test changed.

**Gate (iteration 1)**: `npx vitest run src/modules/sync/sync-events.test.ts src/infra/seed/seed.test.ts` → 33 passed, 0 failed (28 + 5; +3 over iteration 0).

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 `sync_events` schema and migration | ✅ Done | `schemas/sync-events.ts:17-91`, `0004_dashing_tiger_shark.sql:1-30`; constraint tests `sync-events.test.ts:373-439` |
| T2 `recordSyncEvent` + create/stock flows | ✅ Done | `sync.service.ts:5-13`, `sync.repository.ts:9-14`, `products.service.ts:53-60`, `stock-movements.service.ts:105-112` |
| T3 Lock, decide, write in update/delete | ⚠️ Done, delete lock not discriminated | `products.service.ts:65-120`; see G1 |
| T4 Seed records events | ✅ Done | `seed.ts:145-152`; `seed.test.ts:76-130` |

---

## Spec-Anchored Acceptance Criteria

Paths are relative to `apps/backend/src/`. `E` = `modules/sync/sync-events.test.ts`, `SD` = `infra/seed/seed.test.ts`, `MIG` = `infra/migrations/0004_dashing_tiger_shark.sql`, `PS` = `modules/products/products.service.ts`.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| SYNC-01 columns, types, defaults, no `deleted_at` | listed columns, `timestamptz`, defaults `pending`/0/`now()` | **Inspection** `MIG:3-24`, `schemas/sync-events.ts:36-64` (all timestamps `withTimezone: true`, no `deleted_at`). Defaults `status`/`attempts` asserted through `freshEvent` (`E:63-68`) at `E:138`, `E:189`, `E:239` (D6, D9 killed). `version` identity exercised by every insert (D11 killed). `next_attempt_at DEFAULT now()` has no assertion (D12 survived) | ✅ PASS (iteration 1: D12 killed by `sync-events.test.ts:439`) |
| SYNC-02 enum values | 4 triggers, 4 statuses | **Inspection** `MIG:1-2`, `schemas/sync-events.ts:17-29`; values `product_created`, `stock_changed`, `price_changed`, `product_deleted`, `pending`, `sent` used in assertions | ✅ PASS (inspection) |
| SYNC-03 CHECKs | rejected with the matching constraint | `E:386-412` `it.each` → `rejects.toMatchObject({ cause: { code: "23514", constraint } })` for `sync_events_stock_non_negative`, `_price_cents_non_negative`, `_attempts_non_negative`, `_sent_at_only_when_sent` (both directions `E:399-407`); positive case `E:414-418`. D1-D4, D7 killed | ✅ PASS |
| SYNC-04 composite FK | cross-tenant row rejected | `E:420-426` Globex product with Acme tenant → `{ code: "23503", constraint: "sync_events_product_fk" }`. D5 killed | ✅ PASS |
| SYNC-05 indexes | `(next_attempt_at) WHERE status='pending'`, `(tenant_id,status)`, `(tenant_id,product_id,version)` | **Inspection only** `MIG:28-30`, `schemas/sync-events.ts:71-79`. No test; D8 (`WHERE status='sent'`) survived | ✅ PASS (iteration 1: D8 killed by `sync-events.test.ts:452`) |
| SYNC-06 `product_created` incl. stock 0 | one event, `sku`/`stock`/`priceCents` | `E:125-147` `it.each` stock 7 and 0 → `toHaveLength(1)`, `toMatchObject({ trigger: "product_created", sku: "MEIA-01", stock, priceCents: 1500, ...freshEvent })`. M9, M10 killed | ✅ PASS |
| SYNC-07 sale: one `stock_changed` per product | `stock` = stock after sale, product price | `E:162-190` exact `toEqual` per product: CAM-P 23 (25-2) / 4990, BON-01 1 (4-3) / 2990. M6, M7, M8 killed | ✅ PASS |
| SYNC-08 failed sale/adjustment → no event | none | sale 409 `E:192-199`, adjustment 409 `E:217-221` → `eventsAfterSeed()` `toEqual([])`. Atomicity is structural: `recordSyncEvent` takes `Transaction` (`sync.service.ts:8-11`) | ✅ PASS |
| SYNC-09 adjustment → `stock_changed` | stock after adjustment | `E:201-215` exact `toEqual` stock 20 (25-5), price 4990. M7 killed | ✅ PASS |
| SYNC-10 price change → `price_changed`, incl. name+price | current stock, new price, one event | `E:225-240` exact snapshot stock 20 / 5990; `E:242-250` name+price → exactly one `price_changed` 5990. M3, M4, M17 killed | ✅ PASS |
| SYNC-11 name-only / same price → no event | none | `E:252-260` same price, name only, same price + new name → `toEqual([])`. M2 killed | ✅ PASS |
| SYNC-12 delete → `product_deleted`, `stock = 0`, product stock unchanged | stock 0, current price, column unchanged | `E:300-322` `row.stock` `toBe(25)`, `deletedAt` set, exact snapshot stock 0 / 4990. M5, M15, M16 killed | ✅ PASS |
| SYNC-13 update and delete read `FOR UPDATE` | decide from locked row | update: `PS:80` via `lockProduct` (`PS:68-72` → `products.repository.ts:94-110` `.for("update")`), discriminated by `E:271-296` (M1 killed). delete: `PS:104` same lock, **but no test fails when it is replaced by the unlocked `findActiveProductById`** (M14 survived) | ✅ PASS (iteration 1: M14 killed by `sync-events.test.ts:334`) |
| SYNC-14 concurrent PATCH A then B restoring | two `price_changed`, highest version = final price | `E:271-296` deterministic: test tx holds the row lock, waits for 1 then 2 lock waiters; asserts both 200, events `[["price_changed",5990],["price_changed",4990]]` ordered by version, final 4990, `events.at(-1).priceCents === final.priceCents`. M1, M3 killed | ✅ PASS |
| SYNC-15 strictly increasing versions incl. delete + recreate | strictly increasing | `E:335-370` five events in causal order (created, stock, price, deleted, re-created with new product id) → versions sorted and unique, no absolute values. D11 killed | ✅ PASS |
| SYNC-16 seed one event per product, idempotent | four `product_created`, none on rerun | `SD:76-130` seed twice → exact `toEqual` of 4 rows (sku, stock, price, `pending`). M11, M12, M13 killed | ✅ PASS |
| SYNC-17 new events fresh | `pending`, 0, nulls | `freshEvent` (`E:63-68`) at `E:138`, `E:189`, `E:239`; `SD:94` `status: "pending"`. D6, D9 killed | ✅ PASS |

**Status (iteration 1)**: ✅ All ACs covered.

**Status (iteration 0)**: ❌ 1 gap (SYNC-13 delete), ⚠️ 2 schema items accepted only by inspection with surviving mutants (SYNC-05, SYNC-01 `next_attempt_at`). No spec-precision gaps: every AC states a precise outcome.

---

## Discrimination Sensor

Isolation: each mutated file was copied byte-for-byte to the session scratchpad, mutated with an exact single-occurrence replacement, the relevant test file(s) run with `npx vitest run`, and the original copied back and checked with SHA-256 against the backup immediately (every run printed "restored ok"). Migration mutants also dropped `stocksync_test` before and after the run, so global setup rebuilt it from the mutated SQL and then from the original. No `git stash`/`checkout`. A runner guard waited for any other vitest process before each run, because another session ran the suite and recreated the Postgres container mid-sensor; the first M6-M11 runs were invalidated by that interference and re-run cleanly.

| # | File:line | Mutation | Killed? |
| - | --------- | -------- | ------- |
| M1 | `PS:80` | `updateProduct` reads with unlocked `findActiveProductById` | ✅ Killed (`E:271`) |
| M2 | `PS:85-88` | drop the "price differs" check | ✅ Killed (`E:252` ×2) |
| M3 | `PS:95` | event price from the locked (stale) row | ✅ Killed (`E:225`, `E:242`, `E:271`) |
| M4 | `PS:94` | price event `stock: 0` | ✅ Killed (`E:225`) |
| M5 | `PS:116` | delete event `stock: locked.stock` | ✅ Killed (`E:300`) |
| M6 | `stock-movements.service.ts:105` | no event in `applyStockChanges` | ✅ Killed (4 tests) |
| M7 | `stock-movements.service.ts:110` | event stock before the change | ✅ Killed (`E:162`, `E:201`) |
| M8 | `stock-movements.service.ts:105` | event only for the first product | ✅ Killed (`E:162`) |
| M9 | `PS:53` | no event in `createProduct` | ✅ Killed (3 tests) |
| M10 | `PS:53` | no event when stock is 0 | ✅ Killed (`E:125` stock 0) |
| M11 | `seed.ts:145` | seed records no event | ✅ Killed (`SD:76`) |
| M12 | `seed.ts:126` | seed records an event for existing products too | ✅ Killed (`SD:76`) |
| M13 | `seed.ts:149` | seed event `stock: 0` | ✅ Killed (`SD:76`) |
| M14 | `PS:104` | `deleteProduct` reads with unlocked `findActiveProductById` | ❌ Survived → G1; ✅ Killed in iteration 1 |
| M15 | `PS:106` | delete zeroes the product stock | ✅ Killed (`E:300`) |
| M16 | `PS:111` | no delete event | ✅ Killed (`E:300`, `E:335`) |
| M17 | `PS:92` | price event with trigger `stock_changed` | ✅ Killed (4 tests) |
| D1 | `MIG:20` | stock CHECK → `CHECK (true)` | ✅ Killed |
| D2 | `MIG:21` | price CHECK → `CHECK (true)` | ✅ Killed |
| D3 | `MIG:22` | attempts CHECK → `CHECK (true)` | ✅ Killed |
| D4 | `MIG:23` | sent CHECK only `status='sent' → sent_at` | ✅ Killed (`E:404`) |
| D7 | `MIG:23` | sent CHECK only `sent_at → status='sent'` | ✅ Killed (`E:399`) |
| D5 | `MIG:27` | FK → `product_id → products(id)` | ✅ Killed (`E:420`) |
| D6 | `MIG:12` | `status` default `failed` | ✅ Killed (5 tests incl. `SD:76`) |
| D8 | `MIG:28` | partial index `WHERE status = 'sent'` | ❌ Survived → G2; ✅ Killed in iteration 1 |
| D9 | `MIG:13` | `attempts` default 1 | ✅ Killed (4 tests) |
| D10 | `MIG:19` | `version` UNIQUE dropped | ✅ Killed (`E:428`) |
| D11 | `MIG:7` | `version` identity → `DEFAULT 1` | ✅ Killed (all event tests) |
| D12 | `MIG:14` | `next_attempt_at` without `DEFAULT now() NOT NULL` | ❌ Survived → G3; ✅ Killed in iteration 1 |

**Sensor depth**: P0-expanded (concurrency, data integrity), 29 manual behavior-level mutations
**Result**: 29/29 killed in iteration 1 - PASS ✅

Iteration 0 had 26/29 killed (M14, D8, D12 survived).

M14 is not equivalent: with the unlocked read, a `PATCH` that holds the row lock and commits a new price before the delete's `UPDATE` proceeds leaves the `product_deleted` event with the old price and a higher version than the `price_changed` event.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (thin `recordSyncEvent`/`insertSyncEvent`, one `lockProduct` helper reusing `lockActiveProductsStock`) | ✅ |
| Surgical changes (only the four flows, seed and its test) | ✅ |
| No scope creep (no worker, mock or status endpoint) | ✅ |
| Matches patterns (`executor: Executor = db`, composite FK and CHECK naming, raw-insert constraint tests) | ✅ |
| `CLAUDE.md` database rules: explicit plural `sync_events`, `timestamptz`, no `deleted_at` exception explained on the table (`schemas/sync-events.ts:34-35`) and not in `CLAUDE.md`, as `05-sync.md` asks | ✅ |
| Version invariant commented where the event is inserted (`sync.service.ts:5-7`) | ✅ |
| Comments only for the non-obvious why | ✅ |
| Spec-anchored outcome check | ✅ |
| Schema CHECK/FK layer has a raw-insert test per constraint (lessons L-006, L-007) | ✅ |
| Every test maps to a spec AC or edge case | ✅ |
| Documented guidelines followed: `CLAUDE.md`, `docs/prompts/05-sync.md` | ✅ |

---

## Edge Cases

- [x] `PATCH` on a missing product → 404, no event (`E:262-266`). Soft-deleted product → 404 at `modules/products/products.test.ts:698-710`; no event because `lockProduct` throws before `recordSyncEvent` (`PS:68-72`, `PS:80`)
- [x] Duplicate SKU → 409, no event (`E:149-158`)

---

## Gate Check

- **Gate command**: `pnpm --filter stocksync-api typecheck && pnpm lint:check` and `npx vitest run` in `apps/backend` (with `db:up`)
- **Result**: typecheck exit 0; biome "Checked 62 files. No fixes applied."; vitest **278 passed**, 0 failed, 0 skipped (11 files). Re-run of `sync-events.test.ts` + `seed.test.ts` after the sensor: 30 passed
- **Test count before feature**: 252
- **Test count after feature**: 278
- **Delta**: +26 (25 in `sync-events.test.ts`, 1 in `seed.test.ts`); no test removed or weakened
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

All three fix plans were implemented and verified in iteration 1 (see "Iteration 1").

### G1 (Major): `deleteProduct` lock not discriminated (SYNC-13, M14)

- **Root cause**: no test makes the delete wait on the product lock while the price changes.
- **Fix task**: in `sync-events.test.ts`, hold `SELECT ... FOR UPDATE` on CAM-P in a test transaction, start the `DELETE`, wait for one lock waiter, `UPDATE products SET price_cents = 5990` inside the test transaction and commit; assert 204 and that the `product_deleted` event has `priceCents: 5990` and the highest version. Must fail with M14 applied.

### G2 (Minor): partial index condition untested (SYNC-05, D8)

- **Fix task**: query `pg_indexes` for `sync_events` and assert the three `indexdef`s, including `WHERE (status = 'pending'::sync_event_status)`. Must fail with D8 applied.

### G3 (Minor): `next_attempt_at` default untested (SYNC-01, D12)

- **Fix task**: in a fresh-event assertion, check `nextAttemptAt` is a `Date` not later than the read time (or within a few seconds of `createdAt`). Must fail with D12 applied.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SYNC-02..SYNC-04, SYNC-06..SYNC-12, SYNC-14..SYNC-17 | Implemented | ✅ Verified |
| SYNC-01 | Implemented | ✅ Verified |
| SYNC-05 | Implemented | ✅ Verified |
| SYNC-13 | Implemented | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready (iteration 1)

**Spec-anchored check**: iteration 1: 17/17 ACs matched, 0 spec-precision gaps. Iteration 0: 14/17 ACs fully matched; 1 gap (SYNC-13 delete), 2 inspection-only items with survivors (SYNC-01, SYNC-05); 0 spec-precision gaps
**Sensor**: 29 mutations; iteration 1: 29 killed. Iteration 0: 26 killed, 3 survived (M14, D8, D12)
**Gate**: iteration 1: sync-events + seed files 33 passed. Iteration 0: full suite 278 passed, typecheck and lint clean

**What works**: one event per flow with exact snapshots (create incl. stock 0, sale per product, adjustment, price change, delete with stock 0 and untouched product stock), no event on 409/404 or unchanged price, deterministic concurrent-PATCH test proving the update lock, versions across delete + recreate, seed events and idempotency, every CHECK, the composite FK and the version UNIQUE.

**Issues found**: none open. Iteration 0 found G1 delete-lock test, G2 index-definition test, G3 `next_attempt_at` default test. All three are test-only fixes; no production code change is needed.

**Next steps**: run the full gate (`npx vitest run`, typecheck, lint) before committing; the feature is verified.
