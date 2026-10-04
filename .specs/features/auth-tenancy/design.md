# Authentication and Multi-tenancy Design

**Spec**: `.specs/features/auth-tenancy/spec.md`

## Components

| File | Responsibility |
| ---- | -------------- |
| `src/infra/compose.yaml` | `postgres:18-alpine`, volume at `/var/lib/postgresql` |
| `src/infra/env.ts` | Adds `JWT_SECRET` (min 32), `CORS_ORIGIN` (url), `NODE_ENV` (enum, default `development`) |
| `src/infra/schemas/columns.ts` | Shared `createdAt` / `updatedAt` / `deletedAt` timestamptz columns |
| `src/infra/schemas/tenants.ts`, `users.ts` | Drizzle tables, `user_role` pgEnum, partial unique email, unique `(tenant_id, id)` |
| `src/infra/password.ts` | `hashPassword` / `verifyPassword` with bcryptjs cost 10; shared by auth service and seed |
| `src/infra/jwt.ts` | `signAccessToken` / `verifyAccessToken` with jose HS256, 1h; `ACCESS_TOKEN_TTL_SECONDS` |
| `src/infra/seed/seed.ts` | `seed(executor)`: idempotent Acme/Globex with admin + operator; exports the seed users for tests |
| `src/infra/seed/run.ts` | CLI entry for `db:seed`; runs `seed(db)` and closes the pool |
| `src/infra/test/global-setup.ts` | Creates `stocksync_test` if absent in `pg_database`, runs Drizzle migrations |
| `src/infra/test/setup.ts` | Truncates every public table before each test; closes the pool after the file |
| `src/http/express.d.ts` | `Express.Request.auth: AuthContext` declaration merging |
| `src/http/require-auth.ts` | Reads `access_token` cookie, verifies the JWT, sets `req.auth` |
| `src/http/require-role.ts` | `requireRole(...roles)` throws `ForbiddenError` |
| `src/modules/auth/auth.validation.ts` | `loginSchema` |
| `src/modules/auth/auth.repository.ts` | `findActiveUserByEmail(email, executor = db)`, `findActiveUserById(tenantId, userId, executor = db)`; both join tenants and exclude soft-deleted users and tenants |
| `src/modules/auth/auth.service.ts` | `login`, `getCurrentUser`; dummy-hash compare on unknown email |
| `src/modules/auth/auth.routes.ts` | `POST /login`, `POST /logout`, `GET /me`; cookie options |
| `src/app.ts` | cors → cookie-parser → json → routes → errorHandler |

## Flows

- **Login:** route validates → service lowercases email → repository finds active user + tenant → `verifyPassword` (dummy hash when not found) → `signAccessToken` → route sets the cookie and returns the current-user body.
- **Me:** `requireAuth` → service loads the user by `(tenantId, userId)` from `req.auth` → 401 if not found.
- **Logout:** `res.clearCookie("access_token", options without maxAge)` → 204.

## Decisions

- `req.auth` is typed non-optional through declaration merging. It is only read on routes behind `requireAuth`, and an optional type would force a redundant check in every handler.
- `requireAuth` maps every jose verification failure to `UnauthorizedError`. Algorithms are restricted to `["HS256"]`.
- The repository returns the current-user shape directly: a joined select of user and tenant columns.
- The test env is set in `vitest.config.ts`: `DATABASE_URL` is the dev URL from `.env` with the database name swapped to `stocksync_test`, plus fixed `PORT`, `JWT_SECRET`, `CORS_ORIGIN` and `NODE_ENV=test`. `fileParallelism: false`.
- Test files under `src/infra/test/` are excluded from the build.
- The dummy hash is a fixed bcrypt cost-10 hash literal, so login with an unknown email costs one compare, like a real user.
