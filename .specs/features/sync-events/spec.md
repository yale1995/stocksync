# Sync Events Specification

## Problem Statement

Part B of the assessment syncs each product's stock and price to an external advertising service, asynchronously and without the request waiting for it. The first step is a Postgres outbox: every relevant product change writes a `sync_events` row in the same transaction as the change, so a committed change always has its event and a rolled-back change never does. This feature adds the table, the event-writing function and its calls from the existing flows. The worker, the mock and the status endpoint are later features.

## Goals

- [ ] Every product creation, stock change, price change and delete commits exactly one event per product with the right snapshot
- [ ] A failed change records no event
- [ ] Events of the same product get strictly increasing versions, also under concurrency and across delete + recreate

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Worker, `AdsClient`, retries | Feature `sync-worker` |
| Mock ads service | Feature `ads-mock` |
| `GET /sync/status` | Feature `sync-status` |
| Syncing `name` | Not in the contract (`sku`, `stock`, `price`); README improvement |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/05-sync.md` | Applied as written | Agreed with the user | y |
| Lock used by `updateProduct`/`deleteProduct` | Reuse `lockActiveProductsStock(tenantId, [id], tx)` | It already returns `sku`, `stock`, `priceCents` under `FOR UPDATE` | y (plan approved) |
| `version` mode in TypeScript | `bigint({ mode: "number" })` | Fits well below 2^53; avoids `BigInt` in JSON | y (plan approved) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Data model ⭐ MVP

**Acceptance Criteria**:

1. SYNC-01: The system SHALL store `sync_events` with `id` (uuidv7), `tenant_id`, `product_id`, `version` (bigint identity, unique), `trigger`, `sku`, `stock`, `price_cents`, `status` (default `pending`), `attempts` (default 0), `next_attempt_at` (default `now()`), `last_error`, `sent_at`, `created_at`, `updated_at`, all timestamps `timestamptz`, and no `deleted_at`
2. SYNC-02: The system SHALL restrict `trigger` to `product_created`, `stock_changed`, `price_changed`, `product_deleted` and `status` to `pending`, `sent`, `failed`, `superseded`
3. SYNC-03: IF a row has negative `stock`, negative `price_cents`, negative `attempts`, or `status = 'sent'` without `sent_at` (or the reverse) THEN the database SHALL reject it with the matching CHECK constraint
4. SYNC-04: IF a row references a product of another tenant THEN the database SHALL reject it with the composite FK `(tenant_id, product_id) → products (tenant_id, id)`
5. SYNC-05: The system SHALL index `(next_attempt_at) WHERE status = 'pending'`, `(tenant_id, status)` and `(tenant_id, product_id, version)`

---

### P1: Writing events ⭐ MVP

**Acceptance Criteria**:

1. SYNC-06: WHEN an admin creates a product THEN the system SHALL record one `product_created` event with the product's `sku`, `stock` and `priceCents`, also when stock is 0
2. SYNC-07: WHEN a sale succeeds THEN the system SHALL record one `stock_changed` event per sold product with `stock` equal to the stock after the sale and the product's price
3. SYNC-08: IF a sale or adjustment fails THEN the system SHALL record no event
4. SYNC-09: WHEN a stock adjustment succeeds THEN the system SHALL record one `stock_changed` event with the stock after the adjustment
5. SYNC-10: WHEN a `PATCH` changes `priceCents` to a different value THEN the system SHALL record one `price_changed` event with the current stock and the new price, also when `name` changes in the same request
6. SYNC-11: WHEN a `PATCH` changes only `name`, or sets `priceCents` to the current value THEN the system SHALL record no event
7. SYNC-12: WHEN an admin deletes a product THEN the system SHALL record one `product_deleted` event with `stock = 0` and the current price, and leave the product's `stock` column unchanged
8. SYNC-13: `updateProduct` and `deleteProduct` SHALL read the product with `SELECT ... FOR UPDATE` and decide from the locked row
9. SYNC-14: WHEN two price `PATCH`es run concurrently (A, then B restoring the original price) THEN each SHALL record a `price_changed` event, and the event with the highest version SHALL hold the product's final price
10. SYNC-15: Successive events of the same product SHALL have strictly increasing versions, including after the product is deleted and recreated with the same SKU
11. SYNC-16: The seed SHALL record one `product_created` event per product it creates and record none when run again
12. SYNC-17: New events SHALL have `status = 'pending'`, `attempts = 0`, `last_error` and `sent_at` null

---

## Edge Cases

- WHEN a `PATCH` targets a missing or deleted product THEN the system SHALL respond 404 and record no event
- WHEN a product is created with a duplicate SKU (409) THEN the system SHALL record no event

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SYNC-01 | P1: Data model | Execute | Implemented |
| SYNC-02 | P1: Data model | Execute | Implemented |
| SYNC-03 | P1: Data model | Execute | Implemented |
| SYNC-04 | P1: Data model | Execute | Implemented |
| SYNC-05 | P1: Data model | Execute | Implemented |
| SYNC-06 | P1: Writing events | Execute | Implemented |
| SYNC-07 | P1: Writing events | Execute | Implemented |
| SYNC-08 | P1: Writing events | Execute | Implemented |
| SYNC-09 | P1: Writing events | Execute | Implemented |
| SYNC-10 | P1: Writing events | Execute | Implemented |
| SYNC-11 | P1: Writing events | Execute | Implemented |
| SYNC-12 | P1: Writing events | Execute | Implemented |
| SYNC-13 | P1: Writing events | Execute | Implemented |
| SYNC-14 | P1: Writing events | Execute | Implemented |
| SYNC-15 | P1: Writing events | Execute | Implemented |
| SYNC-16 | P1: Writing events | Execute | Implemented |
| SYNC-17 | P1: Writing events | Execute | Implemented |

**Coverage:** 17 total, 17 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm --filter stocksync-api typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
- [ ] The concurrent price test passes repeatedly without flakiness
