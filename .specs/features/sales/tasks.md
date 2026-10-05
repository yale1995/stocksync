# Sales Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: `.specs/features/sales/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `CLAUDE.md` (module layout with `*.test.ts`), `apps/backend/vitest.config.ts`, `docs/prompts/04-sales.md` (Tests section).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Routes (sales, stock-movements) | integration (supertest + real DB) | All routes: happy + every listed edge case + error paths | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| Service / repository / validation | covered through route tests | Every branch reached by a route test | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| Schema CHECK constraints | integration (raw insert) | The two rejected inserts from the prompt | `src/modules/stock-movements/stock-movements.test.ts` | `pnpm --filter stocksync-api test` |
| Migration | none | build gate only | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api test` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion or config/entity-only tasks | `pnpm --filter stocksync-api typecheck && pnpm test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Sales

Shared stock change, schema, endpoint, history.

```
T1 → T2 → T3 → T4
```

---

## Task Breakdown

### T1: Multi-product stock change

**What**: Replace `applyStockChange` with `applyStockChanges(tx, changes, { notFoundMessage })` (sorted locks, every shortage in one 409), backed by `lockActiveProductsStock` and `insertStockMovements`; the adjustment calls it with one change and its 409 assertion uses the detailed message.
**Where**: `apps/backend/src/modules/stock-movements/stock-movements.service.ts`
**Depends on**: None
**Reuses**: `lockActiveProductStock` (replaced by `lockActiveProductsStock`), `updateProductStock`, `insertStockMovement`
**Requirement**: SALE-19, SALE-27, SALE-28

**Done when**:

- [x] Existing adjustment tests pass with the 409 message `Insufficient stock for CAM-P (available: 25, requested: 26)`

**Tests**: integration
**Gate**: full

---

### T2: Sales schema and migration

**What**: `sales` and `sale_items` tables, `stock_movements.sale_id` with its FK and CHECK, `stock_movements.created_at` defaulting to `clock_timestamp()` (found in T3, see design), the generated migration, and raw-insert tests for the new movement CHECK.
**Where**: `apps/backend/src/infra/schemas/sales.ts`
**Depends on**: T1
**Reuses**: `src/infra/schemas/stock-movements.ts` constraint style
**Requirement**: SALE-31, SALE-32, SALE-33, SALE-34

**Done when**:

- [x] Migration generated and applied by the test global setup
- [x] A `sale` movement without `sale_id` and an `adjustment` with a `sale_id` are rejected

**Tests**: integration
**Gate**: full

---

### T3: Sales module and endpoint

**What**: `POST /sales` (validation, repository, service with write-first idempotency, routes, mount) and `sales.test.ts` covering the prompt's test list.
**Where**: `apps/backend/src/modules/sales/`
**Depends on**: T2
**Reuses**: `applyStockChanges`, `requireAuth`, `formatZodIssues`, stock-movements test helpers pattern
**Requirement**: SALE-01, SALE-02, SALE-03, SALE-04, SALE-05, SALE-06, SALE-07, SALE-08, SALE-09, SALE-10, SALE-11, SALE-12, SALE-13, SALE-14, SALE-15, SALE-16, SALE-17, SALE-18, SALE-20, SALE-21, SALE-22, SALE-23, SALE-24, SALE-25, SALE-26, SALE-30

**Done when**:

- [x] Every case of the prompt's Tests section passes

**Tests**: integration
**Gate**: full

---

### T4: `saleId` in the movement history

**What**: `movementColumns` exposes `saleId`; history and adjustment shape assertions include it; a sale movement shows its `saleId`.
**Where**: `apps/backend/src/modules/stock-movements/stock-movements.repository.ts`
**Depends on**: T3
**Reuses**: `movementColumns`
**Requirement**: SALE-29

**Done when**:

- [x] History returns `saleId` (null for initial/adjustment, the sale id for sales)

**Tests**: integration
**Gate**: build
