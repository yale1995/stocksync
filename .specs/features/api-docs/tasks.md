# API Docs Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted on branch `feat/api-docs`, and are committed with the `commit` skill after review.

---

**Design**: inline (no new architectural pattern).

- Response schemas are `z.strictObject` in the `*.validation.ts` file of each feature, next to the input schemas. Shared pieces (error envelope, `paginated(item)`) live in `http/controllers/common.validation.ts`. Dates are `z.iso.datetime({ offset: true })` strings, the JSON form the API sends.
- Each schema that appears in the document gets `.meta({ id })`, so it renders once under `components.schemas`.
- `http/openapi.ts` exports `createOpenApiDocument()` built with `zod-openapi` `createDocument` (OpenAPI 3.1.0). It imports the same schema objects the controllers and tests use.
- `app.ts` mounts the API routers from one exported table `apiRoutes: { path, router }[]`; the coverage test reads that table and each router's `stack` (`route.path`, `route.methods`). `/docs` and `/openapi.json` are mounted outside the table.
- `http/controllers/docs.controller.ts` serves `GET /openapi.json` (the document) and `GET /docs` (`@scalar/express-api-reference` with `url: "/openapi.json"`).

**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md`, `AGENTS.md`, `vitest.config.ts` (no coverage threshold), existing tests in `src/modules/*/*.test.ts` (supertest against the real test database).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Response schemas (`*.validation.ts`) | integration (parse real responses) | Main success test of every documented 2xx JSON response parses with its schema; one real error response per status 400, 401, 403, 404, 409 | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| OpenAPI document (`http/openapi.ts`) | unit | Every DOCS AC about document content and every listed edge case | `src/http/openapi.test.ts` | `pnpm --filter stocksync-api exec vitest run src/http` |
| Docs routes and route table | integration (supertest) | Both routes, public access, coverage in both directions | `src/http/controllers/docs.test.ts` | `pnpm --filter stocksync-api test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api exec vitest run src/http` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion or config-only tasks | `pnpm typecheck && pnpm test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Response schemas

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

### Phase 2: Document and routes

```
T8 → T9
```

### Phase 3: Introduction page

```
T10 → T11 → T12 → T13
```

### Phase 4: Request examples

```
T14
```

---

## Task Breakdown

### T1: Error envelope and pagination schemas

**What**: `errorResponseSchema` (`{ error: { code, message } }`, `code` an enum of the `AppError` codes) and `paginated(item)` (`{ data: item[], meta: { page, limit, total } }`); parse one real 400, 401, 403, 404 and 409 response with `errorResponseSchema`.
**Where**: `apps/backend/src/http/controllers/common.validation.ts` (new)
**Depends on**: None
**Reuses**: codes from `infra/errors.ts`
**Requirement**: DOCS-12, DOCS-15, DOCS-16

**Done when**:

- [x] Existing tests for 400, 401, 403, 404 and 409 parse their body with `errorResponseSchema`
- [x] Gate passes with the same test count as before

**Tests**: integration
**Gate**: full

---

### T2: Current user schema

**What**: `currentUserSchema` (`{ id, email, role, tenant: { id, name } }`), parsed in the login and `GET /auth/me` success tests.
**Where**: `apps/backend/src/http/controllers/auth.validation.ts`
**Depends on**: T1
**Reuses**: `userRole` enum values
**Requirement**: DOCS-12, DOCS-14

**Done when**:

- [x] Login 200 and `/auth/me` 200 bodies parse with `currentUserSchema`

**Tests**: integration
**Gate**: full

---

### T3: Product schemas

**What**: `productSchema` and `productListSchema = paginated(productSchema)`, parsed in the success tests of list, get, create and update.
**Where**: `apps/backend/src/http/controllers/products.validation.ts`
**Depends on**: T2
**Reuses**: `paginated` (T1)
**Requirement**: DOCS-12, DOCS-14

**Done when**:

- [x] `GET /products`, `GET /products/:id`, `POST /products` and `PATCH /products/:id` success bodies parse

**Tests**: integration
**Gate**: full

---

### T4: Stock movement schemas

**What**: `stockMovementSchema` and `stockMovementListSchema`, parsed in the adjustment 201 and history 200 success tests.
**Where**: `apps/backend/src/http/controllers/stock-movements.validation.ts`
**Depends on**: T3
**Reuses**: `stockMovementDirection` and source enum values, `paginated`
**Requirement**: DOCS-12, DOCS-14

**Done when**:

- [x] Adjustment and history success bodies parse

**Tests**: integration
**Gate**: full

---

### T5: Sale schema

**What**: `saleSchema` (`{ id, items[{ productId, sku, name, quantity, unitPriceCents }], totalCents, createdAt, user: { id, email } }`), parsed in the create and replay success tests.
**Where**: `apps/backend/src/http/controllers/sales.validation.ts`
**Depends on**: T4
**Reuses**: —
**Requirement**: DOCS-12, DOCS-14

**Done when**:

- [x] First sale 201 and replayed 201 bodies parse

**Tests**: integration
**Gate**: full

---

### T6: Sync status schema

**What**: `syncStatusSchema` (`{ pending, sent, failed, superseded, lastSuccessfulSyncAt, failedEvents[...] }`), parsed in the sync status success test with a failed event and a sent event present.
**Where**: `apps/backend/src/http/controllers/sync.validation.ts` (new)
**Depends on**: T5
**Reuses**: `sync_event_trigger` enum values
**Requirement**: DOCS-12, DOCS-14

**Done when**:

- [x] A body with non-null `lastSuccessfulSyncAt` and one failed event parses

**Tests**: integration
**Gate**: full

---

### T7: Health schema

**What**: `healthSchema` (`{ status: "ok" }`), parsed in the health test.
**Where**: `apps/backend/src/http/controllers/health.validation.ts` (new)
**Depends on**: T6
**Reuses**: —
**Requirement**: DOCS-12, DOCS-14

**Done when**:

- [x] Health body parses; phase build gate passes

**Tests**: integration
**Gate**: build

---

### T8: OpenAPI document

**What**: Install `zod-openapi`; `createOpenApiDocument()` describing every API route with request schemas from the controllers' Zod schemas, response schemas from Phase 1, the cookie security scheme, `Idempotency-Key` / `Idempotent-Replayed`, `Set-Cookie` on login, the admin role note, 204 responses and 404 for non-uuid ids.
**Where**: `apps/backend/src/http/openapi.ts` (new)
**Depends on**: None (runs after Phase 1, whose schemas it imports)
**Reuses**: every `*.validation.ts` schema, `ACCESS_TOKEN_COOKIE`
**Requirement**: DOCS-03, DOCS-04, DOCS-05, DOCS-06, DOCS-07, DOCS-08, DOCS-09, DOCS-13, DOCS-15

**Done when**:

- [x] `openapi.test.ts` asserts each AC above and the edge cases (transform input form, refine description, 204 without content, 404 on uuid paths) on the generated document

**Tests**: unit
**Gate**: quick

---

### T9: Docs routes and route coverage

**What**: Install `@scalar/express-api-reference`; `docs.controller.ts` with `GET /openapi.json` and `GET /docs`; `app.ts` mounts API routers from an exported `apiRoutes` table and mounts the docs router outside it; coverage test in both directions.
**Where**: `apps/backend/src/http/controllers/docs.controller.ts` (new)
**Depends on**: T8
**Reuses**: `createOpenApiDocument` (T8)
**Requirement**: DOCS-01, DOCS-02, DOCS-10, DOCS-11, DOCS-17, DOCS-18

**Done when**:

- [x] `docs.test.ts` covers both routes without a cookie, the document version and the coverage check in both directions
- [x] Build gate passes

**Tests**: integration
**Gate**: build

---

### T10: Introduction and tag descriptions

**What**: `apiDescription({ showSeedUsers })` (Markdown intro; seed users table built from `seedTenants` only when asked) and `tagDescriptions` (Health, Auth, Products, Stock movements, Sales, Sync).
**Where**: `apps/backend/src/http/openapi-description.ts` (new)
**Depends on**: None (runs after Phase 2)
**Reuses**: `seedTenants`
**Requirement**: DOCS-19, DOCS-20, DOCS-21, DOCS-22, DOCS-24, DOCS-25

**Done when**:

- [x] `openapi-description.test.ts` asserts the sections, the error code table, every seeded user with `showSeedUsers: true`, no seeded email or password with `false`, and the Sales and Sync rules

**Tests**: unit
**Gate**: quick

---

### T11: Wire the introduction into the document

**What**: `createOpenApiDocument({ showSeedUsers })` sets `info.description` and `tags`; `docs.controller.ts` passes `env.NODE_ENV !== "production"`.
**Where**: `apps/backend/src/http/openapi.ts`
**Depends on**: T10
**Reuses**: `apiDescription`, `tagDescriptions`
**Requirement**: DOCS-19, DOCS-21, DOCS-22, DOCS-23

**Done when**:

- [x] `openapi.test.ts` asserts the description in both modes and that operation tags and declared tags match
- [x] `docs.test.ts` asserts the served document shows the seeded users outside production
- [x] Build gate passes

**Tests**: unit
**Gate**: build

---

### T12: HTTPie as the default HTTP client

**What**: `apiReference` receives `defaultHttpClient: { targetKey: "shell", clientKey: "httpie" }`.
**Where**: `apps/backend/src/http/controllers/docs.controller.ts`
**Depends on**: T11
**Reuses**: Scalar configuration
**Requirement**: DOCS-26

**Done when**:

- [x] `docs.test.ts` asserts the rendered page configures HTTPie as the default client
- [x] Build gate passes

**Tests**: integration
**Gate**: build

---

### T13: Seeded users as login examples

**What**: Outside production, the `POST /auth/login` body offers one example per seeded user, Acme admin first; `paths` becomes `apiPaths(showSeedUsers)`.
**Where**: `apps/backend/src/http/openapi.ts`
**Depends on**: T12
**Reuses**: `seedTenants`, `body()`
**Requirement**: DOCS-27

**Done when**:

- [x] `openapi.test.ts` asserts the examples in both modes and the default order
- [x] Build gate passes

**Tests**: unit
**Gate**: build

---

### T14: Request examples in the document

**What**: Body examples for `POST /products`, `PATCH /products/{id}` and the stock adjustment; Idempotency-Key example and description.
**Where**: `apps/backend/src/http/openapi.ts`
**Depends on**: None (runs after Phase 3)
**Reuses**: request schemas
**Requirement**: DOCS-28, DOCS-29, DOCS-30

**Done when**:

- [x] `openapi.test.ts` asserts each example in both modes and parses every body example with its request schema
- [x] Build gate passes

**Tests**: unit
**Gate**: build

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 → T2 → T3 → T4 → T5 → T6 → T7
Phase 2:  T8 → T9
Phase 3:  T10 → T11 → T12 → T13
Phase 4:  T14
```
