# Stock Movements Design

**Spec**: `.specs/features/stock-movements/spec.md`

Conforms to AD-001 (errors), AD-002 (tenancy + composite FKs), AD-003 (`req.auth`), AD-004 (real test database), AD-007 (pagination) and AD-008 (non-uuid id → 404). Introduces AD-009..AD-011.

## Components

| File | Responsibility |
| ---- | -------------- |
| `src/infra/schemas/stock-movements.ts` | `stock_movement_direction` and `stock_movement_source` pgEnums; `stock_movements` table with composite FKs to `products` and `users`, the five CHECKs and the history index. Only `createdAt`, no `timestamps` spread (append-only) |
| `src/infra/migrations/0002_*.sql` | Generated with `db:generate` |
| `src/modules/products/products.validation.ts` | Exports `MAX_STOCK = 1_000_000`, used by the `stock` schema |
| `src/modules/products/products.repository.ts` | New `lockActiveProductStock(tenantId, id, executor)` (`SELECT id, stock … FOR UPDATE`, tenant + `deleted_at IS NULL`) and `updateProductStock(tenantId, id, stock, executor)` |
| `src/modules/products/products.service.ts` | `createProduct(tenantId, userId, input)` calls `recordInitialMovement` after `insertProduct` in the same transaction |
| `src/modules/products/products.routes.ts` | Passes `req.auth.userId`; exports `parseProductId` |
| `src/modules/stock-movements/stock-movements.validation.ts` | `createStockAdjustmentSchema`, `listStockMovementsQuerySchema` |
| `src/modules/stock-movements/stock-movements.repository.ts` | `insertStockMovement`, `findStockMovementById`, `listStockMovements`; one `movementColumns` select with `user: { id, email }` from an inner join on users by `(tenant_id, user_id)` without a `deleted_at` filter |
| `src/modules/stock-movements/stock-movements.service.ts` | `applyStockChange(tx, change)`, `recordInitialMovement(tx, …)`, `createStockAdjustment`, `listProductStockMovements` |
| `src/modules/stock-movements/stock-movements.routes.ts` | `Router({ mergeParams: true })` with `requireAuth`; `POST /stock-adjustments` (admin), `GET /stock-movements` |
| `src/app.ts` | `app.use("/products/:id", stockMovementsRouter)` before `/products` |
| `src/infra/seed/seed.ts` | Keeps the admin id; product insert + `initial` movement inside `executor.transaction` |
| `CLAUDE.md`, `AGENTS.md` | Append-only exception to the soft delete rule |

## Flows

- **Adjustment:** route parses `:id` (404 on bad uuid) and body → service opens `db.transaction` → `applyStockChange(tx, { …, source: "adjustment" })` → `findStockMovementById` → 201.
- **`applyStockChange`:** `lockActiveProductStock` → `NotFoundError` if missing → compute `next = stock ± quantity` → `ConflictError("Insufficient stock")` if `next < 0`, `ConflictError("Stock cannot exceed 1000000")` if `next > MAX_STOCK` → `updateProductStock` → `insertStockMovement({ …, stockAfter: next })` → returns the inserted movement id.
- **History:** route parses `:id` and query → service checks `findActiveProductById` (404) → `listStockMovements` with one shared `where` for page and `count()` → `{ data, meta }`.
- **Product creation:** `findActiveProductBySku` → `insertProduct` → `recordInitialMovement` (`in`, `initial`, `quantity = stockAfter = stock`, `reason: null`).

## Decisions

- `applyStockChange` lives in the stock-movements service: it is the business rule for every stock change, and sales (PR 5) and the Part B outbox call it inside their own transaction. Products-table SQL stays in the products repository. Import graph: products.service → stock-movements.service → products.repository / stock-movements.repository, with no cycle.
- `recordInitialMovement` skips the lock: the product row was inserted in the same transaction and no other transaction can see it yet.
- The adjustment response is read back with `findStockMovementById` so both endpoints return the same shape from the same select.
- The seed writes the movement row directly with the schema (no import from `modules/`), inside `executor.transaction`: a savepoint under `run.ts`'s transaction, a real transaction when tests pass `db`.

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| ------- | -------- | ------ | ---------- |
| Ledger drifting from `products.stock` | `applyStockChange` | Wrong audit trail | Stock update and movement insert in the same transaction under the row lock; `stock_after` written from the same computed value |
| Movement pointing to another tenant's product or user | schema | Isolation leak | Composite FKs `(tenant_id, product_id)` and `(tenant_id, user_id)` |
| Direct DB writes bypassing Zod | schema | Incoherent rows | Five CHECK constraints |
| Double `requireAuth` when both routers match | `app.ts` | None functionally | Stock-movement router is mounted first and only matches its two paths |
