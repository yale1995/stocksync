# API Docs Specification

## Problem Statement

The assessment lists OpenAPI documentation as a bonus, and the reviewers will explore the API before the presentation. Today the API has no machine-readable contract. This feature generates an OpenAPI document from the Zod schemas the controllers already validate with (`zod-openapi`), serves it, and renders it with Scalar. Response shapes become Zod schemas too, and the tests parse real responses with them, so the document cannot drift from what the API returns.

## Goals

- [ ] Every public route of the backend is described in one OpenAPI 3.1 document, with request and response schemas taken from Zod
- [ ] A reviewer can open `/docs`, log in and call any endpoint from the browser
- [ ] A test fails when a route is added without being documented, or when a response no longer matches its documented schema

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `apps/ads-mock` documentation | Internal simulated service, not part of the product API |
| Env flag to disable `/docs` | Agreed: always enabled for the assessment; listed as a README limitation |
| Generating a frontend client from the spec | Part C decision, not this feature |
| Validating responses at runtime | Tests assert response shapes; production does not pay the cost |
| Swagger UI | Replaced by Scalar |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Generator | `zod-openapi` 6 (`createDocument`), peer `zod ^4` | Agreed with the user | y |
| UI | `@scalar/express-api-reference` | Agreed with the user | y |
| Response schemas | Zod schemas in the `*.validation.ts` files, used by the document and parsed in tests | Agreed with the user | y |
| Docs exposure | Always enabled, no auth | Agreed with the user | y |
| Paths | `GET /openapi.json` (document) and `GET /docs` (Scalar) | Common convention, no clash with existing routes | n |
| OpenAPI version | 3.1.0 | Zod 4 emits JSON Schema 2020-12, which 3.1 uses natively | n |
| Strictness in tests | Response schemas are `z.strictObject`, so an extra field fails the parse and the document declares `additionalProperties: false` | A leaked column (e.g. `tenantId`, `passwordHash`) must fail a test | n |
| Route coverage source | `app.ts` mounts routers from one exported table; the test walks each router's `stack` (`route.path`, `route.methods`) and joins it with the mount prefix | Express 5 hides the mount path of a router layer, so the table is the only reliable source | n |
| Path param syntax | Express `:id` maps to OpenAPI `{id}` | OpenAPI path templating | n |
| Which tests parse response schemas | The main success test of every documented 2xx JSON response, plus one test per error status that the error envelope schema covers | Proves each schema against a real response without rewriting every test | n |
| Docs routes in the document | `/docs` and `/openapi.json` are excluded from the document and from the coverage check | They describe the API, they are not part of it | n |
| Scalar assets | Loaded by the Scalar middleware from its CDN | Default behavior of the package; no CSP is configured in the backend | n |
| Seeded credentials on the page | Listed only when `NODE_ENV` is not `production`, built from `seedTenants` | Reviewers need them; `/docs` is public in every environment | y |
| Where the introduction lives | `http/openapi-description.ts` exporting Markdown strings | `tsc` does not copy a `.md` file to `dist` | y |
| Seed users switch | `createOpenApiDocument({ showSeedUsers })`; the docs controller passes `env.NODE_ENV !== "production"` | Keeps the document builder free of env reads and testable both ways | y |
| Seeded product ids | Stay random (`uuidv7()`); no `{id}` or sale example points to a seeded product | User decision: the seed stays as it was | y |
| Idempotency-Key example | One fixed uuid in every environment; the header description says to use a new key for a new sale | Not seed data; resending it shows the replay | y |
| Query parameter examples | None | A prefilled `search` or `outOfStock` would filter the first list call and hide products | n |
| Body examples | `POST /products` (`MUG-01`, absent from the seed), `PATCH /products/{id}` and the stock adjustment carry one example in every environment | They hold no seed data | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: OpenAPI document ⭐ MVP

**User Story**: As a reviewer, I want a machine-readable contract of the API so that I can see every endpoint, its inputs and its responses without reading the code.

**Acceptance Criteria**:

1. DOCS-01: WHEN a client calls `GET /openapi.json` THEN the system SHALL respond 200 with a JSON OpenAPI 3.1.0 document
2. DOCS-02: The document SHALL describe every route mounted by the backend app, except `/docs` and `/openapi.json`, with its method and path in OpenAPI syntax (`{id}`)
3. DOCS-03: The document SHALL take every request body, query and path parameter schema from the Zod schema the controller validates with
4. DOCS-04: The document SHALL declare, for every operation, each response status the route can return (2xx, 400, 401, 403, 404, 409 as applicable) with its schema
5. DOCS-05: The document SHALL describe every error response with one shared schema `{ error: { code, message } }`, where `code` is one of the `AppError` codes
6. DOCS-06: The document SHALL declare a security scheme of type `apiKey` in cookie `access_token`, and SHALL apply it to every operation that uses `requireAuth`
7. DOCS-07: The document SHALL declare the required `Idempotency-Key` header (uuid) on `POST /sales` and the `Idempotent-Replayed` header on its 201 response
8. DOCS-08: The document SHALL state, in each admin-only operation's description, that the operation requires the `admin` role
9. DOCS-09: The document SHALL declare a `Set-Cookie` header on the 200 response of `POST /auth/login`

**Independent Test**: `GET /openapi.json` returns a document whose paths match the app's routes, and parses with the OpenAPI 3.1 structure.

---

### P1: Scalar reference page ⭐ MVP

**User Story**: As a reviewer, I want an interactive page so that I can log in and try the endpoints from the browser.

**Acceptance Criteria**:

1. DOCS-10: WHEN a client calls `GET /docs` THEN the system SHALL respond 200 with an HTML page that loads Scalar pointing to `/openapi.json`
2. DOCS-11: The docs routes SHALL be public: a request without a cookie SHALL not get 401
3. DOCS-26: The Scalar page SHALL select HTTPie (`shell` / `httpie`) as the default HTTP client for code samples

**Independent Test**: Open `/docs`, call `POST /auth/login` with a seeded user, then call `GET /products` and get 200.

---

### P1: Response schemas proven by tests ⭐ MVP

**User Story**: As the author, I want the documented response schemas checked against real responses so that the document cannot drift from the API.

**Acceptance Criteria**:

1. DOCS-12: The system SHALL define a strict Zod response schema for: current user, product, paginated product list, stock movement, paginated stock movement list, sale, sync status, health and the error envelope
2. DOCS-13: The document SHALL use these same schema objects for its responses (no duplicated definitions)
3. DOCS-14: The tests SHALL parse, with the matching response schema, the body of the main success test of every documented 2xx JSON response
4. DOCS-15: IF a response body has a field missing, a field with the wrong type, or an extra field THEN the parse in the test SHALL fail
5. DOCS-16: The tests SHALL parse with the error envelope schema at least one real response for each of 400, 401, 403, 404 and 409

**Independent Test**: Add an extra field to the product response; the products test fails.

---

### P1: Route coverage check ⭐ MVP

**User Story**: As the author, I want a failing test when a route is not documented so that the document stays complete.

**Acceptance Criteria**:

1. DOCS-17: IF a route mounted by the backend app has no matching operation in the document THEN the coverage test SHALL fail naming the method and path
2. DOCS-18: IF the document has an operation with no matching mounted route THEN the coverage test SHALL fail naming the method and path

**Independent Test**: Remove one path from the document; the coverage test fails naming it.

---

### P2: Introduction page

**User Story**: As a reviewer, I want the docs page to explain how the API works so that I can use it without reading the README or the code.

**Why P2**: The reference is usable without it, but the rules that matter most (tenancy, idempotency, sync) are invisible in schemas.

**Acceptance Criteria**:

1. DOCS-19: The document SHALL have an `info.description` in Markdown with the sections "Getting started", "Authentication and tenancy", "Roles" and "Conventions"
2. DOCS-20: The "Conventions" section SHALL list each error status with its code (400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`, 500 `INTERNAL_SERVER_ERROR`)
3. DOCS-21: WHERE seed users are shown the description SHALL list every user of `seedTenants` with tenant, role, email and password
4. DOCS-22: IF `NODE_ENV` is `production` THEN the description SHALL contain no seeded email or password
5. DOCS-23: The document SHALL declare a description for every tag that an operation uses, and no operation SHALL use an undeclared tag
6. DOCS-24: The `Sales` tag description SHALL state that a sale is all-or-nothing, that the same key with the same items replays with `Idempotent-Replayed: true`, that the same key with different items answers `409`, and that only a successful sale keeps its key
7. DOCS-25: The `Sync` tag description SHALL explain each status: `pending`, `sent`, `failed` and `superseded`
8. DOCS-27: WHERE seed users are shown the `POST /auth/login` request body SHALL offer one example per user of `seedTenants` (`{ email, password }`), the Acme admin first so Scalar fills it in by default; otherwise it SHALL offer no example

**Independent Test**: Open `/docs` in development and read the introduction with the seeded users; build the document with `showSeedUsers: false` and find no password.

---

### P2: Request examples

**User Story**: As a reviewer, I want request bodies prefilled with valid values so that I can send them from `/docs` without writing JSON.

**Why P2**: Removes friction when trying the API; the reference works without it.

**Acceptance Criteria**:

1. DOCS-28: The `POST /products`, `PATCH /products/{id}` and `POST /products/{id}/stock-adjustments` bodies SHALL offer one example each, in every environment
2. DOCS-29: The `Idempotency-Key` header SHALL offer one fixed uuid example, and its description SHALL state that a new sale needs a new key
3. DOCS-30: Every request body example in the document SHALL pass the operation's Zod request schema

**Independent Test**: Open `/docs`, log in as admin and send `POST /products` without editing the body.

---

## Edge Cases

- WHEN an input schema uses a transform (e.g. `search` trim, `outOfStock` `"true"`/`"false"`) THEN the document SHALL describe the input the client sends, not the parsed output
- WHEN an input schema uses a refine (e.g. `updateProductSchema` "at least one field", unique `productId` in a sale) THEN the document SHALL state the rule in the schema description
- WHEN a route answers 204 (`DELETE /products/:id`, `POST /auth/logout`) THEN the document SHALL declare 204 with no content
- WHEN a path parameter is not a uuid THEN the document SHALL declare 404 for that operation (AD-008), not 400

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DOCS-01 | P1: OpenAPI document | Execute | Verified |
| DOCS-02 | P1: OpenAPI document | Execute | Verified |
| DOCS-03 | P1: OpenAPI document | Execute | Verified |
| DOCS-04 | P1: OpenAPI document | Execute | Verified |
| DOCS-05 | P1: OpenAPI document | Execute | Verified |
| DOCS-06 | P1: OpenAPI document | Execute | Verified |
| DOCS-07 | P1: OpenAPI document | Execute | Verified |
| DOCS-08 | P1: OpenAPI document | Execute | Verified |
| DOCS-09 | P1: OpenAPI document | Execute | Verified |
| DOCS-10 | P1: Scalar reference page | Execute | Verified |
| DOCS-11 | P1: Scalar reference page | Execute | Verified |
| DOCS-12 | P1: Response schemas proven by tests | Execute | Verified |
| DOCS-13 | P1: Response schemas proven by tests | Execute | Verified |
| DOCS-14 | P1: Response schemas proven by tests | Execute | Verified |
| DOCS-15 | P1: Response schemas proven by tests | Execute | Verified |
| DOCS-16 | P1: Response schemas proven by tests | Execute | Verified |
| DOCS-17 | P1: Route coverage check | Execute | Verified |
| DOCS-18 | P1: Route coverage check | Execute | Verified |
| DOCS-19 | P2: Introduction page | Execute | Verified |
| DOCS-20 | P2: Introduction page | Execute | Verified |
| DOCS-21 | P2: Introduction page | Execute | Verified |
| DOCS-22 | P2: Introduction page | Execute | Verified |
| DOCS-23 | P2: Introduction page | Execute | Verified |
| DOCS-24 | P2: Introduction page | Execute | Verified |
| DOCS-25 | P2: Introduction page | Execute | Verified |
| DOCS-26 | P1: Scalar reference page | Execute | Verified |
| DOCS-27 | P2: Introduction page | Execute | Verified |
| DOCS-28 | P2: Request examples | Execute | Verified |
| DOCS-29 | P2: Request examples | Execute | Verified |
| DOCS-30 | P2: Request examples | Execute | Verified |

**Coverage:** 30 total, 30 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
- [ ] `/docs` opens in the browser, login works from Scalar and an authenticated call returns 200
