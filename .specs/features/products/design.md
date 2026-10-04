# Products Design

**Spec**: `.specs/features/products/spec.md`

Conforms to AD-001 (errors), AD-002 (tenancy by `tenant_id` + composite FKs), AD-003 (`req.auth` from the token) and AD-004 (real test database).

## Components

| File | Responsibility |
| ---- | -------------- |
| `src/infra/schemas/products.ts` | Drizzle `products` table exactly as in the prompt: partial unique `(tenant_id, sku)`, unique `(tenant_id, id)`, checks on uppercase SKU, price and stock |
| `src/infra/migrations/0001_*.sql` | Generated with `db:generate` |
| `src/modules/products/products.validation.ts` | `createProductSchema`, `updateProductSchema` (refine: at least one field), `productIdSchema` (`z.uuid()`), `listProductsQuerySchema` |
| `src/modules/products/products.repository.ts` | `findActiveProductById`, `findActiveProductBySku`, `insertProduct`, `updateProduct`, `softDeleteProduct`, `listProducts`; all take `tenantId` first and `executor: Executor = db` last, all filter `deleted_at IS NULL` |
| `src/modules/products/products.service.ts` | `listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`; write paths run in `db.transaction` and pass `tx` to the repository |
| `src/modules/products/products.routes.ts` | `productsRouter` with `requireAuth` on all routes and `requireRole("admin")` on writes; parses body/query/params |
| `src/app.ts` | Mounts `/products` before `notFoundHandler` |
| `src/infra/seed/seed.ts` | `products` per seed tenant and `createProductIfMissing` checking tenant + SKU among active rows |

## Flows

- **Create:** route parses body → service opens a transaction → `findActiveProductBySku(tenantId, sku, tx)` → `ConflictError` if found → `insertProduct` → 201.
- **Update / delete:** route parses `:id` (`NotFoundError` on bad uuid) → service transaction → `findActiveProductById` → `NotFoundError` if missing → `updateProduct` / `softDeleteProduct` → 200 / 204.
- **List:** route parses query → repository builds one `where` (tenant, not deleted, optional search, optional stock filter) shared by the page query and the `count()` query.

## Decisions

- One `productColumns` select object (`id, sku, name, priceCents, stock, createdAt, updatedAt`) used by every select and `returning`, so the response shape never leaks `tenantId` or `deletedAt`.
- Search escapes `\`, `%`, `_` with a backslash (`replace(/[\\%_]/g, "\\$&")`); Postgres `ILIKE` uses `\` as the default escape character, so no `ESCAPE` clause is needed.
- `page`/`limit` use `z.coerce.number().int()` with bounds; `outOfStock` is `z.enum(["true", "false"])` mapped to a boolean, so `1`, `yes` or an empty string get 400.
- `updatedAt` relies on the existing `$onUpdate` in `columns.ts`.
- The duplicate-SKU check is not locked: a concurrent race hits the partial unique index and becomes a 500 (accepted in `CLAUDE.md` and the prompt).

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| ------- | -------- | ------ | ---------- |
| Non-uuid `:id` reaching Postgres becomes a 500 | `products.routes.ts` | Wrong status | `productIdSchema` parsed in the route throws `NotFoundError` before any query |
| `count()` and page query drifting apart | `products.repository.ts` | Wrong `total` | Single shared `where` expression |
