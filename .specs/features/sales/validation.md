# Sales Validation

## Validation: sales - PASS

**Date**: 2026-10-05
**Spec**: `.specs/features/sales/spec.md` (SALE-01..SALE-34 + 3 edge cases)
**Diff range**: main..working tree, uncommitted. The local `main` ref is stale (`ad4d85b`, before the stock-movements merge), so the effective base is `HEAD` `a09626b` on `feat/sales`. Modified: `apps/backend/src/app.ts`, `src/infra/schemas/stock-movements.ts`, `src/infra/migrations/meta/_journal.json`, `src/modules/products/products.repository.ts`, `src/modules/stock-movements/{stock-movements.service,stock-movements.repository,stock-movements.test}.ts`. Untracked: `src/infra/schemas/sales.ts`, `src/infra/migrations/0003_swift_justice.sql`, `src/infra/migrations/meta/0003_snapshot.json`, `src/modules/sales/{sales.routes,sales.service,sales.repository,sales.validation,sales.test}.ts`
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 1 (re-verification after fix iteration 1. The only file newer than the iteration 0 report is `sales.test.ts`, so no production file changed)

Agreed deviations, not gaps: the detailed adjustment 409 message, `applyStockChanges(tx, { tenantId, userId, source, saleId, notFoundMessage, items })`, `stock_movements.created_at` defaulting to `clock_timestamp()`, and `saleId: null` in the adjustment and history shape.

Iteration 0 was FAIL with three gaps:

- **G1**: the SALE-32/SALE-33 constraints had no tests (D2-D9 survived).
- **G2**: there was no replay after two tenants used the same key (M13 survived).
- **G3**: the history-order assertion was weak (D1 was killed in only 2 of 8 runs).

Fix iteration 1 added raw-insert tests for every sales constraint, replays in both tenants, and a full-order history assertion with a 15 s timeout. D2-D9 and M13 are now killed. D1 is killed in 9 of 14 runs and remains a non-blocking residual (R1).

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Multi-product stock change | ✅ Done | `stock-movements.service.ts:63-112`, `products.repository.ts:94-110` |
| T2 Sales schema and migration | ✅ Done | `schemas/sales.ts:19-80`, `0003_swift_justice.sql:1-32`; constraint tests `sales.test.ts:725-842`, `stock-movements.test.ts:86-95` |
| T3 Sales endpoint + idempotency | ✅ Done | `sales.routes.ts:9-26`, `sales.service.ts:51-107`, mounted `app.ts:22` |
| T4 History `saleId` | ✅ Done | `stock-movements.repository.ts:14` |

---

## Spec-Anchored Acceptance Criteria

Test paths are relative to `apps/backend/src/`. `T` = `modules/sales/sales.test.ts`, `S` = `modules/stock-movements/stock-movements.test.ts`.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| SALE-01 201 for admin/operator | 201 + sale | operator `T:119` `toBe(201)`; admin `T:198` `toBe(201)`, `T:199` email `admin@acme.test` | ✅ PASS |
| SALE-02 stock decremented | stock -= quantity per item | `T:144` CAM-P `toBe(23)` (25-2), `T:145` BON-01 `toBe(2)` (3-1) | ✅ PASS |
| SALE-03 one movement per item | `sale`/`out`/quantity/`stockAfter`/`saleId` | `T:147-162` per product `toEqual([objectContaining({ tenantId, direction: "out", quantity, stockAfter, reason: null, saleId: stored.id, userId })])` on rows filtered `source = 'sale'` (`T:81-91`) | ✅ PASS |
| SALE-04 exact sale shape, items by productId | `{ id, items[{productId, sku, name, quantity, unitPriceCents}], totalCents, createdAt, user{id,email} }`, no `tenantId` | `T:122-143` `toEqual` exact object with `items: byProductId([...])` | ✅ PASS |
| SALE-05 frozen price, total | `unitPriceCents` = price at sale; `totalCents = Σ q×p` | `T:130`,`T:137` 4990/2990; `T:140` `2 * 4990 + 2990`; `sale_items` rows `T:163-190`; frozen after price change `T:653-654` | ✅ PASS |
| SALE-06 tenant/user only from `req.auth` | body `tenantId`/`userId` ignored | `T:212-229`: `T:226` email operator, `T:228` stored `tenantId` = Acme. Code `sales.routes.ts:17` | ✅ PASS |
| SALE-07 404 missing/soft-deleted/other tenant | 404 `NOT_FOUND` `One or more products were not found`, nothing changes | `T:293-322` `it.each` 3 cases → `T:318` 404, `T:319` `toEqual(notFoundBody)` (`T:105-107`), `T:320` snapshot unchanged | ✅ PASS |
| SALE-08 409 lists only short items, by productId | exact message format, nothing changes | one short `T:261-268` exact body (only BON-01); two short `T:279-290` ordered with `byProductId`; snapshot unchanged | ✅ PASS |
| SALE-09 404 wins over 409 | 404 | `T:324-335` → `T:332-333`. Sensor M4 killed | ✅ PASS |
| SALE-10 failure changes nothing | stock, sales, sale_items, movements unchanged | `snapshot()` (`T:69-79`) compared at `T:268`, `T:290`, `T:320`, `T:334`, `T:397`, `T:434`, `T:581`. Sensor M12 killed | ✅ PASS |
| SALE-11 401 | 401 `UNAUTHORIZED` | no cookie + invalid `T:242-248` exact body. Expired: shared `requireAuth` (`sales.routes.ts:9`) proven at `http/require-auth.test.ts:134` | ✅ PASS |
| SALE-12 Idempotency-Key missing/non-uuid | 400 `VALIDATION_ERROR` | `T:416-436` → `T:432-434` | ✅ PASS |
| SALE-13 items missing/empty/>100 | 400 | `T:340-350` → `T:395-397`; boundary 100 accepted `T:400-414`. Sensor M14 killed | ✅ PASS |
| SALE-14 non-uuid productId | 400 | `T:382-385` → `T:395-396` | ✅ PASS |
| SALE-15 quantity not int in 1..1,000,000 | 400 | `T:351-363` (0, -1, 1.5, 1,000,001) → `T:395-396` | ✅ PASS |
| SALE-16 duplicate productId | 400 | `T:364-381` incl. different case. Sensors M11, M18 killed | ✅ PASS |
| SALE-17 10 parallel × 1 vs stock 5 | five 201, five 409, stock 0, five sale movements, latest `stockAfter` 0 | `T:450-453` `toHaveLength(5)` ×2, stock `toBe(0)`, 5 sale movements; `T:457-472` full history `toEqual([["sale",0],["sale",1],["sale",2],["sale",3],["sale",4],["adjustment",5],["initial",0]])` | ✅ PASS |
| SALE-18 A+B ∥ B+A | both 201, no 500 | `T:475-493` 5 rounds `toEqual([201, 201])`, final stocks 15 / 0. Sensor M2 killed | ✅ PASS |
| SALE-19 lock all in productId order with `FOR UPDATE` before checking | sorted locking | **Inspection**: `products.repository.ts:108-109` `.orderBy(asc(products.id)).for("update")`, called at `stock-movements.service.ts:72-76` before the checks at `:78-90`. Behaviorally proven by SALE-18 (M2 killed) | ✅ PASS (inspection + sensor) |
| SALE-20 replay | 201, same sale, `Idempotent-Replayed: true`, stock unchanged | `T:504-510` 201 ×2, header `"true"`, `replay.body` `toEqual(first.body)`, stock 23, 1 sale, 1 movement. Sensors M7, M19 killed | ✅ PASS |
| SALE-21 parallel same key | all 201, same id, 1 sale, 1 decrement | `T:521-533` 5× 201, `ids.size` 1, 4 replay headers, 1 sale, stock 24, 1 movement | ✅ PASS |
| SALE-22 other order is a replay | replay | `T:536-561` reversed + upper-cased id → 201, header, same id, BON-01 3. Sensor M6 killed | ✅ PASS |
| SALE-23 same key, different items | 409 `Idempotency key was already used with a different request`, nothing changes | `T:574-581` exact body + snapshot. Sensor M5 killed | ✅ PASS |
| SALE-24 failed sale does not keep the key | retry processed again | `T:592-595` 409 → restock → 201 with no replay header, stock 0. Sensor M12 killed | ✅ PASS |
| SALE-25 two tenants, same key | two independent sales | `T:614-617` both 201, no replay header, different ids; replays in both tenants `T:630-635` 201, `Idempotent-Replayed: true`, each `toEqual` its own original body; stocks `T:636-637` 24 / 9. Sensor M13 killed | ✅ PASS |
| SALE-26 replay after price change / soft delete | original `unitPriceCents`, `totalCents`, `sku`, `name` | price `T:652-654` 4990 / 9980 after the price was set to 9999; soft delete `T:668-678` 201, header, exact item with `sku`/`name`. Sensors M8, M9, M15 killed | ✅ PASS |
| SALE-27 adjustment uses the shared function, codes + `Product not found` kept | unchanged | `stock-movements.service.ts:147-154`; adjustment 404 `S:395-425` `toEqual(notFoundBody)` (`S:246-248`), 403/401/409 tests unchanged and passing | ✅ PASS |
| SALE-28 adjustment 409 detailed message | `Insufficient stock for CAM-P (available: 25, requested: 26)` | `S:311-316` exact body | ✅ PASS |
| SALE-29 history `saleId` | present, `null` for initial/adjustment | sale `T:694-701` `saleId: sale.body.id`; initial `T:702-705` and `S:551` `saleId: null`; adjustment `S:294` `saleId: null` | ✅ PASS |
| SALE-30 ledger invariant after sales | Σ(in − out) = `products.stock` | `T:707-721` for both products | ✅ PASS |
| SALE-31 tables and columns, no `updated_at`/`deleted_at` | listed columns | **Inspection**: `0003_swift_justice.sql:1-23`, `schemas/sales.ts:19-80`; exercised by every sale test and raw insert | ✅ PASS (inspection) |
| SALE-32 uniques and CHECKs | enforced by the database | `length(request_hash) = 64` `T:754-760` → `23514 sales_request_hash_length`; `quantity > 0` and `unit_price_cents >= 0` `T:762-773` → `23514` + constraint; `unique (sale_id, product_id)` `T:775-792` → `23505 sale_items_sale_id_product_id_unique`; `unique (tenant_id, idempotency_key)` proven by every replay test; `unique (tenant_id, id)` is the FK target (the migration would fail without it). Sensors D2, D3, D4, D9 killed | ✅ PASS |
| SALE-33 composite FKs | 4 composite FKs | `T:794-802` `sales_user_fk`; `T:804-810` `sale_items_sale_fk`; `T:812-820` `sale_items_product_fk`; `T:822-841` `stock_movements_sale_fk`; each `rejects.toMatchObject({ cause: { code: "23503", constraint } })` with mixed tenants. Sensors D5-D8 killed | ✅ PASS |
| SALE-34 sale/sale_id CHECK | both inserts rejected | `S:86-95` rows of the `it.each` at `S:72` → `S:116-120` `23514 stock_movements_sale_id_only_for_sales`. Sensor D10 killed | ✅ PASS |

**Status**: ✅ All 34 ACs covered with spec-matching assertions. No spec-precision gaps.

### Observations (non-blocking)

- **O1**: Iteration 0 saw one timeout (5284 ms) of the 10-parallel test. Both concurrency tests now have a 15 s timeout (`T:473`, `T:493`), and 6 unmutated runs of `sales.test.ts` plus the full gate all passed.
- **O2**: The items `ORDER BY` in `findSaleById` (`sales.repository.ts:83`) cannot be told apart from heap order, because sale items are inserted in `productId` order (M17 is equivalent in practice).
- **R1 (residual, Minor)**: D1 (`clock_timestamp()` → `now()`) is now killed in 9 of 14 runs, up from 2 of 8. The mutant only shows when transactions happen to start in a different order than they acquire the lock, so any HTTP-level parallel test detects it probabilistically. A regression would still fail CI within a few runs. A deterministic kill needs a test that holds the product lock from a raw transaction while a sale waits. This is optional hardening, because D1 mutates an agreed design decision (AD-015), not a spec AC value.

---

## Discrimination Sensor

Isolated scratch: the working tree was copied with `rsync` (no `.git`; root and `apps/backend` `node_modules` symlinked) to the session scratchpad, and `TEST_DATABASE` in the copy was pointed at a separate `stocksync_verify_scratch` database, so the shared `stocksync_test` database was never touched. Each mutant was an exact single-occurrence string replacement, run with `npx vitest run` on `sales.test.ts` + `stock-movements.test.ts` (100 tests in iteration 1), then reverted. For migration mutants the scratch DB was dropped before and after each run, so it was rebuilt from the mutated SQL. Afterwards the scratch DB was dropped and the copy deleted. The real tree's `git status --porcelain` matched the baseline before and after both iterations.

| # | File:line (real tree) | Mutation | Iteration 0 | Iteration 1 |
| - | --------------------- | -------- | ----------- | ----------- |
| M1 | `products.repository.ts:108` | lock query drops `ORDER BY id` | ⚪ Survived, not observable (consistent planner order on test data); SALE-19 accepted by inspection | not re-run |
| M2 | `stock-movements.service.ts:72-76` | lock each product separately in the caller's order | ✅ Killed | ✅ Killed |
| M3 | `stock-movements.service.ts:86` | 409 reports only the first shortage | ✅ Killed | ✅ Killed |
| M4 | `stock-movements.service.ts:78-90` | stock checked before existence (409 over 404) | ✅ Killed | ✅ Killed |
| M5 | `sales.service.ts:100` | hash comparison skipped | ✅ Killed | ✅ Killed |
| M6 | `sales.service.ts:20` | hash without sorting items | ✅ Killed | ✅ Killed |
| M7 | `sales.routes.ts:24` | `Idempotent-Replayed` header dropped | ✅ Killed | ✅ Killed (5 tests) |
| M8 | `sales.repository.ts:76-80` | items join filters `products.deleted_at IS NULL` | ✅ Killed | ✅ Killed |
| M9 | `sales.repository.ts:72` | current product price instead of frozen `unit_price_cents` | ✅ Killed | ✅ Killed |
| M10 | `stock-movements.service.ts:101` | movement inserted with `saleId: null` | ✅ Killed | ✅ Killed |
| M11 | `sales.validation.ts:16-20` | duplicate-productId refine removed | ✅ Killed | ✅ Killed |
| M12 | `sales.service.ts:61-64` | sale inserted outside the transaction | ✅ Killed | ✅ Killed |
| M13 | `sales.repository.ts:36` | `findSaleByKey` drops the `tenantId` filter | ❌ Survived | ✅ Killed (`T:598`) |
| M14 | `sales.validation.ts:15` | `.max(100)` → `.max(99)` | ✅ Killed | ✅ Killed |
| M15 | `sales.service.ts:83` | `unitPriceCents: 0` on insert | ✅ Killed | ✅ Killed |
| M16 | `sales.service.ts:17` | hash does not lowercase `productId` | ⚪ Equivalent (validation lowercases, `sales.validation.ts:7`) | not re-run |
| M17 | `sales.repository.ts:83` | items `ORDER BY productId` removed | ⚪ Equivalent in practice (O2) | not re-run |
| M18 | `sales.validation.ts:7` | no `.toLowerCase()` on `productId` | ✅ Killed | ✅ Killed |
| M19 | `sales.service.ts:96` | always rethrow (no replay) | ✅ Killed | ✅ Killed |
| D1 | `0003_swift_justice.sql:25` | movement `created_at` default `clock_timestamp()` → `now()` | ⚠️ 2/8 runs | ⚠️ Killed in 9 of 14 runs (`T:457-472`), residual R1 |
| D2 | `0003_swift_justice.sql:22` | `sales_request_hash_length` → `CHECK (true)` | ❌ Survived | ✅ Killed (`T:754`) |
| D3 | `0003_swift_justice.sql:9` | `sale_items_quantity_positive` → `CHECK (true)` | ❌ Survived | ✅ Killed (`T:762`) |
| D4 | `0003_swift_justice.sql:10` | `sale_items_unit_price_cents_non_negative` → `CHECK (true)` | ❌ Survived | ✅ Killed (`T:762`) |
| D5 | `0003_swift_justice.sql:28` | `sale_items_product_fk` → `product_id → products(id)` | ❌ Survived | ✅ Killed (`T:812`) |
| D6 | `0003_swift_justice.sql:30` | `sales_user_fk` → `user_id → users(id)` | ❌ Survived | ✅ Killed (`T:794`) |
| D7 | `0003_swift_justice.sql:31` | `stock_movements_sale_fk` → `sale_id → sales(id)` | ❌ Survived | ✅ Killed (`T:822`) |
| D8 | `0003_swift_justice.sql:27` | `sale_items_sale_fk` → `sale_id → sales(id)` | ❌ Survived | ✅ Killed (`T:804`) |
| D9 | `0003_swift_justice.sql:8` | `unique (sale_id, product_id)` dropped | ❌ Survived | ✅ Killed (`T:775`) |
| D10 | `0003_swift_justice.sql:32` | `stock_movements_sale_id_only_for_sales` → `CHECK (true)` | ✅ Killed | ✅ Killed |

**Sensor depth**: P0-expanded (concurrency, idempotency, all-or-nothing, tenant isolation), 29 manual behavior-level mutations
**Result** (iteration 1): 25 killed on every run. D1 is killed probabilistically (9 of 14 runs, residual R1). M1, M16 and M17 are equivalent or not observable. There are 0 deterministic non-equivalent survivors. - PASS ✅

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes (`app.ts` +2, `products.repository.ts` lock replaced, `stock-movements.repository.ts` +1) | ✅ |
| No scope creep (no `GET /sales`, no refunds, no `details`) | ✅ |
| Matches patterns (module layout, `executor: Executor = db`, `safeParse` → `ValidationError`, raw-insert constraint tests like `stock-movements.test.ts`) | ✅ |
| `CLAUDE.md` database rules: explicit plural table names, `timestamptz`, composite tenant FKs, check under `FOR UPDATE`; the `23505` exception is agreed and commented (`sales.service.ts:91-95`) | ✅ |
| Comments only for the non-obvious why | ✅ |
| Spec-anchored outcome check | ✅ |
| Per-layer coverage: route happy + edge + error | ✅ |
| Schema CHECK/FK layer has a raw-insert test per constraint (project lessons L-006, L-007) | ✅ |
| Every test maps to a spec AC, edge case or Done-when | ✅ |
| Documented guidelines followed: `CLAUDE.md`, `docs/prompts/04-sales.md` | ✅ |

---

## Edge Cases

- [x] Quantity equal to stock → 201 and stock 0 (`T:203-210`)
- [x] Two short items both listed (`T:271-291`)
- [x] 409, restock, retry with the same key → 201 (`T:584-596`)

---

## Gate Check

- **Gate command**: `pnpm --filter stocksync-api typecheck && pnpm test && pnpm lint:check` (run in the real repo)
- **Result** (iteration 1): typecheck exit 0; `pnpm test` exit 0, **252 passed**, 0 failed, 0 skipped (10 files); biome "Checked 58 files. No fixes applied." Iteration 0 had 244 passed
- **Test count before feature**: 207 (stock-movements validation)
- **Test count after feature**: 252
- **Delta**: +45 (43 in `sales.test.ts`, +2 CHECK cases in `stock-movements.test.ts`); no test removed. The one changed adjustment assertion (`S:311-316`) is the agreed detailed message and is stricter than before
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

Iteration 0 gaps:

- **G1** SALE-32/SALE-33 constraints untested (D2-D9): resolved by `T:725-842`.
- **G2** no cross-tenant replay (M13): resolved by `T:619-635`.
- **G3** weak history-order assertion (D1): improved by `T:457-472` (2/8 → 9/14 kills), with the remainder accepted as residual R1 (optional deterministic lock-holding test).

No open blocking fix tasks.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SALE-01..SALE-34 | Implemented | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 34/34 ACs matched the spec outcome, 0 spec-precision gaps
**Sensor**: 29 mutations. 25 are killed on every run, D1 is killed in 9 of 14 runs (residual R1), 3 are equivalent or not observable, and 0 non-equivalent mutants survive deterministically.
**Gate**: 252 passed, typecheck and lint clean

**What works**: all-or-nothing sales with sorted locks (no deadlock), exact 404/409 messages and precedence, idempotent replay (sequential, parallel, reordered, per tenant, after a price change or soft delete), conflicting key → 409, failed sale releases the key, validation, the adjustment refactor and `saleId` in the history, the ledger invariant and full history order under concurrency, and every sales CHECK, unique and composite FK.

**Issues found**: none blocking. R1 (deterministic D1 kill) is optional hardening.

**Next steps**: user review, then commit with the `commit` skill.
