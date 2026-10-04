# Products Specification

## Problem Statement

Each tenant needs a product catalog (SKU, name, price, stock) that later pieces build on: stock movements, sales and the Part B sync with the external advertising service. Products must never cross tenants, writes must be admin-only and deleted products must free their SKU without losing history.

## Goals

- [ ] Admins create, edit and soft delete products; admins and operators list and read them
- [ ] A user of one tenant can never see or change another tenant's products (the isolation test the assessment requires)
- [ ] The listing is paginated with `page`/`limit`, searchable by name and SKU and filterable by out-of-stock
- [ ] The seed demonstrates isolation with the same SKU in both tenants

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Stock movements, `POST /products/:id/stock-adjustments`, movement history, initial movement on create | PR 4 |
| Sales, concurrency and idempotency | PR 5 |
| Part B sync, `version` column, ad of a deleted product | Part B |
| Configurable sort, cursor pagination, `(tenant_id, name)` index | Future improvements (README) |
| Frontend, README | Later pieces |
| Translating Postgres `23505` races into 409 | Accepted trade-off: a race past the explicit check becomes 500 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/02-products.md` | Applied as written | Agreed with the user | y |
| Unknown body fields (e.g. `sku`, `stock` on `PATCH`, extra keys on `POST`) | Stripped, not rejected | Same behavior as `loginSchema` (Zod default); `PATCH { sku }` alone becomes `{}` and gets 400 | y (plan approved) |
| Message for `PATCH {}` | `At least one field is required` (prefixed by `formatZodIssues` with an empty path) | `formatZodIssues` must not change | y (plan approved) |
| Conflict message | `A product with SKU <SKU> already exists` | Points to the normalized SKU | y (plan approved) |
| Repeated query params (`?page=1&page=2`) | 400 `VALIDATION_ERROR` | Coercion of an array is not a valid integer | y (plan approved) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Create a product ⭐ MVP

**User Story**: As an admin, I want to create products with an initial stock so that my tenant has a catalog.

**Acceptance Criteria**:

1. PROD-01: WHEN an admin posts a valid body to `POST /products` THEN the system SHALL respond 201 with `{ id, sku, name, priceCents, stock, createdAt, updatedAt }` and no `tenantId` or `deletedAt`
2. PROD-02: WHEN a product is created THEN the system SHALL store the SKU trimmed and uppercased (` cam-p ` → `CAM-P`)
3. PROD-03: IF an active product of the same tenant already has the SKU (case-insensitively) THEN the system SHALL respond 409 `CONFLICT`
4. PROD-04: WHEN the only product with that SKU in the tenant is soft deleted THEN the system SHALL accept creating the SKU again
5. PROD-05: WHEN tenant A creates a SKU that tenant B already uses THEN the system SHALL respond 201
6. PROD-06: The system SHALL check SKU duplicates with an explicit query before inserting, inside a transaction

**Independent Test**: admin posts a product, then the same SKU in lowercase.

---

### P1: Read products ⭐ MVP

**User Story**: As an admin or operator, I want to read a product by id.

**Acceptance Criteria**:

1. PROD-07: WHEN an admin or operator calls `GET /products/:id` for an active product of their tenant THEN the system SHALL respond 200 with the product shape
2. PROD-08: IF the product does not exist, is soft deleted or belongs to another tenant THEN the system SHALL respond 404 `NOT_FOUND`
3. PROD-09: IF `:id` is not a valid uuid THEN the system SHALL respond 404 `NOT_FOUND` on `GET`, `PATCH` and `DELETE`

---

### P1: Update a product ⭐ MVP

**User Story**: As an admin, I want to edit name and price without touching SKU or stock.

**Acceptance Criteria**:

1. PROD-10: WHEN an admin patches `name` and/or `priceCents` THEN the system SHALL respond 200 with the updated product and a refreshed `updatedAt`
2. PROD-11: The system SHALL never change `sku` or `stock` through `PATCH /products/:id`
3. PROD-12: IF the `PATCH` body has neither `name` nor `priceCents` THEN the system SHALL respond 400 `VALIDATION_ERROR` with a message containing `At least one field is required`
4. PROD-13: IF the product is missing, soft deleted or of another tenant THEN `PATCH` SHALL respond 404 `NOT_FOUND`

---

### P1: Delete a product ⭐ MVP

**User Story**: As an admin, I want to remove a product while keeping its row for history.

**Acceptance Criteria**:

1. PROD-14: WHEN an admin deletes an active product THEN the system SHALL set `deleted_at` and respond 204 with no body
2. PROD-15: WHEN a product is soft deleted THEN the system SHALL exclude it from the list and from `GET /products/:id`
3. PROD-16: IF the product is already deleted, missing or of another tenant THEN `DELETE` SHALL respond 404 `NOT_FOUND`

---

### P1: Authorization and isolation ⭐ MVP

**Acceptance Criteria**:

1. PROD-17: IF a request to any `/products` route has no cookie or an invalid or expired token THEN the system SHALL respond 401 `UNAUTHORIZED`
2. PROD-18: IF an operator calls `POST`, `PATCH` or `DELETE` on `/products` THEN the system SHALL respond 403 `FORBIDDEN`
3. PROD-19: The system SHALL take `tenantId` only from `req.auth` and filter every product query by `tenantId` and `deleted_at IS NULL`
4. PROD-20: WHEN a user lists products THEN the system SHALL return only products of their own tenant

---

### P1: Validation ⭐ MVP

**Acceptance Criteria**:

1. PROD-21: IF `sku` after trim and uppercase is empty, longer than 64 characters or has characters outside `A-Z`, `0-9`, `-`, `_`, `.` THEN the system SHALL respond 400 `VALIDATION_ERROR`
2. PROD-22: IF `name` after trim is empty or longer than 200 characters THEN the system SHALL respond 400 `VALIDATION_ERROR`
3. PROD-23: IF `priceCents` is not an integer or is outside 0 to 100,000,000 THEN the system SHALL respond 400 `VALIDATION_ERROR`; `0` SHALL be accepted
4. PROD-24: IF `stock` is not an integer or is outside 0 to 1,000,000 THEN the system SHALL respond 400 `VALIDATION_ERROR`
5. PROD-25: IF any of `sku`, `name`, `priceCents`, `stock` is missing on `POST` THEN the system SHALL respond 400 `VALIDATION_ERROR`

---

### P1: List products ⭐ MVP

**User Story**: As an admin or operator, I want to page, search and filter my catalog.

**Acceptance Criteria**:

1. PROD-26: WHEN `GET /products` is called THEN the system SHALL respond 200 with `{ data, meta: { page, limit, total } }`, defaulting to `page=1`, `limit=20`
2. PROD-27: IF `page` is not an integer ≥ 1 or `limit` is not an integer in 1..100 THEN the system SHALL respond 400 `VALIDATION_ERROR`
3. PROD-28: WHEN `page` is past the last page THEN the system SHALL respond 200 with `data: []` and the real `total`
4. PROD-29: WHEN `search` is given THEN the system SHALL return products whose name or SKU contains it, case-insensitively, after trimming; an empty `search` SHALL be ignored
5. PROD-30: The system SHALL match `%`, `_` and `\` in `search` literally
6. PROD-31: IF `search` is longer than 100 characters THEN the system SHALL respond 400 `VALIDATION_ERROR`
7. PROD-32: WHEN `outOfStock=true` THEN the system SHALL return only products with `stock = 0`; WHEN `outOfStock=false` only `stock > 0`; absent returns all
8. PROD-33: IF `outOfStock` is any value other than `true` or `false` THEN the system SHALL respond 400 `VALIDATION_ERROR`
9. PROD-34: The system SHALL order the list by `name asc, id asc`
10. PROD-35: The system SHALL compute `total` with the same filters as `data`

---

### P1: Data model and seed ⭐ MVP

**Acceptance Criteria**:

1. PROD-36: The system SHALL store `products` with `id` (uuid, default `uuidv7()`), `tenant_id` FK, `sku`, `name`, `price_cents`, `stock` and `timestamptz` timestamps with nullable `deleted_at`
2. PROD-37: The system SHALL enforce unique `(tenant_id, sku)` where `deleted_at IS NULL`, unique `(tenant_id, id)`, and checks `sku = upper(sku)`, `price_cents >= 0`, `stock >= 0`
3. PROD-38: WHEN the seed runs THEN the system SHALL create two products per tenant, one with `stock: 0`, with `CAM-P` in both `Acme` and `Globex`
4. PROD-39: WHEN the seed runs a second time THEN the system SHALL create no duplicate products

---

## Edge Cases

- IF the SKU differs only by case from an active one THEN the system SHALL respond 409
- IF `search=%` THEN the system SHALL match only products containing a literal `%`
- WHEN two products share a name THEN the system SHALL order them by `id` so none appears on two pages

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PROD-01 | P1: Create a product | Execute | Verified |
| PROD-02 | P1: Create a product | Execute | Verified |
| PROD-03 | P1: Create a product | Execute | Verified |
| PROD-04 | P1: Create a product | Execute | Verified |
| PROD-05 | P1: Create a product | Execute | Verified |
| PROD-06 | P1: Create a product | Execute | Verified |
| PROD-07 | P1: Read products | Execute | Verified |
| PROD-08 | P1: Read products | Execute | Verified |
| PROD-09 | P1: Read products | Execute | Verified |
| PROD-10 | P1: Update a product | Execute | Verified |
| PROD-11 | P1: Update a product | Execute | Verified |
| PROD-12 | P1: Update a product | Execute | Verified |
| PROD-13 | P1: Update a product | Execute | Verified |
| PROD-14 | P1: Delete a product | Execute | Verified |
| PROD-15 | P1: Delete a product | Execute | Verified |
| PROD-16 | P1: Delete a product | Execute | Verified |
| PROD-17 | P1: Authorization and isolation | Execute | Verified |
| PROD-18 | P1: Authorization and isolation | Execute | Verified |
| PROD-19 | P1: Authorization and isolation | Execute | Verified |
| PROD-20 | P1: Authorization and isolation | Execute | Verified |
| PROD-21 | P1: Validation | Execute | Verified |
| PROD-22 | P1: Validation | Execute | Verified |
| PROD-23 | P1: Validation | Execute | Verified |
| PROD-24 | P1: Validation | Execute | Verified |
| PROD-25 | P1: Validation | Execute | Verified |
| PROD-26 | P1: List products | Execute | Verified |
| PROD-27 | P1: List products | Execute | Verified |
| PROD-28 | P1: List products | Execute | Verified |
| PROD-29 | P1: List products | Execute | Verified |
| PROD-30 | P1: List products | Execute | Verified |
| PROD-31 | P1: List products | Execute | Verified |
| PROD-32 | P1: List products | Execute | Verified |
| PROD-33 | P1: List products | Execute | Verified |
| PROD-34 | P1: List products | Execute | Verified |
| PROD-35 | P1: List products | Execute | Verified |
| PROD-36 | P1: Data model and seed | Execute | Verified |
| PROD-37 | P1: Data model and seed | Execute | Verified |
| PROD-38 | P1: Data model and seed | Execute | Verified |
| PROD-39 | P1: Data model and seed | Execute | Verified |

**Coverage:** 39 total, 39 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm --filter stocksync-api typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
- [ ] The tenant isolation test passes: list, `GET`, `PATCH`, `DELETE` across tenants
