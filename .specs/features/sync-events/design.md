# Sync Events Design

**Spec**: `.specs/features/sync-events/spec.md`

Conforms to AD-002 (tenancy + composite FKs), AD-004 (real test database), AD-012 (`applyStockChanges` is the only stock path). Introduces AD-016 (outbox), AD-017 (table-wide `version` sequence) and AD-018 (lock, decide, write).

## Components

| File | Responsibility |
| ---- | -------------- |
| `src/infra/schemas/sync-events.ts` | `sync_event_trigger`/`sync_event_status` enums, `sync_events` table with identity `version`, composite FK, CHECKs and indexes. No `deleted_at` (commented) |
| `src/infra/migrations/0004_*.sql` | Generated with `db:generate` |
| `src/modules/sync/sync.repository.ts` | `insertSyncEvent(values, executor)` |
| `src/modules/sync/sync.service.ts` | `recordSyncEvent(tx, event)`; documents the "insert after locking the product" invariant |
| `src/modules/products/products.service.ts` | `createProduct` records `product_created`; `updateProduct`/`deleteProduct` lock with `lockActiveProductsStock(tenantId, [id], tx)`, decide from the locked row, write, record |
| `src/modules/stock-movements/stock-movements.service.ts` | `applyStockChanges` records `stock_changed` per applied item |
| `src/infra/seed/seed.ts` | `createProductIfMissing` inserts a `product_created` event in its transaction |

## Version ordering

`version` is `GENERATED ALWAYS AS IDENTITY`: one sequence for the whole table. The value is drawn when the row is inserted, and every flow inserts after the product row is locked (or, on creation, after inserting it), so two changes to the same product are serialized by the row lock and the later one draws the greater value. A per-product counter would restart on recreate; a timestamp can tie or reflect the transaction start.

## Testing

- `src/modules/sync/sync-events.test.ts`: route-level tests through `createApp()` for every flow, raw-insert tests for each CHECK and the composite FK (lessons L-006, L-007), and a concurrent `Promise.all` of two price PATCHes.
- `src/infra/seed/seed.test.ts`: one `product_created` event per seeded product, none added on a second run.
