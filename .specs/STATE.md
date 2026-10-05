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
- AD-011: `applyStockChange(tx, …)` in the stock-movements service is the only path that changes an existing product's stock: it locks the product row `FOR UPDATE`, rejects insufficient stock or stock above 1,000,000 with 409, updates the stock and inserts the movement in the caller's transaction (feature `stock-movements`).

## Handoff

Feature `stock-movements` done on branch `feat/stock-movements`.
