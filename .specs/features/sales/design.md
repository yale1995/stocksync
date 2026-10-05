# Sales Design

**Spec**: `.specs/features/sales/spec.md`

Conforms to AD-001 (errors), AD-002 (tenancy + composite FKs), AD-003 (`req.auth`), AD-004 (real test database), AD-009/AD-010 (ledger). Supersedes AD-011 with AD-012 (`applyStockChanges`) and introduces AD-013 (idempotency), AD-014 (immutable sales) and AD-015 (movement `created_at` is `clock_timestamp()`).

## Components

| File | Responsibility |
| ---- | -------------- |
| `src/infra/schemas/sales.ts` | `sales` and `sale_items` tables (one aggregate, one file), composite FKs, uniques and CHECKs. No `updated_at`/`deleted_at` |
| `src/infra/schemas/stock-movements.ts` | Nullable `saleId`, `stock_movements_sale_fk`, CHECK `stock_movements_sale_id_only_for_sales`; `created_at` defaults to `clock_timestamp()` |
| `src/infra/migrations/0003_*.sql` | Generated with `db:generate` |
| `src/modules/products/products.repository.ts` | `lockActiveProductsStock(tenantId, ids, executor)` replaces `lockActiveProductStock`: one `SELECT id, sku, stock, price_cents … ORDER BY id FOR UPDATE` |
| `src/modules/stock-movements/stock-movements.repository.ts` | `movementColumns` gains `saleId` |
| `src/modules/stock-movements/stock-movements.service.ts` | `applyStockChanges(tx, changes, { notFoundMessage })` replaces `applyStockChange` |
| `src/modules/sales/sales.validation.ts` | `idempotencyKeySchema`, `createSaleSchema` |
| `src/modules/sales/sales.repository.ts` | `insertSale`, `insertSaleItems`, `findSaleByKey`, `findSaleById` |
| `src/modules/sales/sales.service.ts` | `createSale`, `requestHash`, `isUniqueViolation` |
| `src/modules/sales/sales.routes.ts` | `POST /sales` with `requireAuth` only |
| `src/app.ts` | `app.use("/sales", salesRouter)` |

## Interfaces

```ts
type StockChangeItem = { productId: string; direction: "in" | "out"; quantity: number; reason: string | null };
type StockChanges = {
  tenantId: string; userId: string; source: "adjustment" | "sale"; saleId: string | null;
  notFoundMessage: string; items: StockChangeItem[];
};
type AppliedStockChange = { productId: string; quantity: number; movementId: string; priceCents: number };

applyStockChanges(tx, changes: StockChanges): Promise<AppliedStockChange[]>   // sorted by productId

createSale(tenantId, userId, idempotencyKey, input: CreateSaleInput): Promise<{ sale: Sale; replayed: boolean }>
```

The prompt's `applyStockChanges(tx, changes[])` became one object with the shared fields (tenant, user, source, sale, not-found message) and an `items` array: every change in one call shares them, and a per-item `tenantId` would allow a mixed-tenant call.

## Flows

- **`applyStockChanges`:** sort by `productId` → `lockActiveProductsStock` (one query, `ORDER BY id FOR UPDATE`) → `NotFoundError(notFoundMessage)` if fewer rows than changes → collect `out` shortages → one `ConflictError("Insufficient stock for A (available: x, requested: y), B (…)")` → `in` above `MAX_STOCK` → `ConflictError("Stock cannot exceed 1000000")` → per product, in order: `updateProductStock` and `insertStockMovement`.
- **Sale:** route validates header and body (400) → `createSale` opens `db.transaction`: `insertSale(key, hash)` first → `applyStockChanges(source: "sale", saleId)` → `insertSaleItems` with the locked `priceCents` → `findSaleById` → 201. On `23505`: `findSaleByKey` outside the failed transaction → same hash → `findSaleById`, `replayed: true` → 201 + `Idempotent-Replayed: true`; different hash → 409.
- **Adjustment:** unchanged flow, now `applyStockChanges(tx, [change], { notFoundMessage: "Product not found" })`.

## Decisions

- Lock with one `ORDER BY id FOR UPDATE` query: Postgres locks rows as the sorted result is emitted, so every transaction acquires locks in `id` order. Ids are lowercased by validation, so JS string order and Postgres uuid order agree for the 409 message.
- `stock_movements.created_at` defaults to `clock_timestamp()` instead of `now()`. `now()` is the transaction start: a sale that waited on the product lock started before the sale it waited for, so its movement sorted as older although it ran later, and the history's latest `stockAfter` was not the current stock. Found by the 10-parallel-sales test; concurrent adjustments had the same latent bug. `clock_timestamp()` is read after the lock is held, so per product the history order matches the order the changes were applied.
- One movement insert per item inside the loop, not a multi-row insert: it keeps each movement id paired with its product without relying on the row order of `INSERT ... RETURNING`.
- `isUniqueViolation` is local to the sales service: it is the only caller and the only deliberate `23505` handling in the codebase.
- `findSaleById` runs two queries (sale + user, items + products) and computes `totalCents` in JS. Neither join filters `deleted_at`: a sale is a past fact.
- `requestHash` hashes `JSON.stringify` of `{ productId, quantity }` sorted by `productId`.
- Concurrent requests with the same key: the second `INSERT` waits on the unique index until the first transaction ends, then fails with `23505` (replay) or proceeds (first rolled back).

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| ------- | -------- | ------ | ---------- |
| Deadlock between sales with the same products | `applyStockChanges` | 500 | Locks always taken in `productId` order inside the function |
| Duplicate sale on retry | `createSale` | Stock decremented twice | Unique `(tenant_id, idempotency_key)`, inserted before any stock change |
| `23505` from another constraint being replayed | `createSale` | Wrong replay | Duplicate products rejected by validation; ids come from the database; `findSaleByKey` missing → rethrow as 500 |
| Pool exhaustion in parallel tests | `infra/db.ts` (default pool max 10) | Slow tests | Requests queue for a connection; no lock is held while waiting |
