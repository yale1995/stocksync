# Products Validation

## Validation: products - PASS

**Date**: 2026-10-04
**Spec**: `.specs/features/products/spec.md` (PROD-01..PROD-39)
**Diff range**: uncommitted working tree on `feat/products` vs HEAD 83afb70 (modified: `apps/backend/src/app.ts`, `src/infra/seed/seed.ts`, `src/infra/seed/seed.test.ts`, `src/infra/migrations/meta/_journal.json`; untracked: `src/infra/schemas/products.ts`, `src/infra/migrations/0001_watery_silver_centurion.sql`, `src/infra/migrations/meta/0001_snapshot.json`, `src/modules/products/{products.routes,products.service,products.repository,products.validation,products.test}.ts`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 0 (first verification)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Schema + migration | ✅ Done | `apps/backend/src/infra/schemas/products.ts:14-37`, `infra/migrations/0001_watery_silver_centurion.sql:1-18` |
| T2 Seed | ✅ Done | `apps/backend/src/infra/seed/seed.ts` (`createProductIfMissing`), `seed.test.ts` |
| T3 Read endpoints | ✅ Done | `products.routes.ts:35-45` |
| T4 Create endpoint | ✅ Done | `products.routes.ts:47-52`, `products.service.ts:30-45` |
| T5 Update endpoint | ✅ Done | `products.routes.ts:54-60`, `products.service.ts:47-60` |
| T6 Delete endpoint | ✅ Done | `products.routes.ts:62-66`, `products.service.ts:62-71` |

---

## Spec-Anchored Acceptance Criteria

Test paths are relative to `apps/backend/src/`. `P` = `modules/products/products.test.ts`.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| PROD-01 create | 201, `{ id, sku, name, priceCents, stock, createdAt, updatedAt }`, no `tenantId`/`deletedAt` | `P:445` `expect(response.status).toBe(201)`; `P:446` `expect(Object.keys(response.body).sort()).toEqual(productKeys)` (exact key set excludes `tenantId`, `deletedAt`); `P:449-454` `toEqual({ id: stored.id, ...validProduct, createdAt, updatedAt })` | ✅ PASS |
| PROD-02 SKU trimmed + uppercased | `  mug-01.b_x ` stored as `MUG-01.B_X` | `P:465` `expect(response.body.sku).toBe("MUG-01.B_X")`; `P:466` stored row `.sku` `toBe("MUG-01.B_X")` | ✅ PASS |
| PROD-03 duplicate SKU (case-insensitive) | 409 `CONFLICT` | `P:519-525` `toBe(409)` + `toEqual({ error: { code: "CONFLICT", message: "A product with SKU CAM-P already exists" } })`; case variant ` cam-p ` `P:534-535` `toBe(409)`, code `CONFLICT` | ✅ PASS |
| PROD-04 SKU reusable after soft delete | 201 | `P:772` `expect(response.status).toBe(201)`; `P:773` sku `CAM-P`; `P:774` new id `not.toBe(camP.id)` | ✅ PASS |
| PROD-05 SKU used by another tenant | 201 | `P:544` `toBe(201)`; `P:546` stored in Globex with the returned id | ✅ PASS |
| PROD-06 explicit check before insert, in a transaction | query → `ConflictError` → insert, inside `db.transaction` | **Inspection**: `modules/products/products.service.ts:34-44` (`db.transaction`, `findActiveProductBySku(..., tx)`, `throw new ConflictError`, then `insertProduct(..., tx)`). Behavioral: mutant M6 (check removed) killed by `P:519` (insert would hit the unique index → 500, not 409) | ✅ PASS (inspection + sensor) |
| PROD-07 GET by id (admin, operator) | 200 with product shape | admin `P:373-382` `toBe(200)` + exact `toEqual({...})`; operator `P:392-393` `toBe(200)`, `body.id` | ✅ PASS |
| PROD-08 GET missing / deleted / other tenant | 404 `NOT_FOUND` | other tenant `P:403-404`; soft deleted `P:418-419`; unknown uuid `P:427-428` - each `toBe(404)` + `toEqual(notFoundBody)` | ✅ PASS |
| PROD-09 non-uuid `:id` on GET/PATCH/DELETE | 404 `NOT_FOUND` | GET `P:436-437`; PATCH `P:714-715`; DELETE `P:790-791` - `toBe(404)` + `toEqual(notFoundBody)` | ✅ PASS |
| PROD-10 PATCH name/priceCents | 200, updated product, refreshed `updatedAt` | `P:605` `toBe(200)`; `P:608-616` exact body; `P:617-619` `after.updatedAt > before.updatedAt`; single-field updates `P:627-628`, `P:636-637` (price `0`) | ✅ PASS |
| PROD-11 PATCH never changes sku/stock | sku and stock unchanged | `P:651` `stored.sku` `toBe("CAM-P")`; `P:652` `stored.stock` `toBe(25)`; `P:653` response same | ✅ PASS |
| PROD-12 PATCH without name/priceCents | 400 `VALIDATION_ERROR`, message contains `At least one field is required` | `P:664-668` for `{}` and `{ sku, stock }` - `toBe(400)`, code, `toContain("At least one field is required")` | ✅ PASS |
| PROD-13 PATCH missing / deleted / other tenant | 404 `NOT_FOUND` | other tenant `P:693-695` (+ row unchanged); soft deleted `P:707-708`; non-uuid `P:714-715` | ✅ PASS (see observation O1) |
| PROD-14 DELETE | sets `deleted_at`, 204 no body | `P:735` `toBe(204)`; `P:736` `response.text` `toBe("")`; `P:738` `stored.deletedAt` `toBeInstanceOf(Date)` | ✅ PASS |
| PROD-15 deleted excluded from list and GET | absent from list, GET 404 | `P:750-753` list `["BON-01"]`, total 1, GET 404 + body; also `P:173-174`, `P:418-419` | ✅ PASS |
| PROD-16 DELETE already deleted / missing / other tenant | 404 `NOT_FOUND` | already deleted `P:762-763`; other tenant `P:782-784` (+ row still active); non-uuid `P:790-791` | ✅ PASS (see observation O1) |
| PROD-17 no cookie / invalid / expired token | 401 `UNAUTHORIZED` | no cookie: GET list + GET id `P:811-812`, POST `P:821-822`, PATCH `P:832-833`, DELETE `P:841-843`; invalid token `P:849-850`. Expired: router-wide `requireAuth` (`products.routes.ts:33`) proven at `http/require-auth.test.ts:134` (expired → 401) | ✅ PASS |
| PROD-18 operator on POST/PATCH/DELETE | 403 `FORBIDDEN` | POST `P:552-558` (+ no row inserted); PATCH `P:723-725` (+ unchanged); DELETE `P:799-801` (+ still active) | ✅ PASS |
| PROD-19 tenantId only from `req.auth`; every query filtered by tenant + `deleted_at IS NULL` | ignored in query/body; all queries filtered | query `?tenantId=` ignored `P:161-162`; body `tenantId` ignored `P:510-513`; inspection `products.repository.ts:30-32` (`isActiveInTenant`) used at `:46`, `:59`, `:86`, `:99`, `:115`. Sensor M1, M2, M15, M16, M24 killed; M27 equivalent (see sensor) | ✅ PASS |
| PROD-20 list only own tenant | no products of other tenant | `P:149-153` total 2, Globex `CAM-P` id and `CAN-01` absent; `P:310-313` search for a Globex-only name returns `[]`, total 0 | ✅ PASS |
| PROD-21 invalid SKU | 400 `VALIDATION_ERROR` | `P:562-565` (invalid chars, slash, blank, 65 chars) → `P:578-579` `toBe(400)` + code; 64 chars accepted `P:499` | ✅ PASS |
| PROD-22 invalid name | 400 | POST `P:566-567`, PATCH `P:672-673` → `toBe(400)` + code; 200 chars accepted `P:488`, `P:498`; trimmed `P:475` | ✅ PASS |
| PROD-23 invalid priceCents; 0 accepted | 400; 0 → 201 | POST `P:568-571` (negative, 10.5, 100,000,001, string), PATCH `P:674-676`; 0 accepted `P:497`, `P:636`; max accepted `P:498` | ✅ PASS |
| PROD-24 invalid stock | 400 | `P:572-574` (negative, 1.5, 1,000,001); 0 and max accepted `P:497-498` | ✅ PASS |
| PROD-25 missing field on POST | 400 | `P:582-592` for each of the 4 fields: `toBe(400)`, code, message `^<field>: ` | ✅ PASS |
| PROD-26 list shape + defaults | 200 `{ data, meta: { page: 1, limit: 20, total } }` | `P:122-123` `toBe(200)`, `meta` `toEqual({ page: 1, limit: 20, total: 2 })`; item shape `P:125-134` | ✅ PASS |
| PROD-27 invalid page / limit | 400 | `P:211-224` (`page=0,-1,1.5,abc`, `limit=0,101,2.5`, repeated `page`) → `toBe(400)` + code; boundaries `P:207-208` | ✅ PASS |
| PROD-28 page past the end | 200, `data: []`, real total | `P:197-201` `toEqual({ data: [], meta: { page: 5, limit: 2, total: 2 } })` | ✅ PASS |
| PROD-29 search name/SKU, case-insensitive, trimmed, empty ignored | matching rows | name `P:252-253`; SKU `P:259`; substring `P:265`; trimmed `P:271`; empty/blank `P:278-279` | ✅ PASS |
| PROD-30 `%`, `_`, `\` literal | only literal matches | `%` `P:287-288`; `_` `P:296`; `\` `P:304` - each `toEqual([single sku])` | ✅ PASS |
| PROD-31 search > 100 chars | 400 | `P:320-322` 100 → 200, 101 → 400 + code | ✅ PASS |
| PROD-32 outOfStock true/false/absent | `stock = 0` / `> 0` / all | true `P:330-331`; false `P:337-338`; absent `P:124`; combined `P:347-350` | ✅ PASS |
| PROD-33 invalid outOfStock | 400 | `P:353-359` (`yes`, `1`, `TRUE`, empty) → `toBe(400)` + code | ✅ PASS |
| PROD-34 order `name asc, id asc` | names ascending, ties by id ascending | `P:240-245` names `["Aaa","Boné","Camiseta P","Same","Same"]`, tied ids `toEqual(sameIds)` (sorted asc) | ✅ PASS |
| PROD-35 total uses same filters | total equals filtered count | `P:191` total 5 with pagination; `P:253`, `P:288`, `P:331`, `P:338`, `P:350` totals under search/outOfStock; sensor M17 killed | ✅ PASS |
| PROD-36 table columns | uuid `uuidv7()`, `tenant_id` FK, sku, name, price_cents, stock, timestamptz timestamps, nullable `deleted_at` | **Inspection**: `infra/migrations/0001_watery_silver_centurion.sql:2-10`, FK `:17`; `infra/schemas/products.ts:17-25` | ✅ PASS (inspection) |
| PROD-37 constraints | partial unique `(tenant_id, sku) WHERE deleted_at IS NULL`, unique `(tenant_id, id)`, checks upper/price/stock | **Inspection**: `0001_watery_silver_centurion.sql:18` (partial unique index), `:11` (unique tenant_id,id), `:12-14` (three checks) | ✅ PASS (inspection) |
| PROD-38 seed products | 2 per tenant, one `stock: 0`, `CAM-P` in Acme and Globex | `infra/seed/seed.test.ts:66-71` `toEqual([{Acme BON-01 0}, {Acme CAM-P 25}, {Globex CAM-P 10}, {Globex CAN-01 0}])` | ✅ PASS |
| PROD-39 seed idempotent | no duplicates on second run | `infra/seed/seed.test.ts:84` `expect(productCount?.value).toBe(4)` after two runs; sensor M29 killed | ✅ PASS |

**Status**: ✅ All 39 ACs covered with spec-matching assertions. 0 spec-precision gaps.

### Observations (non-blocking)

- **O1**: For PATCH and DELETE, the "missing" sub-case (a valid uuid that matches no row) has no dedicated test. It is only exercised on GET (`P:422-428`). For PATCH and DELETE it shares the code path with the "other tenant" case, which is tested. `findActiveProductById` returns `undefined` in both cases, so `NotFoundError` is thrown at `products.service.ts:54` and `:65`. No mutant can tell the two apart, so this is not counted as a gap.
- **O2**: PROD-17 "invalid token" is exercised on `GET /products` only, and "expired" only at the middleware level. This is sufficient because `requireAuth` is mounted router-wide (`products.routes.ts:33`).

---

## Discrimination Sensor

Isolated scratch: a temporary `git worktree` at HEAD 83afb70 under the session scratchpad. The uncommitted feature files and `apps/backend/.env` were copied in, then `pnpm install --offline`. All 98 products and seed tests passed before any mutation. Each mutation was applied, tested with `vitest run src/modules/products src/infra/seed` (one run at a time) and reverted. The worktree was then removed with `git worktree remove --force`. The real tree's `git status --porcelain` matched the baseline before and after.

| # | File:line (real tree) | Mutation | Killed? |
| - | --------------------- | -------- | ------- |
| M1 | `products.repository.ts:31` | drop `tenantId` from `isActiveInTenant` (all queries) | ✅ Killed (list isolation, shape, pagination tests) |
| M2 | `products.repository.ts:31` | drop `deleted_at IS NULL` from `isActiveInTenant` | ✅ Killed (6 tests: list/GET/PATCH/DELETE soft-delete, SKU reuse) |
| M3 | `products.repository.ts:35` | LIKE escaping removed | ✅ Killed (`%`, `_`, `\` tests) |
| M4 | `products.repository.ts:35` | escaping misses `\` | ✅ Killed (`P:299`) |
| M5 | `products.repository.ts:122-123` | outOfStock branches flipped | ✅ Killed (3 tests) |
| M6 | `products.service.ts:40` | SKU duplicate check removed | ✅ Killed (`P:516`, `P:528`) |
| M7 | `products.repository.ts:130` | tiebreaker `id asc` → `id desc` | ✅ Killed (`P:227`) |
| M8 | `products.repository.ts:132` | offset `(page-1)*limit` → `page*limit` | ✅ Killed (pagination + list tests) |
| M9 | `products.validation.ts:22` | PATCH schema accepts `sku` and `stock` | ✅ Killed (`P:640`) |
| M10 | `products.routes.ts:65` | DELETE 204 → 200 | ✅ Killed (4 tests) |
| M11 | `products.routes.ts:51` | POST 201 → 200 | ✅ Killed (6 tests) |
| M12 | `products.routes.ts:47` | `requireRole("admin")` removed from POST | ✅ Killed (`P:549`) |
| M13 | `products.routes.ts:54` | `requireRole("admin")` removed from PATCH | ✅ Killed (`P:718`) |
| M14 | `products.routes.ts:62` | `requireRole("admin")` removed from DELETE | ✅ Killed (`P:794`) |
| M15 | `products.repository.ts:59` | SKU lookup ignores tenant | ✅ Killed (`P:538`, `P:766`) |
| M16 | `products.repository.ts:59` | SKU lookup includes soft-deleted rows | ✅ Killed (`P:766`) |
| M17 | `products.repository.ts:136` | `total` ignores search/outOfStock | ✅ Killed (6 tests) |
| M18 | `products.repository.ts:117` | search on name only | ✅ Killed (`P:256`, `P:291`) |
| M19 | `products.validation.ts:37` | search not trimmed | ✅ Killed |
| M20 | `products.routes.ts:27` | non-uuid id → `ValidationError` (400) | ✅ Killed (3 tests) |
| M21 | `products.validation.ts:6` | SKU not uppercased | ✅ Killed (3 tests) |
| M22 | `products.validation.ts:34` | `limit` max 100 → 1000 | ✅ Killed (`limit=101`) |
| M23 | `products.service.ts:17` | `meta.page` hard-coded to 1 | ✅ Killed |
| M24 | `products.routes.ts:51` | create takes `tenantId` from body when present | ✅ Killed (`P:502`) |
| M25 | `products.repository.ts:98` | soft delete does not set `deleted_at` | ✅ Killed (4 tests) |
| M26 | `products.repository.ts:20-28` | response leaks `tenantId` | ✅ Killed (4 shape tests) |
| M27 | `products.repository.ts:86` | `updateProduct` UPDATE drops tenant/deleted filter | ⚪ Survived - **equivalent mutant**: the service runs `findActiveProductById(tenantId, id, tx)` first in the same transaction (`products.service.ts:53-54`), and a product's tenant never changes, so no request can observe the difference. The filter is defense in depth required by `CLAUDE.md`, confirmed present by inspection. |
| M28 | `products.service.ts:26` | GET drops the existence check | ✅ Killed (4 tests) |
| M29 | `infra/seed/seed.ts` (`createProductIfMissing`) | seed idempotency check removed | ✅ Killed (`seed.test.ts:84`) |
| M30 | `products.validation.ts:23-26` | PATCH refine removed (`{}` accepted) | ✅ Killed (`P:656`) |
| M31 | `products.repository.ts:123` | `outOfStock=false` treated as absent | ✅ Killed (`P:334`) |

**Sensor depth**: P0-expanded (tenant isolation), 31 manual behavior-level mutations
**Result**: 30/30 non-equivalent mutants killed, 1 equivalent (M27) - PASS ✅

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ (`app.ts` +2 lines, seed extended in its own pattern) |
| No scope creep | ✅ (no movements, no `version`, no sort options) |
| Matches patterns (auth module layout, `executor: Executor = db`, `safeParse` → `ValidationError`) | ✅ |
| `CLAUDE.md` database rules: explicit plural table name, soft delete, timestamptz, explicit check before write, partial unique index | ✅ |
| Comments only for non-obvious why (`products.routes.ts:23-24`, `schemas/products.ts:31`) | ✅ |
| Spec-anchored outcome check | ✅ |
| Per-layer coverage: routes cover happy + edge + error for all 5 routes | ✅ |
| Every test maps to a spec AC, edge case or Done-when | ✅ |
| Documented guidelines followed: `CLAUDE.md`, `docs/prompts/02-products.md` | ✅ |

---

## Edge Cases

- [x] SKU differing only by case → 409 (`P:528-536`)
- [x] `search=%` matches only a literal `%` (`P:282-289`)
- [x] Equal names ordered by `id` (`P:227-246`)

---

## Gate Check

- **Gate command**: `pnpm --filter stocksync-api typecheck && pnpm test && pnpm lint:check`
- **Result**: typecheck exit 0; `pnpm test` exit 0, **152 passed**, 0 failed, 0 skipped (8 files); biome "Checked 46 files, No fixes applied"
- **Test count before feature**: 57 (152 − 94 new products tests − 1 new seed test)
- **Test count after feature**: 152
- **Delta**: +95 (94 in `products.test.ts`, 1 in `seed.test.ts`; the existing idempotency test was strengthened with a product count)
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| PROD-01..PROD-39 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 39/39 ACs matched the spec outcome, 0 spec-precision gaps
**Sensor**: 31 mutations, 30 killed, 1 equivalent (M27), 0 non-equivalent survivors
**Gate**: 152 passed, typecheck and lint clean

**What works**: CRUD with soft delete, tenant isolation on list/GET/PATCH/DELETE and on SKU uniqueness, admin-only writes, validation, pagination/search/filter/order, seed.

**Issues found**: none blocking. Optional hardening: add PATCH and DELETE tests for an unknown valid uuid (O1).

**Next steps**: user review, then commit with the `commit` skill.
