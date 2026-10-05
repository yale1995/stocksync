# State

## Decisions

- AD-001: Errors use one `AppError` base with six subclasses and the response shape `{ error: { code, message } }` (feature `errors`).
- AD-002: Tenancy is a shared database with `tenant_id` on every tenant-owned table, filtered in repositories and backed by composite FKs `(tenant_id, id)`. No RLS (feature `auth-tenancy`).
- AD-003: Auth uses a jose HS256 1h JWT in an `httpOnly` `access_token` cookie, with no refresh token. `requireAuth` does not hit the database (feature `auth-tenancy`).
- AD-004: Tests run against a real `stocksync_test` database in the dev container, truncated between tests, with no file parallelism (feature `auth-tenancy`).
- AD-005: Money is stored as integer cents (`price_cents`, API `priceCents`); no floating point (feature `products`).
- AD-006: Product SKU is stored trimmed and uppercased (guarded by `CHECK (sku = upper(sku))`), unique per tenant among active rows, and immutable after creation because Part B identifies ads by SKU (feature `products`).
- AD-007: Lists use offset pagination with `page` (default 1) and `limit` (default 20, max 100) and respond `{ data, meta: { page, limit, total } }`; a page past the end returns `data: []` (feature `products`).
- AD-008: A malformed uuid in a path param returns 404 `NOT_FOUND`, not 400; resources of another tenant also return 404 (feature `products`).
- AD-009: `stock_movements` is an append-only ledger (no `updated_at`/`deleted_at`; corrections are opposite adjustments). For every product the sum of movements (`in` − `out`) and the latest `stock_after` equal `products.stock`; product creation always records an `initial` movement (feature `stock-movements`).
- AD-010: A movement has separate `direction` (`in`/`out`) and `source` (`initial`/`adjustment`/`sale`) columns with an always-positive quantity (`0` only for `initial`), kept coherent by CHECK constraints (feature `stock-movements`).
- AD-011 (superseded by AD-012): `applyStockChange(tx, …)` in the stock-movements service is the only path that changes an existing product's stock: it locks the product row `FOR UPDATE`, rejects insufficient stock or stock above 1,000,000 with 409, updates the stock and inserts the movement in the caller's transaction (feature `stock-movements`).
- AD-012: `applyStockChanges(tx, { tenantId, userId, source, saleId, notFoundMessage, items })` in the stock-movements service is the only path that changes an existing product's stock. It locks every product in one `SELECT … ORDER BY id FOR UPDATE` (deadlock-free lock order), throws 404 with the caller's message if any is missing, one 409 `Insufficient stock for SKU (available: N, requested: M), …` listing every short item in `productId` order, 409 above 1,000,000, then updates the stock and inserts each movement in the caller's transaction (feature `sales`).
- AD-013: `POST /sales` idempotency is write-first. The sale (with `Idempotency-Key` and the sha256 of its canonical items) is inserted before any stock change under `unique (tenant_id, idempotency_key)`. A `23505` is replayed (201 + `Idempotent-Replayed: true`) when the stored hash matches, or answered 409 when it differs. Only successful sales keep their key. This is the one deliberate exception to the "check before writing" rule (feature `sales`).
- AD-014: Sales and sale items are immutable (no `updated_at`/`deleted_at`). Only the unit price is frozen; `sku`/`name` come from the product join, the total is derived, and sale reads ignore `deleted_at` on products and users (feature `sales`).
- AD-015: `stock_movements.created_at` defaults to `clock_timestamp()`, not `now()`, so the history order per product matches the order the locked changes were applied (feature `sales`).
- AD-016: Product changes relevant to the ads service are written to a Postgres outbox, `sync_events`, in the same transaction as the change (no dual write, no extra infrastructure). Only the worker updates a row afterwards; rows are never deleted, so the table has `updated_at` and no `deleted_at` (feature `sync-events`).
- AD-017: `sync_events.version` is one table-wide `GENERATED ALWAYS AS IDENTITY` sequence, not a per-product counter or a timestamp. The event is always inserted after the product row is locked (or inserted), so the later change to a product always has the greater version (feature `sync-events`).
- AD-018: Every flow that records a sync event follows lock, decide, write: `updateProduct`/`deleteProduct` read the product through `lockActiveProductsStock(tenantId, [id], tx)`; `price_changed` is recorded only when the price differs from the locked row; `product_deleted` carries `stock = 0` (feature `sync-events`).

## Handoff

Feature `sync-events` (Part B PR 1 of 4) implemented on branch `feat/sync-events`, uncommitted pending review. Next: `ads-mock`, `sync-worker`, `sync-status` per `docs/prompts/05-sync.md`.
