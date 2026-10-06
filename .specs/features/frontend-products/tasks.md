# Frontend Products Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: inline. `src/lib/format.ts` (`formatCents`); `src/api/products.ts` (`listProducts`, `productsQuery` with `placeholderData: keepPreviousData`, keys under `["products"]`); `routes/_auth/products.tsx` with a Zod `validateSearch` and `stripSearchParams({ page: 1 })`; components `products/product-filters.tsx` (debounced search + shadcn Select), `products/products-table.tsx` (table, skeleton, empty and error states), `pagination.tsx`. shadcn `table`, `select`, `skeleton` added via the CLI with imports checked.
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md` (no frontend testing rules), `docs/prompts/06-frontend.md` (Tests > Products list). Style follows `apps/frontend/src/routes/_auth.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Formatting helper | unit | Every formatting rule in the spec | `apps/frontend/src/lib/*.test.ts` | `pnpm --filter frontend test` |
| Route and components | integration (Testing Library + router + MSW) | Every AC and edge case | `apps/frontend/src/routes/_auth/products.test.tsx` | `pnpm --filter frontend test` |
| shadcn primitives | none | build gate only (vendored library code) | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter frontend test` |
| Full | After tasks with integration tests | `pnpm --filter frontend test && pnpm --filter frontend typecheck` |
| Build | After phase completion or config-only tasks | `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` |

---

## Execution Plan

### Phase 1: Products

```
T1 → T2 → T3 → T4 → T5
```

---

## Task Breakdown

### T1: shadcn primitives

**What**: Add shadcn `table`, `select`, `skeleton`; fix any wrong import the CLI writes.
**Where**: `apps/frontend/src/components/ui/`
**Depends on**: None
**Reuses**: `components.json`
**Requirement**: PROD-01, PROD-04, PROD-10

**Done when**:

- [x] Components compile; `radix-ui` stays the only Radix dependency

**Tests**: none
**Gate**: build

---

### T2: Price formatting

**What**: `formatCents(cents)` with `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })` and its unit test.
**Where**: `apps/frontend/src/lib/format.ts`
**Depends on**: T1
**Reuses**: none
**Requirement**: PROD-02

**Done when**:

- [x] `formatCents` tests pass

**Tests**: unit
**Gate**: quick

---

### T3: Products query and table

**What**: `src/api/products.ts`; the route's search schema; `ProductsTable` with rows, badge, skeleton, empty (both variants) and error + Retry; tests.
**Where**: `apps/frontend/src/routes/_auth/products.tsx`
**Depends on**: T2
**Reuses**: `apiFetch`, `PageHeader`, `renderApp`, `signedIn`
**Requirement**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, PROD-07, PROD-08, PROD-11

**Done when**:

- [x] Every listed AC has a test asserting the spec value
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T4: Search and stock filter

**What**: `ProductFilters` with the debounced search input and the stock Select, both labelled, writing to the URL and following it on back/forward; tests.
**Where**: `apps/frontend/src/components/products/product-filters.tsx`
**Depends on**: T3
**Reuses**: route `navigate` with functional search updates
**Requirement**: PROD-09, PROD-10, PROD-12

**Done when**:

- [x] Debounce, page reset, filter values and back/forward are tested
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T5: Pagination

**What**: `Pagination` with Previous/Next and "Page X of Y", disabled ends, previous rows kept while loading, and the empty-page edge case; tests.
**Where**: `apps/frontend/src/components/pagination.tsx`
**Depends on**: T4
**Reuses**: `meta.total`, `PAGE_SIZE`
**Requirement**: PROD-13, PROD-14, PROD-15, PROD-16

**Done when**:

- [x] Pagination ACs and the page-past-the-end edge case are tested
- [x] Build gate passes

**Tests**: integration
**Gate**: build
