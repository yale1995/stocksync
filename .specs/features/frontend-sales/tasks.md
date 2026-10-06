# Frontend Sales Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: inline.
- `src/api/products.ts` gains `getProduct` / `productQuery(id, initialData?)` (key `["products", "detail", id]`); `src/api/sales.ts` has `createSale(items, idempotencyKey)`.
- Form state lives in `src/components/sales/use-sale-form.ts` (a reducer of lines plus the idempotency key; every line change regenerates the key).
- The route `_auth/sales.new.tsx` loads each line's product with `useQueries`, validates the lines (`validateLine`), submits with `useMutation`, and renders `SaleOutcome` (alert or summary) above `SaleLinesCard`.
- `ProductPicker` is shadcn Popover + Command with a debounced server search (`shouldFilter={false}`) that excludes products already chosen.
- shadcn `popover` and `command` come from the CLI, with imports checked.

**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md` (no frontend testing rules), `docs/prompts/06-frontend.md` (Tests > New sale). Style follows `apps/frontend/src/routes/_auth/products.test.tsx` and `src/components/products/product-filters.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Form reducer / validation | unit | Every rule in the spec (key regeneration, validation messages) | `apps/frontend/src/components/sales/*.test.ts` | `pnpm --filter frontend test` |
| Route and components | integration (Testing Library + router + MSW) | Every AC and edge case | `apps/frontend/src/routes/_auth/sales.new.test.tsx` | `pnpm --filter frontend test` |
| shadcn primitives | none | build gate only (vendored library code) | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter frontend test` |
| Full | After tasks with integration tests | `pnpm --filter frontend test && pnpm --filter frontend typecheck` |
| Build | After phase completion or config-only tasks | `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` |

---

## Execution Plan

### Phase 1: New sale

```
T1 → T2 → T3 → T4 → T5 → T6
```

---

## Task Breakdown

### T1: shadcn primitives

**What**: Add shadcn `popover` and `command` (cmdk) via the CLI; fix wrong imports; add a `ResizeObserver` shim to the test setup.
**Where**: `apps/frontend/src/components/ui/`
**Depends on**: None
**Reuses**: `components.json`
**Requirement**: SALE-04

**Done when**:

- [x] Components compile; only `cmdk` is added besides existing deps

**Tests**: none
**Gate**: build

---

### T2: Form state and validation

**What**: `use-sale-form.ts` reducer (add, remove, pick, set quantity, reset; new key on every change) and `validateLine`; unit tests.
**Where**: `apps/frontend/src/components/sales/use-sale-form.ts`
**Depends on**: T1
**Reuses**: none
**Requirement**: SALE-09, SALE-12, SALE-13, SALE-14

**Done when**:

- [x] Key regeneration and every validation message are unit-tested

**Tests**: unit
**Gate**: quick

---

### T3: Lines card with picker

**What**: `productQuery`, `ProductPicker`, `SaleLinesCard` (lines, add/remove, stock, unit price, subtotal, total) and the route wiring without submit; integration tests.
**Where**: `apps/frontend/src/routes/_auth/sales.new.tsx`
**Depends on**: T2
**Reuses**: `productsQuery`, `formatCents`, `PageHeader`
**Requirement**: SALE-01, SALE-02, SALE-03, SALE-04, SALE-05, SALE-06, SALE-07

**Done when**:

- [x] Every listed AC has a test
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T4: Inline stock check

**What**: Quantity errors with `aria-invalid` / `aria-describedby`, unavailable product, disabled submit; tests.
**Where**: `apps/frontend/src/components/sales/sale-lines-card.tsx`
**Depends on**: T3
**Reuses**: `validateLine`
**Requirement**: SALE-08, SALE-09, SALE-10, SALE-11

**Done when**:

- [x] Every listed AC has a test
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T5: Submit with Idempotency-Key

**What**: `src/api/sales.ts`, `useMutation` submit, pending state, key reuse/regeneration through the real form; tests.
**Where**: `apps/frontend/src/api/sales.ts`
**Depends on**: T4
**Reuses**: `apiFetch`, `useSaleForm`
**Requirement**: SALE-12, SALE-13, SALE-14, SALE-15

**Done when**:

- [x] Same key on retry, new key after a change, one request on double click are tested
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T6: Outcomes

**What**: `SaleOutcome` (summary on 201, alerts on 409/404/400/network/5xx), reset and invalidation; tests.
**Where**: `apps/frontend/src/components/sales/sale-outcome.tsx`
**Depends on**: T5
**Reuses**: `Alert`, `formatCents`, `productKeys.all`
**Requirement**: SALE-16, SALE-17, SALE-18, SALE-19, SALE-20, SALE-21, SALE-22

**Done when**:

- [x] Every outcome and the edge cases are tested
- [x] Build gate passes

**Tests**: integration
**Gate**: build
