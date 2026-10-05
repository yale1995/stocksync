# Stock Movements Validation

## Validation: stock-movements - PASS

**Date**: 2026-10-04
**Spec**: `.specs/features/stock-movements/spec.md` (MOV-01..MOV-32 + 3 edge cases)
**Diff range**: uncommitted working tree on `main` vs HEAD ad4d85b (modified: `CLAUDE.md`, `AGENTS.md`, `apps/backend/src/app.ts`, `src/infra/seed/seed.ts`, `src/infra/migrations/meta/_journal.json`, `src/modules/products/{products.repository,products.routes,products.service,products.validation}.ts`; untracked: `src/infra/schemas/stock-movements.ts`, `src/infra/migrations/0002_parallel_forgotten_one.sql`, `src/infra/migrations/meta/0002_snapshot.json`, `src/modules/stock-movements/{stock-movements.routes,stock-movements.service,stock-movements.repository,stock-movements.validation,stock-movements.test}.ts`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 1 (re-verification after fix iteration 1; only `stock-movements.test.ts` changed, confirmed by file mtimes - no production file changed)

Iteration 0 was FAIL: 5 surviving mutants in the DB constraints (MOV-27, MOV-28) and the MOV-05 message was not asserted. Fix iteration 1 added raw-insert tests for all five CHECKs and both composite FKs, and pinned the MOV-05 message. All five former survivors and a new message mutant are now killed. Every AC has evidence and all gates pass.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Schema + migration | ✅ Done | `apps/backend/src/infra/schemas/stock-movements.ts:35-89`, `infra/migrations/0002_parallel_forgotten_one.sql:1-24` |
| T2 Seed initial movements | ✅ Done | `apps/backend/src/infra/seed/seed.ts:127-143`, admin resolved at `seed.ts:149-154` |
| T3 Initial movement on POST /products | ✅ Done | `modules/products/products.service.ts:45-51`, `stock-movements.service.ts:62-84` |
| T4 applyStockChange + adjustment endpoint | ✅ Done | `stock-movements.service.ts:31-58`, `:86-104`; `stock-movements.routes.ts:20-38`; mounted `app.ts:19` |
| T5 History endpoint | ✅ Done | `stock-movements.routes.ts:40-58`, `stock-movements.repository.ts:62-87` |
| T6 Append-only rule in agent docs | ✅ Done | `CLAUDE.md:21`; `diff CLAUDE.md AGENTS.md` is empty |

---

## Spec-Anchored Acceptance Criteria

Test paths are relative to `apps/backend/src/`. `S` = `modules/stock-movements/stock-movements.test.ts`.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| MOV-01 `in` adjustment | stock += quantity, 201 + movement | `S:271` `expect(response.status).toBe(201)`; `S:284` `stock` `toBe(30)` for `in 5` (`S:256`); `S:274-283` exact movement body | ✅ PASS |
| MOV-02 `out` adjustment within stock | stock -= quantity, 201 + movement | `S:257` `out 3` → `S:284` `toBe(22)`; `S:271` 201; `S:274-283` body | ✅ PASS |
| MOV-03 movement fields | request `direction`, `quantity`, trimmed `reason`, `source: "adjustment"`, `stockAfter` = new stock, `user: { id, email }` of caller | `S:274-283` `toEqual({ id, direction, quantity, stockAfter: expectedStock, source: "adjustment", reason: "Physical count", createdAt, user: { id: admin.id, email: "admin@acme.test" } })` with input `"  Physical count  "` (`S:268`) | ✅ PASS |
| MOV-04 `out` above stock | 409 `CONFLICT` `Insufficient stock`, stock + history unchanged | `S:298-301` `toBe(409)` + `toEqual({ error: { code: "CONFLICT", message: "Insufficient stock" } })`; `S:302` stock `toBe(25)`; `S:303` movements `toHaveLength(1)` | ✅ PASS |
| MOV-05 `in` above 1,000,000 | 409 `CONFLICT` `Stock cannot exceed 1000000` (spec Assumptions), stock + history unchanged | `S:320-321` 999,975 accepted to exactly 1,000,000; `S:322` `toBe(409)`; `S:323-325` `toEqual({ error: { code: "CONFLICT", message: "Stock cannot exceed 1000000" } })`; `S:326` stock `toBe(1_000_000)`; `S:327` `toHaveLength(2)` | ✅ PASS |
| MOV-06 lock with tenant + `deleted_at` filter, update + insert in one transaction | `SELECT ... FOR UPDATE` before computing | **Inspection**: `products.repository.ts:91-101` (`isActiveInTenant` + `.for("update")`), `stock-movements.service.ts:35-57` (lock → compute → update → insert on `tx`), `:92` `db.transaction`. Filters proven by sensor M3/M4 (killed). The lock itself is not behaviorally testable without concurrency, which the prompt defers to the sales PR | ✅ PASS (inspection + sensor) |
| MOV-07 history shape + defaults | 200 `{ data, meta: { page: 1, limit: 20, total } }` | `S:496` `toBe(200)`; `S:497` `meta` `toEqual({ page: 1, limit: 20, total: 4 })` | ✅ PASS |
| MOV-08 order `created_at desc, id desc` | newest first, `id desc` on ties | `S:512-517` exact sequence newest → initial; tie `S:578-580` ids `toEqual(sorted desc)` | ✅ PASS |
| MOV-09 page past the end | 200, `data: []`, real `total` | `S:610-614` `toEqual({ data: [], meta: { page: 3, limit: 1, total: 1 } })` | ✅ PASS |
| MOV-10 invalid page/limit | 400 `VALIDATION_ERROR` | `S:626-641` (`page=0,-1,1.5,abc`, `limit=0,101,2.5`, repeated `page`) `toBe(400)` + code; boundaries `S:622-623` | ✅ PASS |
| MOV-11 exact movement shape | exactly `{ id, direction, quantity, stockAfter, source, reason, createdAt, user: { id, email } }` | `S:527-536` `toEqual` exact object (no `tenantId`/`productId`); `S:274-283` same for the adjustment response | ✅ PASS |
| MOV-12 soft-deleted user still shown | movement returned with `user` | `S:663-667` `data[0].user` `toEqual({ id: admin.id, email: "admin@acme.test" })` after soft-deleting the admin | ✅ PASS |
| MOV-13 initial movement on create | `source: initial`, `direction: in`, quantity = stockAfter = stock, `reason: null`, creating admin | `S:218-228` `toEqual([objectContaining({ tenantId, direction: "in", source: "initial", quantity: stock, stockAfter: stock, reason: null, userId: admin.id })])` for stock 12 | ✅ PASS |
| MOV-14 stock 0 still records | `quantity: 0`, `stockAfter: 0` | `S:200` `it.each([[12], [0]])` → `S:218-228` | ✅ PASS |
| MOV-15 POST /products shape unchanged | same 7 keys | `S:208-216` `Object.keys(body).sort()` `toEqual([...7 keys])`; `products.test.ts` unchanged and passing | ✅ PASS |
| MOV-16 latest `stockAfter` = `products.stock` | equal | `S:547-548` `data[0].stockAfter` `toBe(20)` and product stock `toBe(20)` | ✅ PASS |
| MOV-17 401 on both endpoints | 401 `UNAUTHORIZED` | adjustment `S:357-360`, history `S:678-681` (no cookie + invalid token, exact body). Expired: per-route `requireAuth` (`stock-movements.routes.ts:22`, `:42`) proven at `http/require-auth.test.ts:134` | ✅ PASS |
| MOV-18 operator adjustment | 403 `FORBIDDEN` | `S:339-341` `toBe(403)`, code `FORBIDDEN`, stock unchanged | ✅ PASS |
| MOV-19 other tenant | 404 on both, other tenant stock unchanged | adjustment `S:372-375` (404 + body, Globex stock `toBe(10)`, 1 movement); history `S:689-690` | ✅ PASS |
| MOV-20 missing / soft deleted | 404 on both | adjustment soft deleted `S:388-390`, unknown `S:403-404`; history soft deleted `S:699-700`, unknown `S:710-711` | ✅ PASS |
| MOV-21 non-uuid `:id` | 404 on both | `S:405-406`, `S:712-713` `toEqual(notFoundBody)` | ✅ PASS |
| MOV-22 tenantId/userId only from `req.auth` | body fields ignored | `S:409-425` body with Globex `tenantId`/`userId` + `source: "sale"` → 201, `source` `adjustment`, user `admin@acme.test`; create path `products.routes.ts:51-52` | ✅ PASS |
| MOV-23 invalid direction | 400 | `S:430-431` → `S:450-451` | ✅ PASS |
| MOV-24 invalid quantity | 400 | `S:432-437` (missing, 0, -1, 1.5, 1,000,001, `"1"`) → `S:450-451` | ✅ PASS |
| MOV-25 invalid reason | 400 | `S:438-441` (missing, empty, blank, 501) → `S:450-451`; 500 accepted `S:463` | ✅ PASS |
| MOV-26 table columns, no `updated_at`/`deleted_at` | listed columns, `uuidv7()`, `timestamptz` | **Inspection**: `0002_parallel_forgotten_one.sql:3-13`; schema `schemas/stock-movements.ts:38-49`. Exercised by every insert/read test | ✅ PASS (inspection) |
| MOV-27 composite FKs | `(tenant_id, product_id)` and `(tenant_id, user_id)` | `S:109-117` Acme tenant + Globex `productId` `rejects.toMatchObject({ cause: { code: "23503", constraint: "stock_movements_product_fk" } })`; `S:119-125` Acme tenant + Globex `userId` → `23503`, `stock_movements_user_fk`. Inspection `0002_parallel_forgotten_one.sql:22-23`. Sensor M22, M26 killed | ✅ PASS |
| MOV-28 five CHECKs | all five enforced | `S:72-106` `it.each` → `rejects.toMatchObject({ cause: { code: "23514", constraint } })`: `initial_is_in` (`S:74-77`), `sale_is_out` (`S:78-82`), `quantity_positive` (`S:83-87`), `stock_after_non_negative` (`S:88-92`), `reason_only_for_adjustments` both directions (`S:93-102`). Inspection `0002_parallel_forgotten_one.sql:14-18`. Sensor M20, M21, M23, M24, M25 killed | ✅ PASS |
| MOV-29 two rejected raw inserts | DB rejects `sale`+`in` and `adjustment`+`quantity 0` | `S:78-82` and `S:83-87` rows of the `it.each` at `S:72`, asserted at `S:104-106` with code `23514` and constraint `stock_movements_sale_is_out` / `stock_movements_quantity_positive` | ✅ PASS |
| MOV-30 history index | `(tenant_id, product_id, created_at desc, id desc)` | **Inspection**: `0002_parallel_forgotten_one.sql:24`, `schemas/stock-movements.ts:62-67` (performance-only, not behaviorally testable) | ✅ PASS (inspection) |
| MOV-31 seed records initial by tenant admin in same transaction | one `initial` per product by admin | `S:151-188` exact rows incl. `email: "admin@acme.test"` / `"admin@globex.test"`; transaction `seed.ts:127` | ✅ PASS |
| MOV-32 seed twice → exactly one initial each | 4 rows total | `S:130` second `seed(db)` then `S:151` `toEqual([4 rows])` | ✅ PASS |

### Observations (non-blocking)

- **O1**: The ledger-sum invariant in Goals (sum of `in` minus `out` = `products.stock`) has no explicit assertion. It is implied by MOV-16 (`S:547-548`) and by the exact `stockAfter` sequence at `S:512-517`.
- **O2**: MOV-11 does not fix the `createdAt` format. The tests compare it to the stored value's ISO string (`S:281`, `S:534`), which matches the products module.

---

## Discrimination Sensor

Isolated scratch: the working tree was copied with `rsync` (no `.git`, `node_modules` symlinked) to the session scratchpad, and `TEST_DATABASE` in the copy was pointed at a separate `stocksync_verify_scratch` database. The shared `stocksync_test` database was never touched by the sensor. All 49 stock-movements tests passed in the scratch before any mutation. Each mutant was applied with an exact single-occurrence string replacement, tested with `vitest run` on `stock-movements.test.ts`, `products.test.ts` and `seed.test.ts` (147 tests), and reverted. For migration mutants the scratch database was dropped before and after, so it was rebuilt from the mutated SQL. Afterwards the scratch database was dropped and the scratch copy deleted. The real tree's `git status --porcelain` matched the baseline before and after.

| # | File:line (real tree) | Mutation | Killed? |
| - | --------------------- | -------- | ------- |
| M1 | `stock-movements.service.ts:46` | `stockAfter < 0` → `< -1` | ✅ Killed (`S:289`) |
| M2 | `stock-movements.service.ts:47` | MAX_STOCK check removed | ✅ Killed (`S:306`) |
| M3 | `products.repository.ts:99` | lock query drops the tenant filter | ✅ Killed (`S:363`) |
| M4 | `products.repository.ts:99` | lock query drops `deleted_at IS NULL` | ✅ Killed (`S:378`) |
| M5 | `stock-movements.repository.ts:78` | `created_at desc` → `asc` | ✅ Killed (4 tests) |
| M6 | `stock-movements.repository.ts:78` | tie-breaker `id desc` → `asc` | ✅ Killed (`S:551`) |
| M7 | `stock-movements.repository.ts:20-23` | user join adds `users.deleted_at IS NULL` | ✅ Killed (`S:653`) |
| M8 | `products.service.ts:46` | `recordInitialMovement` skipped | ✅ Killed (`S:200`, both cases) |
| M9 | `stock-movements.service.ts:79` | initial `stockAfter: 0` | ✅ Killed (`S:200`, stock 12) |
| M10 | `stock-movements.service.ts:57` | adjustment `stockAfter` = stock before change | ✅ Killed (6 tests) |
| M11 | `stock-movements.repository.ts:69` | `listStockMovements` drops the tenant filter | ⚪ Survived - **equivalent mutant**: the service checks `findActiveProductById(tenantId, productId)` first (`stock-movements.service.ts:111-115`), product ids are globally unique uuids, and the composite FK forces `movement.tenant_id = product.tenant_id`, so no request can observe the difference. The filter is defense in depth required by `CLAUDE.md` and is present by inspection |
| M12 | `stock-movements.repository.ts:84` | `total` counts the whole tenant | ✅ Killed (5 tests) |
| M13 | `stock-movements.repository.ts:80` | offset `(page-1)*limit` → `page*limit` | ✅ Killed (5 tests) |
| M14 | `stock-movements.routes.ts:23` | `requireRole("admin")` removed | ✅ Killed (`S:330`) |
| M15 | `stock-movements.routes.ts:42` | history restricted to admin | ✅ Killed (`S:644`, `S:653`) |
| M16 | `stock-movements.validation.ts:8` | `reason` not trimmed | ✅ Killed (4 tests) |
| M17 | `stock-movements.service.ts:51` | `updateProductStock` skipped | ✅ Killed (6 tests) |
| M18 | `seed.ts:152` | seed movement recorded by the last user (operator) | ✅ Killed (`S:129`) |
| M19 | `seed.ts:134-143` | seed inserts a duplicate initial movement | ✅ Killed (many tests) |
| M20 | `0002_parallel_forgotten_one.sql:15` | CHECK `sale_is_out` dropped | ✅ Killed (`S:78-82`) |
| M21 | `0002_parallel_forgotten_one.sql:18` | CHECK `reason_only_for_adjustments` → `CHECK (true)` | ✅ Killed in iteration 1 (`S:93-97`, `S:98-102`); survived in iteration 0 |
| M22 | `0002_parallel_forgotten_one.sql:22` | product FK reduced to `product_id → products(id)` | ✅ Killed in iteration 1 (`S:109`); survived in iteration 0 |
| M23 | `0002_parallel_forgotten_one.sql:16` | CHECK `quantity_positive` → `CHECK (true)` | ✅ Killed (`S:83-87`) |
| M24 | `0002_parallel_forgotten_one.sql:14` | CHECK `initial_is_in` → `CHECK (true)` | ✅ Killed in iteration 1 (`S:74-77`); survived in iteration 0 |
| M25 | `0002_parallel_forgotten_one.sql:17` | CHECK `stock_after_non_negative` → `CHECK (true)` | ✅ Killed in iteration 1 (`S:88-92`); survived in iteration 0 |
| M26 | `0002_parallel_forgotten_one.sql:23` | user FK reduced to `user_id → users(id)` | ✅ Killed in iteration 1 (`S:119`); survived in iteration 0 |
| M27 | `stock-movements.service.ts:48` | MAX_STOCK conflict message changed to `Stock limit reached` (iteration 1 only) | ✅ Killed (`S:306`, assertion `S:323-325`) |

`FOR UPDATE` removal was not mutated. It is only observable under concurrency, and the agreed scope defers the concurrency test to the sales PR. MOV-06 is accepted by inspection.

**Sensor depth**: P0-expanded (stock integrity + tenant isolation), 27 manual behavior-level mutations

**Iteration 1 re-run**: a fresh rsync scratch copy with the fixed test file, pointed again at a separate `stocksync_verify_scratch` database. All 55 stock-movements tests passed there before mutating. M20-M26 and the new M27 were re-run against `stock-movements.test.ts`, `products.test.ts` and `seed.test.ts` (153 tests), and all were killed. M1-M19 were not re-run because the fix touched only the constraint describe and the MOV-05 assertion. Afterwards the scratch DB was dropped and the copy deleted, `stocksync_test` was never touched, and `git status --porcelain` of the real tree matched the pre-run baseline.
**Result**: 26/26 non-equivalent mutants killed, 1 equivalent (M11) - PASS ✅

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes (`app.ts` +2, `products.*` small additions, `parseProductId` exported for reuse) | ✅ |
| No scope creep (no `sale_id`, no tenant-wide endpoint, no concurrency test) | ✅ |
| Matches patterns (module layout, `executor: Executor = db`, `safeParse` → `ValidationError`, non-uuid → 404) | ✅ |
| `CLAUDE.md` database rules: explicit plural table name, `timestamptz`, explicit check under a lock before writing (`FOR UPDATE`), append-only exception documented | ✅ |
| Comments only for the non-obvious why (`stock-movements.service.ts:28-30`, `:60-61`; `stock-movements.repository.ts:18-19`; `stock-movements.routes.ts:17`; schema `:33-34`) | ✅ |
| Spec-anchored outcome check | ✅ (MOV-05 message pinned in iteration 1) |
| Per-layer coverage: routes cover happy + edge + error for both routes | ✅ |
| Schema CHECK/FK layer | ✅ every CHECK and both composite FKs have a raw-insert test |
| Every test maps to a spec AC, edge case or Done-when | ✅ |
| Documented guidelines followed: `CLAUDE.md`, `docs/prompts/03-stock-movements.md` | ✅ |

---

## Edge Cases

- [x] `out` equal to the current stock is accepted and leaves 0 (`S:258`, `out 25` → `S:284` `toBe(0)`)
- [x] Same `created_at` ordered by `id desc` (`S:551-581`)
- [x] History of a soft-deleted product → 404 (`S:693-701`)

---

## Gate Check

- **Gate command**: `pnpm --filter stocksync-api typecheck && pnpm test && pnpm lint:check` (run in the real repo)
- **Result** (iteration 1): typecheck exit 0; `pnpm test` exit 0, **207 passed**, 0 failed, 0 skipped (9 files); biome "Checked 52 files. No fixes applied." exit 0. Iteration 0 had 201 passed
- **Test count before feature**: 152 (`products.test.ts` and `seed.test.ts` unchanged by this diff)
- **Test count after feature**: 207
- **Delta**: +55 (all in `stock-movements.test.ts`; iteration 1 added 6: 4 new CHECK cases + 2 FK tests)
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

Iteration 0 gaps (all resolved in iteration 1):

- **G1** composite FKs untested (MOV-27; M22, M26): resolved by `S:109-125`.
- **G2** three CHECKs untested (MOV-28; M21, M24, M25): resolved by `S:72-106`.
- **G3** MOV-05 message unasserted: resolved by `S:323-325`.

No open fix tasks.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| MOV-01..MOV-32 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 32/32 ACs matched the spec outcome, 0 open spec-precision gaps
**Sensor**: 27 mutations, 26 killed, 1 equivalent (M11), 0 non-equivalent survivors
**Gate**: 207 passed, typecheck and lint clean

**What works**: adjustments under a row lock, 409s with no side effects, history order/pagination/shape, soft-deleted user kept in the history, initial movements on create and seed, role, tenant, soft-delete and non-uuid 404s, validation, every DB CHECK and composite FK, append-only rule in agent docs.

**Issues found**: none blocking. Observation O1 (no explicit ledger-sum assertion) remains optional.

**Next steps**: user review, then commit with the `commit` skill.
