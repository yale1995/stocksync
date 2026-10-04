# State

## Decisions

- AD-001: Errors use one `AppError` base with six subclasses and the response shape `{ error: { code, message } }` (feature `errors`).
- AD-002: Tenancy is a shared database with `tenant_id` on every tenant-owned table, filtered in repositories and backed by composite FKs `(tenant_id, id)`. No RLS (feature `auth-tenancy`).
- AD-003: Auth uses a jose HS256 1h JWT in an `httpOnly` `access_token` cookie, with no refresh token. `requireAuth` does not hit the database (feature `auth-tenancy`).
- AD-004: Tests run against a real `stocksync_test` database in the dev container, truncated between tests, with no file parallelism (feature `auth-tenancy`).

## Handoff

Feature `auth-tenancy` in Execute on branch `feat/auth-multitenancy`.
