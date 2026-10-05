# Stock Movements Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: `.specs/features/stock-movements/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `CLAUDE.md` (module layout with `*.test.ts`), `apps/backend/vitest.config.ts`, `docs/prompts/03-stock-movements.md` (Tests section: all cases in `stock-movements.test.ts`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Routes (stock-movements, products create) | integration (supertest + real DB) | All routes: happy + every listed edge case + error paths | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| Service / repository / validation | covered through route tests | Every branch reached by a route test | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| Seed | integration (real DB) | Idempotency + one `initial` movement per product | `src/modules/stock-movements/stock-movements.test.ts` | `pnpm --filter stocksync-api test` |
| Schema CHECK constraints | integration (raw insert) | The two rejected inserts from the prompt | `src/modules/stock-movements/stock-movements.test.ts` | `pnpm --filter stocksync-api test` |
| Migration / agent docs | none | build gate only | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api test` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion or config/entity-only tasks | `pnpm --filter stocksync-api typecheck && pnpm test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Data

```
T1 → T2
```

### Phase 2: Endpoints

```
T3 → T4 → T5 → T6
```

---

## Task Breakdown

### T1: Stock movements schema and migration

**What**: `stock_movements` table with both enums, composite FKs, five CHECKs and the history index, the generated migration, and raw-insert tests proving the CHECKs reject `sale`+`in` and `adjustment`+`quantity 0`.
**Where**: `apps/backend/src/infra/schemas/stock-movements.ts`
**Depends on**: None
**Reuses**: `src/infra/schemas/products.ts`, `users.ts`
**Requirement**: MOV-26, MOV-27, MOV-28, MOV-29, MOV-30

**Done when**:

- [x] Migration generated and applied to `stocksync_test` by the test global setup
- [x] Raw inserts violating the CHECKs are rejected

**Tests**: integration
**Gate**: full

---

### T2: Initial movements in the seed

**What**: The seed records each new product's `initial` movement by the tenant's admin in the same transaction; tests assert exactly one `initial` movement per product after two runs.
**Where**: `apps/backend/src/infra/seed/seed.ts`
**Depends on**: T1
**Reuses**: `createProductIfMissing`
**Requirement**: MOV-31, MOV-32

**Done when**:

- [x] Seed test: 4 `initial` movements after two runs, one per product, quantity = stock, user = tenant admin
- [x] Build gate passes

**Tests**: integration
**Gate**: build

---

### T3: Initial movement on product creation

**What**: `insertStockMovement` repository, `recordInitialMovement` service, `createProduct` taking `userId` and recording the movement in its transaction.
**Where**: `apps/backend/src/modules/products/products.service.ts`
**Depends on**: None (runs after Phase 1)
**Reuses**: `createProduct` transaction
**Requirement**: MOV-13, MOV-14, MOV-15, MOV-22

**Done when**:

- [x] Tests: `POST /products` records `initial` for stock 12 and stock 0; existing products tests still pass unchanged

**Tests**: integration
**Gate**: full

---

### T4: applyStockChange and the adjustment endpoint

**What**: `lockActiveProductStock`/`updateProductStock`, `applyStockChange`, `createStockAdjustmentSchema`, `findStockMovementById`, `POST /products/:id/stock-adjustments` (admin) mounted in `createApp()`, with tests.
**Where**: `apps/backend/src/modules/stock-movements/stock-movements.service.ts`
**Depends on**: T3
**Reuses**: `parseProductId`, `requireAuth`, `requireRole`, `formatZodIssues`
**Requirement**: MOV-01, MOV-02, MOV-03, MOV-04, MOV-05, MOV-06, MOV-17, MOV-18, MOV-19, MOV-20, MOV-21, MOV-23, MOV-24, MOV-25

**Done when**:

- [x] Tests cover `in`/`out` effect and shape, 409s with no change, 403, 401, cross-tenant 404 with stock unchanged, soft-deleted and non-uuid 404, every validation 400

**Tests**: integration
**Gate**: full

---

### T5: History endpoint

**What**: `listStockMovementsQuerySchema`, `listStockMovements`, `GET /products/:id/stock-movements` (admin, operator), with tests.
**Where**: `apps/backend/src/modules/stock-movements/stock-movements.routes.ts`
**Depends on**: T4
**Reuses**: products listing pagination
**Requirement**: MOV-07, MOV-08, MOV-09, MOV-10, MOV-11, MOV-12, MOV-16

**Done when**:

- [x] Tests cover order, pagination + total, page past the end, invalid page/limit, operator 200, 401, cross-tenant/soft-deleted/non-uuid 404, soft-deleted user still shown, latest `stockAfter` = stock

**Tests**: integration
**Gate**: full

---

### T6: Append-only rule in agent docs

**What**: Database bullet in `CLAUDE.md` and `AGENTS.md` (identical) stating the append-only exception for `stock_movements`.
**Where**: `CLAUDE.md`
**Depends on**: T5
**Requirement**: MOV-26

**Done when**:

- [x] `diff CLAUDE.md AGENTS.md` is empty
- [x] Build gate passes

**Tests**: none
**Gate**: build
