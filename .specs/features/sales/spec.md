# Sales Specification

## Problem Statement

The assessment (Part A item 3) requires `POST /sales` with one or more items: stock never goes negative even under concurrent requests, a sale is all-or-nothing, a retried request with the same idempotency key does not sell twice, and every stock change is recorded in the movement history. Today stock only changes through single-product admin adjustments. This feature adds immutable sales, an idempotency key and a multi-product version of the shared stock change function.

## Goals

- [ ] A sale decrements the stock of every item and records one `sale` movement per item, or changes nothing
- [ ] Ten parallel sales of 1 unit against stock 5 produce exactly five sales and final stock 0
- [ ] A retried or concurrent request with the same key returns the original sale and decrements stock once
- [ ] The ledger invariant (AD-009) keeps holding after sales

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `GET /sales`, `GET /sales/:id` | Future improvement (README) |
| Cancellations and refunds | Future: a new `in` movement, never deleting a sale (README) |
| Structured `details` per short item in the 409 | Future improvement if the form needs it (README) |
| Freezing `sku`/`name` on the sale | SKU is immutable; name only matters for customer-facing documents (README) |
| Part B (outbox, sync, `version`), frontend, README | Later pieces |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/04-sales.md` | Applied as written | Agreed with the user | y |
| Insufficient-stock message of stock adjustments | Same detailed format as sales, one SKU: `Insufficient stock for CAM-P (available: 25, requested: 26)` | One message builder in the shared function; the adjustment test assertion changes accordingly | y (asked during planning) |
| Not-found message of stock adjustments | Stays `Product not found`; sales use `One or more products were not found` | The caller passes the message to the shared function | y (plan approved) |
| `saleId` in the adjustment 201 body | Present as `null` | The adjustment response shares the history select | y (plan approved) |
| Case of `productId` | Lowercased by validation | Canonical hash and lock order must not depend on the client's case | y (prompt: hash uses lowercased ids) |
| Unknown body fields | Stripped, not rejected | Same Zod default as the other modules | y (plan approved) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Register a sale ⭐ MVP

**User Story**: As an operator or admin, I want to register a sale of one or more products so that stock reflects what was sold.

**Acceptance Criteria**:

1. SALE-01: WHEN an admin or operator posts `POST /sales` with a valid `Idempotency-Key` and items whose stock is sufficient THEN the system SHALL respond 201 with the sale
2. SALE-02: WHEN a sale is created THEN the system SHALL subtract each item's quantity from its product stock
3. SALE-03: WHEN a sale is created THEN the system SHALL record one movement per item with `source: "sale"`, `direction: "out"`, the item quantity, `stockAfter` equal to the new stock and `saleId` equal to the sale id
4. SALE-04: The system SHALL return the sale as exactly `{ id, items: [{ productId, sku, name, quantity, unitPriceCents }], totalCents, createdAt, user: { id, email } }`, without `tenantId`, items ordered by `productId`
5. SALE-05: The system SHALL set `unitPriceCents` to the product price at the moment of the sale and `totalCents` to `sum(quantity × unitPriceCents)`
6. SALE-06: The system SHALL take `tenantId` and `userId` only from `req.auth`

**Independent Test**: operator sells 2 × `CAM-P`; stock goes from 25 to 23, the response total is `2 × 4990`, the history shows a sale movement with the sale id.

---

### P1: All-or-nothing and errors ⭐ MVP

**Acceptance Criteria**:

1. SALE-07: IF any product is missing, soft deleted or owned by another tenant THEN the system SHALL respond 404 `NOT_FOUND` with message `One or more products were not found` and change nothing
2. SALE-08: IF one or more items exceed the available stock THEN the system SHALL respond 409 `CONFLICT` with message `Insufficient stock for ` followed by `SKU (available: N, requested: M)` for each short item only, ordered by `productId` and joined by `, `, and change nothing
3. SALE-09: IF a sale has both a missing product and a short item THEN the system SHALL respond 404
4. SALE-10: WHEN a sale fails THEN stock, sales, sale items and movements SHALL stay unchanged for every item
5. SALE-11: IF the request has no cookie or an invalid or expired token THEN the system SHALL respond 401 `UNAUTHORIZED`

---

### P1: Validation ⭐ MVP

**Acceptance Criteria**:

1. SALE-12: IF the `Idempotency-Key` header is missing or not a UUID THEN the system SHALL respond 400 `VALIDATION_ERROR`
2. SALE-13: IF `items` is missing, empty or has more than 100 entries THEN the system SHALL respond 400 `VALIDATION_ERROR`
3. SALE-14: IF an item `productId` is not a UUID THEN the system SHALL respond 400 `VALIDATION_ERROR`
4. SALE-15: IF an item `quantity` is not an integer in 1..1,000,000 THEN the system SHALL respond 400 `VALIDATION_ERROR`
5. SALE-16: IF two items share the same `productId` THEN the system SHALL respond 400 `VALIDATION_ERROR`

---

### P1: Concurrency ⭐ MVP

**Acceptance Criteria**:

1. SALE-17: WHEN 10 sales of 1 unit run in parallel against a product with stock 5 THEN the system SHALL respond exactly five 201 and five 409, leave stock 0 and record exactly five sale movements with the latest `stockAfter` 0
2. SALE-18: WHEN a sale of A+B and a sale of B+A run in parallel THEN both SHALL respond 201 (no deadlock, no 500)
3. SALE-19: The shared stock change function SHALL lock every product with `SELECT ... FOR UPDATE` in `productId` order before checking stock

---

### P1: Idempotency ⭐ MVP

**Acceptance Criteria**:

1. SALE-20: WHEN a request repeats a key already used by a successful sale of the same tenant with the same items THEN the system SHALL respond 201 with the original sale and header `Idempotent-Replayed: true`, without changing stock
2. SALE-21: WHEN several requests with the same key and items run in parallel THEN all SHALL respond 201 with the same `id`, and exactly one sale and one decrement SHALL exist
3. SALE-22: WHEN the same key is sent with the same items in another order THEN the system SHALL treat it as a replay
4. SALE-23: IF a key is reused by the same tenant with different items THEN the system SHALL respond 409 `CONFLICT` with message `Idempotency key was already used with a different request` and change nothing
5. SALE-24: WHEN a sale fails THEN the system SHALL not store its key, so a later retry with the same key is processed again
6. SALE-25: WHEN two tenants use the same key THEN the system SHALL create two independent sales
7. SALE-26: WHEN a sale is replayed after its product price changed or the product was soft deleted THEN the system SHALL respond 201 with the original `unitPriceCents`, `totalCents`, `sku` and `name`

---

### P1: Shared stock change and history ⭐ MVP

**Acceptance Criteria**:

1. SALE-27: The stock adjustment SHALL use the same shared function with a single change and keep its status codes and the `Product not found` message
2. SALE-28: IF an `out` adjustment exceeds the stock THEN the system SHALL respond 409 with `Insufficient stock for SKU (available: N, requested: M)`
3. SALE-29: The history items of `GET /products/:id/stock-movements` SHALL include `saleId`, `null` for `initial` and `adjustment` movements
4. SALE-30: For every product the sum of movements (`in` − `out`) SHALL equal `products.stock` after sales

---

### P1: Data model ⭐ MVP

**Acceptance Criteria**:

1. SALE-31: The system SHALL store `sales` (`id`, `tenant_id`, `user_id`, `idempotency_key` uuid, `request_hash` text, `created_at` timestamptz) and `sale_items` (`id`, `tenant_id`, `sale_id`, `product_id`, `quantity`, `unit_price_cents`) with no `updated_at` or `deleted_at`
2. SALE-32: The system SHALL enforce `unique (tenant_id, idempotency_key)`, `unique (tenant_id, id)` on sales, `unique (sale_id, product_id)` on sale items, `length(request_hash) = 64`, `quantity > 0` and `unit_price_cents >= 0`
3. SALE-33: The system SHALL enforce composite FKs `sales (tenant_id, user_id) → users`, `sale_items (tenant_id, sale_id) → sales`, `sale_items (tenant_id, product_id) → products` and `stock_movements (tenant_id, sale_id) → sales`
4. SALE-34: IF a movement is inserted with `source: sale` and no `sale_id`, or with `source: adjustment` and a `sale_id` THEN the database SHALL reject it

---

## Edge Cases

- WHEN an item quantity equals the product stock THEN the system SHALL accept it and leave stock 0
- WHEN two items are short THEN both SHALL appear in the 409 message
- WHEN a sale failed with 409, stock was then replenished and the same key is retried THEN the system SHALL respond 201

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SALE-01 | P1: Register a sale | Execute | Implemented |
| SALE-02 | P1: Register a sale | Execute | Implemented |
| SALE-03 | P1: Register a sale | Execute | Implemented |
| SALE-04 | P1: Register a sale | Execute | Implemented |
| SALE-05 | P1: Register a sale | Execute | Implemented |
| SALE-06 | P1: Register a sale | Execute | Implemented |
| SALE-07 | P1: All-or-nothing and errors | Execute | Implemented |
| SALE-08 | P1: All-or-nothing and errors | Execute | Implemented |
| SALE-09 | P1: All-or-nothing and errors | Execute | Implemented |
| SALE-10 | P1: All-or-nothing and errors | Execute | Implemented |
| SALE-11 | P1: All-or-nothing and errors | Execute | Implemented |
| SALE-12 | P1: Validation | Execute | Implemented |
| SALE-13 | P1: Validation | Execute | Implemented |
| SALE-14 | P1: Validation | Execute | Implemented |
| SALE-15 | P1: Validation | Execute | Implemented |
| SALE-16 | P1: Validation | Execute | Implemented |
| SALE-17 | P1: Concurrency | Execute | Implemented |
| SALE-18 | P1: Concurrency | Execute | Implemented |
| SALE-19 | P1: Concurrency | Execute | Implemented |
| SALE-20 | P1: Idempotency | Execute | Implemented |
| SALE-21 | P1: Idempotency | Execute | Implemented |
| SALE-22 | P1: Idempotency | Execute | Implemented |
| SALE-23 | P1: Idempotency | Execute | Implemented |
| SALE-24 | P1: Idempotency | Execute | Implemented |
| SALE-25 | P1: Idempotency | Execute | Implemented |
| SALE-26 | P1: Idempotency | Execute | Implemented |
| SALE-27 | P1: Shared stock change and history | Execute | Implemented |
| SALE-28 | P1: Shared stock change and history | Execute | Implemented |
| SALE-29 | P1: Shared stock change and history | Execute | Implemented |
| SALE-30 | P1: Shared stock change and history | Execute | Implemented |
| SALE-31 | P1: Data model | Execute | Implemented |
| SALE-32 | P1: Data model | Execute | Implemented |
| SALE-33 | P1: Data model | Execute | Implemented |
| SALE-34 | P1: Data model | Execute | Implemented |

**Coverage:** 34 total, 34 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm --filter stocksync-api typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
- [ ] The concurrency and idempotency tests pass repeatedly without flakiness
