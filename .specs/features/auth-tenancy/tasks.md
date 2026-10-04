# Authentication and Multi-tenancy Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: `.specs/features/auth-tenancy/design.md`
**Status**: Done 

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `CLAUDE.md` (module layout with `*.test.ts`, real Postgres for tests per the prompt), `apps/backend/vitest.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Routes (auth) | integration (supertest + real DB) | All routes: happy + every listed edge case + error paths | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| HTTP middlewares | integration (supertest) | Every AC of `requireAuth` / `requireRole` | `src/http/*.test.ts` | `pnpm --filter stocksync-api test` |
| Service / repository | covered through route tests | Every branch reached by a route test | `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| Seed | integration (real DB) | Idempotency + created rows | `src/infra/seed/*.test.ts` | `pnpm --filter stocksync-api test` |
| Schema / config / compose | none | build gate only | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api test` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion or config/entity-only tasks | `pnpm --filter stocksync-api typecheck && pnpm --filter stocksync-api test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Foundation

```
T1 → T2 → T3 → T4
```

### Phase 2: Auth

```
T5 → T6 → T7 → T8
```

---

## Task Breakdown

### T1: Upgrade Postgres to 18

**What**: Switch to `postgres:18-alpine`, mount the volume at `/var/lib/postgresql` and recreate the volume.
**Where**: `apps/backend/src/infra/compose.yaml`
**Depends on**: None
**Requirement**: INF-01

**Done when**:

- [x] Compose uses `postgres:18-alpine` with the new mount
- [x] Container is recreated with `down -v` + `db:up` and is healthy

**Tests**: none
**Gate**: build

---

### T2: Add auth env vars and dependencies

**What**: Add `JWT_SECRET`, `CORS_ORIGIN` and `NODE_ENV` to the env schema, install `jose`, `bcryptjs`, `cookie-parser`, `cors` plus types, and add the new vars to the local `.env`.
**Where**: `apps/backend/src/infra/env.ts`
**Depends on**: T1
**Requirement**: INF-02

**Done when**:

- [x] Env schema validates the three vars as specified
- [x] Dependencies installed

**Tests**: none
**Gate**: build

---

### T3: Tenants and users schemas with migration

**What**: Drizzle `tenants` and `users` tables, the `user_role` enum, the partial unique email and unique `(tenant_id, id)`, plus the generated migration.
**Where**: `apps/backend/src/infra/schemas/`
**Depends on**: T2
**Requirement**: TEN-01, TEN-02, TEN-03

**Done when**:

- [x] Migration generated with `db:generate` and applied cleanly

**Tests**: none
**Gate**: build

---

### T4: Test database harness

**What**: Vitest test env, `globalSetup` creating and migrating `stocksync_test`, and truncation between tests.
**Where**: `apps/backend/vitest.config.ts`
**Depends on**: T3
**Requirement**: INF-04

**Done when**:

- [x] Existing suite runs against `stocksync_test`, file parallelism off

**Tests**: integration
**Gate**: full

---

### T5: Password helper and idempotent seed

**What**: `hashPassword` / `verifyPassword`, `seed(executor)` with Acme/Globex users, the `db:seed` script and a seed test.
**Where**: `apps/backend/src/infra/seed/seed.ts`
**Depends on**: None (runs after Phase 1)
**Requirement**: SEED-01, SEED-02

**Done when**:

- [x] Seed test: runs twice, 2 tenants and 4 users, lowercase emails, valid hashes

**Tests**: integration
**Gate**: full

---

### T6: JWT helper and auth middlewares

**What**: `signAccessToken` / `verifyAccessToken`, `requireAuth`, `requireRole` and the `req.auth` type, with middleware tests on a throwaway route.
**Where**: `apps/backend/src/http/require-auth.ts`
**Depends on**: T5
**Requirement**: AUTH-09, AUTH-13, AUTH-14, AUTH-15, AUTH-16, AUTH-17, AUTH-18

**Done when**:

- [x] Tests: missing / invalid / wrong-secret / expired token → 401, operator → 403, admin → 200 with `req.auth`

**Tests**: integration
**Gate**: full

---

### T7: Auth module

**What**: `auth.validation.ts`, `auth.repository.ts`, `auth.service.ts` and `auth.routes.ts` mounted at `/auth` with cookie-parser, plus `auth.test.ts`.
**Where**: `apps/backend/src/modules/auth/`
**Depends on**: T6
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-10, AUTH-11, AUTH-12, TEN-04, TEN-05

**Done when**:

- [x] Route tests cover every listed AC and edge case

**Tests**: integration
**Gate**: full

---

### T8: CORS setup

**What**: `cors({ origin: env.CORS_ORIGIN, credentials: true })` in `createApp()` with a preflight test.
**Where**: `apps/backend/src/app.ts`
**Depends on**: T7
**Requirement**: INF-03

**Done when**:

- [x] Preflight from `CORS_ORIGIN` returns the allow-origin and allow-credentials headers

**Tests**: integration
**Gate**: build
