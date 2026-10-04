# Products Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: `.specs/features/products/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `CLAUDE.md` (module layout with `*.test.ts`), `apps/backend/vitest.config.ts`, `docs/prompts/02-products.md` (Tests section).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Routes (products) | integration (supertest + real DB) | All routes: happy + every listed edge case + error paths | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| Service / repository / validation | covered through route tests | Every branch reached by a route test | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| Seed | integration (real DB) | Idempotency + created rows | `src/infra/seed/*.test.ts` | `pnpm --filter stocksync-api test` |
| Schema / migration | none | build gate only | - | build gate only |

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

### T1: Products schema and migration

**What**: `products` table as specified, plus the migration generated with `db:generate`.
**Where**: `apps/backend/src/infra/schemas/products.ts`
**Depends on**: None
**Reuses**: `src/infra/schemas/users.ts`, `columns.ts`
**Requirement**: PROD-36, PROD-37

**Done when**:

- [x] Migration generated and applied cleanly to `stocksync_test` by the test global setup
- [x] Typecheck passes

**Tests**: none
**Gate**: build

---

### T2: Product seed

**What**: Two products per seed tenant (one with `stock: 0`, `CAM-P` in both), inserted only if the tenant has no active product with that SKU; seed test asserts the rows and idempotency.
**Where**: `apps/backend/src/infra/seed/seed.ts`
**Depends on**: T1
**Reuses**: `createUserIfMissing` pattern
**Requirement**: PROD-38, PROD-39

**Done when**:

- [x] Seed test: 4 products after two runs, `CAM-P` in both tenants, one out-of-stock product per tenant

**Tests**: integration
**Gate**: full

---

### T3: Read endpoints

**What**: Validation (`productIdSchema`, `listProductsQuerySchema`), repository reads, service `listProducts`/`getProduct`, routes `GET /products` and `GET /products/:id` mounted in `createApp()`, with tests for listing, search, filters, pagination, order, 401, isolation on reads and non-uuid 404.
**Where**: `apps/backend/src/modules/products/`
**Depends on**: None (runs after Phase 1)
**Reuses**: `auth` module layout, `requireAuth`, `formatZodIssues`
**Requirement**: PROD-07, PROD-08, PROD-09, PROD-17, PROD-19, PROD-20, PROD-26, PROD-27, PROD-28, PROD-29, PROD-30, PROD-31, PROD-32, PROD-33, PROD-34, PROD-35

**Done when**:

- [x] Route tests cover every listed AC

**Tests**: integration
**Gate**: full

---

### T4: Create endpoint

**What**: `createProductSchema`, `insertProduct`/`findActiveProductBySku`, service `createProduct` in a transaction with the duplicate check, `POST /products` (admin only), with tests.
**Where**: `apps/backend/src/modules/products/`
**Depends on**: T3
**Requirement**: PROD-01, PROD-02, PROD-03, PROD-05, PROD-06, PROD-18, PROD-21, PROD-22, PROD-23, PROD-24, PROD-25

**Done when**:

- [x] Route tests cover 201 shape, normalization, 409 incl. case, cross-tenant SKU, 403, every validation 400

**Tests**: integration
**Gate**: full

---

### T5: Update endpoint

**What**: `updateProductSchema`, `updateProduct` repository, service in a transaction, `PATCH /products/:id` (admin only), with tests.
**Where**: `apps/backend/src/modules/products/`
**Depends on**: T4
**Requirement**: PROD-10, PROD-11, PROD-12, PROD-13

**Done when**:

- [x] Route tests cover update of each field, SKU/stock untouched, `{}` 400, 404 cases, 403

**Tests**: integration
**Gate**: full

---

### T6: Delete endpoint

**What**: `softDeleteProduct` repository, service in a transaction, `DELETE /products/:id` (admin only), with tests including re-creating a deleted SKU.
**Where**: `apps/backend/src/modules/products/`
**Depends on**: T5
**Requirement**: PROD-04, PROD-14, PROD-15, PROD-16

**Done when**:

- [x] Route tests cover 204, hidden from list and GET, second delete 404, cross-tenant 404, SKU reusable, 403
- [x] Build gate passes

**Tests**: integration
**Gate**: build
