# Sync Events Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: `.specs/features/sync-events/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md` (module layout with `*.test.ts`), `apps/backend/vitest.config.ts`, `docs/prompts/05-sync.md` (Tests section), confirmed lessons L-006/L-007.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Services writing events | integration (supertest + real DB) | Every flow: event recorded, and no event on failure | `src/modules/sync/*.test.ts` | `pnpm --filter stocksync-api test` |
| Schema CHECKs and FK | integration (raw insert) | Every CHECK and the composite FK, asserting the constraint name | `src/modules/sync/*.test.ts` | `pnpm --filter stocksync-api test` |
| Seed | integration | One event per created product, idempotent | `src/infra/seed/seed.test.ts` | `pnpm --filter stocksync-api test` |
| Migration | none | build gate only | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api test` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion or config/entity-only tasks | `pnpm --filter stocksync-api typecheck && pnpm test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Outbox

```
T1 → T2 → T3 → T4
```

---

## Task Breakdown

### T1: `sync_events` schema and migration

**What**: Enums, table, constraints and indexes; generated migration; raw-insert tests for every CHECK and the composite FK.
**Where**: `apps/backend/src/infra/schemas/sync-events.ts`
**Depends on**: None
**Reuses**: `src/infra/schemas/stock-movements.ts` constraint style
**Requirement**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05

**Done when**:

- [x] Migration generated and applied by the test global setup
- [x] Each CHECK and the FK reject a bad row with their constraint name

**Tests**: integration
**Gate**: full

---

### T2: `recordSyncEvent` and creation/stock flows

**What**: `sync.repository.ts`/`sync.service.ts`; `createProduct` and `applyStockChanges` record events.
**Where**: `apps/backend/src/modules/sync/`
**Depends on**: T1
**Reuses**: `applyStockChanges`, `createProduct`
**Requirement**: SYNC-06, SYNC-07, SYNC-08, SYNC-09, SYNC-17

**Done when**:

- [x] Creation (stock 0 included), sale with two products, adjustment record the right events; a 409 sale/adjustment and a duplicate SKU record none

**Tests**: integration
**Gate**: full

---

### T3: Lock, decide, write in update and delete

**What**: `updateProduct`/`deleteProduct` read through `lockActiveProductsStock`, record `price_changed`/`product_deleted`.
**Where**: `apps/backend/src/modules/products/products.service.ts`
**Depends on**: T2
**Reuses**: `lockActiveProductsStock`, `recordSyncEvent`
**Requirement**: SYNC-10, SYNC-11, SYNC-12, SYNC-13, SYNC-14, SYNC-15

**Done when**:

- [x] Price change, same price, name-only, name + price, delete, concurrent PATCHes and delete + recreate versions pass

**Tests**: integration
**Gate**: full

---

### T4: Seed records events

**What**: `createProductIfMissing` inserts a `product_created` event; seed test asserts one per product and idempotency.
**Where**: `apps/backend/src/infra/seed/seed.ts`
**Depends on**: T3
**Reuses**: `syncEvents` schema
**Requirement**: SYNC-16

**Done when**:

- [x] Seed twice leaves exactly four `product_created` events

**Tests**: integration
**Gate**: build
