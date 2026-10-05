# Stock Movements Specification

## Problem Statement

The assessment (Part A item 3) requires every stock change to be recorded in a movement history (who, when, why, quantity) and exposed by the API. Today `products.stock` changes only on creation and leaves no trace. This feature adds an append-only ledger, admin stock adjustments, a per-product history and one shared stock change function that the sales PR and Part B will reuse.

## Goals

- [ ] Every stock change, including product creation, writes exactly one movement in the same transaction
- [ ] For every product, the sum of its movements (`in` minus `out`) and its latest `stock_after` equal `products.stock`
- [ ] Admins adjust stock with a reason; admins and operators read the paginated history of a product
- [ ] Tenant isolation holds for adjustments and history

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Sales, `sale_id` on movements, concurrency test, idempotency | PR 5 (the `sale` enum value is created now) |
| Tenant-wide `GET /stock-movements` with a `productId` filter | Future improvement (README) |
| Backfill of movements for products in existing developer databases | Recreate the database and run the seed again |
| Editing or deleting movements | Append-only ledger; corrections are opposite adjustments |
| Part B (sync, outbox, `version`), frontend, README | Later pieces |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/03-stock-movements.md` | Applied as written | Agreed with the user | y |
| Message when an `in` would exceed the maximum | `Stock cannot exceed 1000000` | The prompt fixes the status (409) but not the message | y (plan approved) |
| Response of the adjustment endpoint | Same movement shape as the history, read back with the user join | One shape for both endpoints | y (plan approved) |
| Initial movement path | Inserted directly after the product insert, not through `applyStockChange` | The row is new in the same transaction and its stock is already set | y (plan approved) |
| Unknown body fields (e.g. `source`, `userId`) | Stripped, not rejected | Same Zod default as the other modules | y (plan approved) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Stock adjustment ⭐ MVP

**User Story**: As an admin, I want to add or remove stock with a reason so that physical counts, losses and receipts are reflected and audited.

**Acceptance Criteria**:

1. MOV-01: WHEN an admin posts `{ direction: "in", quantity, reason }` to `POST /products/:id/stock-adjustments` THEN the system SHALL add `quantity` to the product stock and respond 201 with the created movement
2. MOV-02: WHEN an admin posts `{ direction: "out", quantity, reason }` within the current stock THEN the system SHALL subtract `quantity` from the product stock and respond 201 with the created movement
3. MOV-03: WHEN an adjustment is created THEN the movement SHALL have the request `direction`, `quantity` and trimmed `reason`, `source: "adjustment"`, `stockAfter` equal to the new stock and `user` equal to `{ id, email }` of the caller
4. MOV-04: IF an `out` adjustment is larger than the current stock THEN the system SHALL respond 409 `CONFLICT` with message `Insufficient stock` and leave the stock and the history unchanged
5. MOV-05: IF an `in` adjustment would take the stock above 1,000,000 THEN the system SHALL respond 409 `CONFLICT` and leave the stock and the history unchanged
6. MOV-06: The system SHALL lock the product row (`SELECT ... FOR UPDATE`, filtered by tenant and `deleted_at IS NULL`) before computing the new stock, and update the stock and insert the movement in the same transaction

**Independent Test**: admin adjusts `CAM-P` by `out 3`, stock goes from 25 to 22 and the history shows the movement.

---

### P1: Movement history ⭐ MVP

**User Story**: As an admin or operator, I want to see the stock history of a product so that I know who changed it, when and why.

**Acceptance Criteria**:

1. MOV-07: WHEN an admin or operator calls `GET /products/:id/stock-movements` THEN the system SHALL respond 200 with `{ data, meta: { page, limit, total } }`, defaulting to `page=1`, `limit=20`
2. MOV-08: The system SHALL order the history by `created_at desc, id desc`
3. MOV-09: WHEN `page` is past the last page THEN the system SHALL respond 200 with `data: []` and the real `total`
4. MOV-10: IF `page` is not an integer ≥ 1 or `limit` is not an integer in 1..100 THEN the system SHALL respond 400 `VALIDATION_ERROR`
5. MOV-11: The system SHALL return each movement as exactly `{ id, direction, quantity, stockAfter, source, reason, createdAt, user: { id, email } }`, without `tenantId` or `productId`
6. MOV-12: WHEN the user who made a movement is soft deleted THEN the history SHALL still return that movement with its `user`

---

### P1: Initial movement ⭐ MVP

**User Story**: As an admin, I want the history of a product to start when it is created so that the ledger always explains the current stock.

**Acceptance Criteria**:

1. MOV-13: WHEN an admin creates a product THEN the system SHALL record, in the same transaction, a movement with `source: "initial"`, `direction: "in"`, `quantity` and `stockAfter` equal to the initial stock, `reason: null` and the creating admin as `user`
2. MOV-14: WHEN a product is created with `stock: 0` THEN the system SHALL still record the initial movement with `quantity: 0` and `stockAfter: 0`
3. MOV-15: The `POST /products` response shape SHALL not change
4. MOV-16: The latest movement's `stockAfter` of a product SHALL equal `products.stock`

---

### P1: Authorization, isolation and not found ⭐ MVP

**Acceptance Criteria**:

1. MOV-17: IF a request to either endpoint has no cookie or an invalid or expired token THEN the system SHALL respond 401 `UNAUTHORIZED`
2. MOV-18: IF an operator posts a stock adjustment THEN the system SHALL respond 403 `FORBIDDEN`
3. MOV-19: IF the product belongs to another tenant THEN both endpoints SHALL respond 404 `NOT_FOUND` and the other tenant's stock SHALL stay unchanged
4. MOV-20: IF the product is missing or soft deleted THEN both endpoints SHALL respond 404 `NOT_FOUND`
5. MOV-21: IF `:id` is not a valid uuid THEN both endpoints SHALL respond 404 `NOT_FOUND`
6. MOV-22: The system SHALL take `tenantId` and `userId` only from `req.auth`

---

### P1: Adjustment validation ⭐ MVP

**Acceptance Criteria**:

1. MOV-23: IF `direction` is missing or not `in`/`out` THEN the system SHALL respond 400 `VALIDATION_ERROR`
2. MOV-24: IF `quantity` is missing, not an integer or outside 1 to 1,000,000 THEN the system SHALL respond 400 `VALIDATION_ERROR`
3. MOV-25: IF `reason` is missing, empty or blank after trim, or longer than 500 characters THEN the system SHALL respond 400 `VALIDATION_ERROR`

---

### P1: Data model and seed ⭐ MVP

**Acceptance Criteria**:

1. MOV-26: The system SHALL store `stock_movements` with `id` (uuid, `uuidv7()`), `tenant_id`, `product_id`, `direction` (`in`/`out`), `source` (`initial`/`adjustment`/`sale`), `quantity`, `stock_after`, nullable `reason`, `user_id` and `created_at` (`timestamptz`), with no `updated_at` or `deleted_at`
2. MOV-27: The system SHALL enforce composite FKs `(tenant_id, product_id) → products (tenant_id, id)` and `(tenant_id, user_id) → users (tenant_id, id)`
3. MOV-28: The system SHALL enforce the checks `source <> 'initial' OR direction = 'in'`, `source <> 'sale' OR direction = 'out'`, `quantity > 0 OR source = 'initial'`, `stock_after >= 0` and `(source = 'adjustment') = (reason IS NOT NULL)`
4. MOV-29: IF a row is inserted directly with `source: sale` and `direction: in`, or `source: adjustment` and `quantity: 0` THEN the database SHALL reject it
5. MOV-30: The system SHALL index `(tenant_id, product_id, created_at desc, id desc)`
6. MOV-31: WHEN the seed creates a product THEN it SHALL record its `initial` movement by the tenant's admin in the same transaction
7. MOV-32: WHEN the seed runs twice THEN every seeded product SHALL have exactly one `initial` movement

---

## Edge Cases

- WHEN an `out` adjustment equals the current stock THEN the system SHALL accept it and leave the stock at 0
- WHEN two movements share `created_at` THEN the system SHALL order them by `id desc`
- IF the history of a soft-deleted product is requested THEN the system SHALL respond 404

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| MOV-01 | P1: Stock adjustment | Execute | Verified |
| MOV-02 | P1: Stock adjustment | Execute | Verified |
| MOV-03 | P1: Stock adjustment | Execute | Verified |
| MOV-04 | P1: Stock adjustment | Execute | Verified |
| MOV-05 | P1: Stock adjustment | Execute | Verified |
| MOV-06 | P1: Stock adjustment | Execute | Verified |
| MOV-07 | P1: Movement history | Execute | Verified |
| MOV-08 | P1: Movement history | Execute | Verified |
| MOV-09 | P1: Movement history | Execute | Verified |
| MOV-10 | P1: Movement history | Execute | Verified |
| MOV-11 | P1: Movement history | Execute | Verified |
| MOV-12 | P1: Movement history | Execute | Verified |
| MOV-13 | P1: Initial movement | Execute | Verified |
| MOV-14 | P1: Initial movement | Execute | Verified |
| MOV-15 | P1: Initial movement | Execute | Verified |
| MOV-16 | P1: Initial movement | Execute | Verified |
| MOV-17 | P1: Authorization, isolation and not found | Execute | Verified |
| MOV-18 | P1: Authorization, isolation and not found | Execute | Verified |
| MOV-19 | P1: Authorization, isolation and not found | Execute | Verified |
| MOV-20 | P1: Authorization, isolation and not found | Execute | Verified |
| MOV-21 | P1: Authorization, isolation and not found | Execute | Verified |
| MOV-22 | P1: Authorization, isolation and not found | Execute | Verified |
| MOV-23 | P1: Adjustment validation | Execute | Verified |
| MOV-24 | P1: Adjustment validation | Execute | Verified |
| MOV-25 | P1: Adjustment validation | Execute | Verified |
| MOV-26 | P1: Data model and seed | Execute | Verified |
| MOV-27 | P1: Data model and seed | Execute | Verified |
| MOV-28 | P1: Data model and seed | Execute | Verified |
| MOV-29 | P1: Data model and seed | Execute | Verified |
| MOV-30 | P1: Data model and seed | Execute | Verified |
| MOV-31 | P1: Data model and seed | Execute | Verified |
| MOV-32 | P1: Data model and seed | Execute | Verified |

**Coverage:** 32 total, 32 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm --filter stocksync-api typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
- [ ] The ledger invariant holds after creation and adjustments: the latest `stockAfter` equals the product stock
