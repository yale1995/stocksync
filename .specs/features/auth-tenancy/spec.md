# Authentication and Multi-tenancy Specification

## Problem Statement

StockSync serves several companies (tenants) from one database. Users need to log in, and every later module (products, stock, sales) needs to know who the caller is, which tenant they belong to and which role they hold, so data never crosses tenants and admin-only actions stay protected.

## Goals

- [ ] Users log in with email and password and get a 1h session in an `httpOnly` cookie
- [ ] Every authenticated request carries `{ userId, tenantId, role }` taken only from the token
- [ ] Tenants and users tables exist with soft delete, `timestamptz` and the composite key for future tenant-owned FKs
- [ ] Tests run against a real, isolated Postgres database

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Products CRUD, tenant isolation test, product seed | PR 3 |
| Refresh tokens | Agreed: 1h access token only |
| Rate limiting on login | Known limitation |
| Row Level Security | May be evaluated later |
| JSON-only (415) guard | Dropped by the user |
| Revoking tokens of deleted users | Accepted trade-off: `requireAuth` does not hit the database |
| README and `.env.example` | Not now / env documented by `env.ts` |
| Frontend | Out of scope for this task |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/01-errors-auth-multitenancy.md` | Applied as written | Agreed with the user | y |
| `NODE_ENV` when unset | Defaults to `development` | `pnpm dev` keeps working without setting it | y |
| `GET /auth/me` when the user's tenant is soft deleted | 401 `UnauthorizedError`, same as a deleted user | Consistent with login, which rejects deleted tenants; a user belongs to exactly one tenant | y |
| Logout cookie clearing | `res.clearCookie` with the same options minus `maxAge` | Express 5 ignores `maxAge`/`expires` on clear | y |
| Local `CORS_ORIGIN` value | `http://localhost:5173` | Vite default; the frontend is not set up yet | n |
| `requireRole` without a prior `requireAuth` | Not supported; always used after `requireAuth` | Documented usage pattern | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Login ⭐ MVP

**User Story**: As a tenant user, I want to log in with my email and password so that I can use the API.

**Acceptance Criteria**:

1. AUTH-01: WHEN valid credentials are posted to `POST /auth/login` THEN the system SHALL respond 200 with `{ id, email, role, tenant: { id, name } }`
2. AUTH-02: WHEN login succeeds THEN the system SHALL set an `access_token` cookie with `HttpOnly`, `SameSite=Lax`, `Path=/` and `Max-Age=3600`, and SHALL NOT return the token in the body
3. AUTH-03: WHILE `NODE_ENV` is `production` the system SHALL set the `Secure` flag on the cookie
4. AUTH-04: IF the password is wrong THEN the system SHALL respond 401 `UNAUTHORIZED` with message `Invalid email or password`
5. AUTH-05: IF the email is unknown THEN the system SHALL respond 401 `UNAUTHORIZED` with message `Invalid email or password` after running `bcrypt.compare` against a fixed dummy hash
6. AUTH-06: IF the user or their tenant is soft deleted THEN the system SHALL respond 401 `UNAUTHORIZED` with message `Invalid email or password`
7. AUTH-07: IF the body has an invalid email format or an empty password THEN the system SHALL respond 400 `VALIDATION_ERROR`
8. AUTH-08: The system SHALL compare emails in lowercase at login
9. AUTH-09: The system SHALL sign the token with HS256 using `JWT_SECRET`, valid for 1h, with claims `sub`, `tenantId` and `role`

**Independent Test**: log in with a seeded user and inspect the body and `Set-Cookie`.

---

### P1: Current user and logout ⭐ MVP

**User Story**: As a logged-in user, I want to see who I am and to log out.

**Acceptance Criteria**:

1. AUTH-10: WHEN `GET /auth/me` is called with a valid cookie THEN the system SHALL respond 200 with the same body shape as login, for the token's user and their own tenant
2. AUTH-11: IF the user is soft deleted after the token was issued THEN `GET /auth/me` SHALL respond 401 `UNAUTHORIZED`
3. AUTH-12: WHEN `POST /auth/logout` is called, with or without a valid cookie, THEN the system SHALL respond 204 and clear the `access_token` cookie with the same options

**Independent Test**: login → me → logout with supertest.

---

### P1: Authorization middlewares ⭐ MVP

**User Story**: As a developer of later modules, I want `requireAuth` and `requireRole` so that routes can be protected in one line.

**Acceptance Criteria**:

1. AUTH-13: IF the `access_token` cookie is missing THEN `requireAuth` SHALL respond 401 `UNAUTHORIZED`
2. AUTH-14: IF the token is invalid (bad signature, malformed, or not HS256) THEN `requireAuth` SHALL respond 401 `UNAUTHORIZED`
3. AUTH-15: IF the token is expired THEN `requireAuth` SHALL respond 401 `UNAUTHORIZED`
4. AUTH-16: WHEN the token is valid THEN `requireAuth` SHALL set `req.auth = { userId, tenantId, role }` from the token claims without querying the database
5. AUTH-17: IF `req.auth.role` is not in the allowed list THEN `requireRole` SHALL respond 403 `FORBIDDEN`
6. AUTH-18: WHEN `req.auth.role` is in the allowed list THEN `requireRole` SHALL pass control to the handler

**Independent Test**: throwaway admin-only route hit with an operator token and an admin token.

---

### P1: Tenancy data model ⭐ MVP

**User Story**: As the system, I want tenants and users stored with soft delete and tenant-scoped keys so that later tables can reference them safely.

**Acceptance Criteria**:

1. TEN-01: The system SHALL store `tenants` with `id` (uuid, default `uuidv7()`), `name`, `created_at`, `updated_at` and nullable `deleted_at`, all timestamps `timestamptz`
2. TEN-02: The system SHALL store `users` with `id` (uuid, default `uuidv7()`), `tenant_id` FK to `tenants`, `email`, `password_hash`, `role` (`user_role` enum: `admin`, `operator`) and the same timestamps
3. TEN-03: The system SHALL enforce unique `email` among users where `deleted_at IS NULL`, and unique `(tenant_id, id)`
4. TEN-04: The system SHALL take `tenantId` only from the authenticated token, never from body, query or URL
5. TEN-05: The system SHALL filter every user query in the auth repository by tenant where a tenant is known (`/auth/me`), and exclude soft-deleted rows

---

### P1: Infrastructure ⭐ MVP

**Acceptance Criteria**:

1. INF-01: The system SHALL run Postgres 18 (`postgres:18-alpine`) with the volume mounted at `/var/lib/postgresql`
2. INF-02: IF `JWT_SECRET` is shorter than 32 characters, `CORS_ORIGIN` is not a URL or `NODE_ENV` is not `development|test|production` THEN the system SHALL refuse to start
3. INF-03: The system SHALL answer CORS requests from `CORS_ORIGIN` with credentials allowed
4. INF-04: The system SHALL run tests against a separate `stocksync_test` database, created if missing and migrated before the suite, with all tables truncated between tests

---

### P1: Seed ⭐ MVP

**Acceptance Criteria**:

1. SEED-01: WHEN `pnpm --filter stocksync-api db:seed` runs THEN the system SHALL create tenants `Acme` and `Globex`, each with one `admin` and one `operator` user with lowercase emails and bcrypt (cost 10) password hashes
2. SEED-02: WHEN the seed runs a second time THEN the system SHALL finish without errors and without duplicating rows

---

## Edge Cases

- IF the login email has uppercase letters THEN the system SHALL match the stored lowercase email
- IF the token is signed with a different secret THEN `requireAuth` SHALL respond 401
- IF logout is called with an expired token THEN the system SHALL still respond 204

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUTH-01 | P1: Login | Execute | Verified |
| AUTH-02 | P1: Login | Execute | Verified |
| AUTH-03 | P1: Login | Execute | Verified |
| AUTH-04 | P1: Login | Execute | Verified |
| AUTH-05 | P1: Login | Execute | Verified |
| AUTH-06 | P1: Login | Execute | Verified |
| AUTH-07 | P1: Login | Execute | Verified |
| AUTH-08 | P1: Login | Execute | Verified |
| AUTH-09 | P1: Login | Execute | Verified |
| AUTH-10 | P1: Current user and logout | Execute | Verified |
| AUTH-11 | P1: Current user and logout | Execute | Verified |
| AUTH-12 | P1: Current user and logout | Execute | Verified |
| AUTH-13 | P1: Authorization middlewares | Execute | Verified |
| AUTH-14 | P1: Authorization middlewares | Execute | Verified |
| AUTH-15 | P1: Authorization middlewares | Execute | Verified |
| AUTH-16 | P1: Authorization middlewares | Execute | Verified |
| AUTH-17 | P1: Authorization middlewares | Execute | Verified |
| AUTH-18 | P1: Authorization middlewares | Execute | Verified |
| TEN-01 | P1: Tenancy data model | Execute | Verified |
| TEN-02 | P1: Tenancy data model | Execute | Verified |
| TEN-03 | P1: Tenancy data model | Execute | Verified |
| TEN-04 | P1: Tenancy data model | Execute | Verified |
| TEN-05 | P1: Tenancy data model | Execute | Verified |
| INF-01 | P1: Infrastructure | Execute | Verified |
| INF-02 | P1: Infrastructure | Execute | Verified |
| INF-03 | P1: Infrastructure | Execute | Verified |
| INF-04 | P1: Infrastructure | Execute | Verified |
| SEED-01 | P1: Seed | Execute | Verified |
| SEED-02 | P1: Seed | Execute | Verified |

**Coverage:** 29 total, 29 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm --filter stocksync-api typecheck`, tests (with `db:up`) and `pnpm lint:check` pass
- [ ] `db:seed` runs twice without errors or duplicates
