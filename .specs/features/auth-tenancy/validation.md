# Auth-Tenancy Validation

## Validation: auth-tenancy - PASS

**Date**: 2026-10-04
**Spec**: `.specs/features/auth-tenancy/spec.md`
**Diff range**: uncommitted working tree vs HEAD 3f93833 (modified: `apps/backend/package.json`, `src/app.ts`, `src/infra/compose.yaml`, `src/infra/env.ts`, `tsconfig.build.json`, `vitest.config.ts`, `pnpm-lock.yaml`; untracked: `src/app.test.ts`, `src/http/{express.d.ts,require-auth.ts,require-auth.test.ts,require-role.ts}`, `src/infra/{jwt.ts,password.ts}`, `src/infra/schemas/`, `src/infra/migrations/`, `src/infra/seed/`, `src/infra/test/`, `src/modules/auth/`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: re-verification after fix iteration 1. Iteration 0 failed on TEN-05 (surviving mutant M3b) and on the surviving mutant M19.

Fix iteration 1 changed tests only (`auth.test.ts`, `require-auth.test.ts`), plus `design.md` and an unrelated `db:studio` script in `apps/backend/package.json` that the user asked for. The mutation script's exact-match anchors all still matched, so the production lines under test are unchanged since iteration 0.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Postgres 18 | ✅ Done | `apps/backend/src/infra/compose.yaml:5` `postgres:18-alpine`, `:13` volume at `/var/lib/postgresql` |
| T2 Env + deps | ✅ Done | `apps/backend/src/infra/env.ts:6-10`; deps in `apps/backend/package.json` |
| T3 Schemas + migration | ✅ Done | `apps/backend/src/infra/migrations/0000_aromatic_clint_barton.sql` |
| T4 Test DB harness | ✅ Done | `apps/backend/vitest.config.ts:8-18`, `src/infra/test/` |
| T5 Password + seed | ✅ Done | `apps/backend/src/infra/seed/seed.ts`, `seed.test.ts` |
| T6 JWT + middlewares | ✅ Done | `apps/backend/src/infra/jwt.ts`, `src/http/require-auth.ts`, `src/http/require-role.ts` |
| T7 Auth module | ✅ Done | Fix 1 added the `/auth/me` deleted-tenant test |
| T8 CORS | ✅ Done | `apps/backend/src/app.ts:12`, `src/app.test.ts` |

| Fix (iteration 0) | Status | Evidence |
| ----------------- | ------ | -------- |
| Fix 1: `/auth/me` with a soft-deleted tenant | ✅ Done | `apps/backend/src/modules/auth/auth.test.ts:282-295`; M3b now killed |
| Fix 2: validly signed token with an unknown role | ✅ Done | `apps/backend/src/http/require-auth.test.ts:120-132`; M19 now killed |

---

## Spec-Anchored Acceptance Criteria

Test paths below are relative to `apps/backend/src/`.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AUTH-01 valid login | 200 `{ id, email, role, tenant: { id, name } }` | `modules/auth/auth.test.ts:87` - `expect(response.status).toBe(200)`; `:88` - `toEqual({ id: user.id, email: "admin@acme.test", role: "admin", tenant: { id: tenant.id, name: "Acme" } })` | ✅ PASS |
| AUTH-02 cookie flags, no token in body | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=3600`, token not in body | `modules/auth/auth.test.ts:100` `toContain("HttpOnly")`, `:101` `"SameSite=Lax"`, `:102` `"Path=/"`, `:103` `"Max-Age=3600"`, `:105` `expect(response.text).not.toContain(accessTokenFrom(response))` | ✅ PASS |
| AUTH-03 Secure in production | `Secure` flag when `NODE_ENV=production` | `modules/auth/auth.test.ts:120` - `expect(setCookieHeader(response)).toContain("Secure")`; negative at `:104` - `not.toContain("Secure")` in the test env | ✅ PASS |
| AUTH-04 wrong password | 401 `UNAUTHORIZED` "Invalid email or password" | `modules/auth/auth.test.ts:137` `toBe(401)`; `:138` `toEqual({ error: { code: "UNAUTHORIZED", message: "Invalid email or password" } })`; `:139` no cookie set | ✅ PASS |
| AUTH-05 unknown email + dummy compare | same 401 body, `bcrypt.compare` run against a fixed hash | `modules/auth/auth.test.ts:150-151` same status/body; `:152` `expect(compare).toHaveBeenCalledTimes(1)`; `:153` password arg; `:154` hash arg `toMatch(/^\$2[aby]\$10\$/)` | ✅ PASS |
| AUTH-06 soft-deleted user / tenant at login | 401 same body | user: `modules/auth/auth.test.ts:165-166`; tenant: `:177-178` - `toBe(401)` + `toEqual(invalidCredentialsBody)` | ✅ PASS |
| AUTH-07 invalid body | 400 `VALIDATION_ERROR` | invalid email: `modules/auth/auth.test.ts:187-189` (`toBe(400)`, code, message `^email: `); empty password: `:195-197` (message `^password: `) | ✅ PASS |
| AUTH-08 lowercase email at login | uppercase input matches stored lowercase email | `modules/auth/auth.test.ts:130-131` - `toBe(200)`, `body.email` `toBe("admin@acme.test")` for input `ADMIN@Acme.Test` | ✅ PASS |
| AUTH-09 HS256, `JWT_SECRET`, 1h, claims | `alg=HS256`, `sub`/`tenantId`/`role`, `exp-iat=3600` | `http/require-auth.test.ts:57` `alg` `toBe("HS256")`; `:58-60` claims; `:61` `toBe(3600)`. The secret is proven by the wrong-secret rejection at `:105-106` | ✅ PASS |
| AUTH-10 `GET /auth/me` | 200, same body as login, own tenant | `modules/auth/auth.test.ts:209-210` `toEqual(loginResponse.body)`; `:221-224` Globex operator gets `tenant` `toEqual({ id: globex.id, name: "Globex" })` | ✅ PASS |
| AUTH-11 user deleted after token issued | 401 `UNAUTHORIZED` | `modules/auth/auth.test.ts:278-279` - `toBe(401)`, `toEqual(unauthorizedBody)` | ✅ PASS |
| AUTH-12 logout | 204, cookie cleared with same options, with or without a valid cookie | `modules/auth/auth.test.ts:322-323` `toBe(204)` + exact `toBe("access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax")`; with a real expired JWT `:333-334`; session actually ends `:345` | ✅ PASS |
| AUTH-13 missing cookie | 401 | `http/require-auth.test.ts:81-82`; `modules/auth/auth.test.ts:242-243` | ✅ PASS |
| AUTH-14 bad signature / malformed / non-HS256 | 401 | malformed `http/require-auth.test.ts:90-91`; other secret `:105-106`; HS512 `:116-117`; unknown `role` claim `:130-131`; `modules/auth/auth.test.ts:251-252` | ✅ PASS |
| AUTH-15 expired | 401 | `http/require-auth.test.ts:147-148`; `modules/auth/auth.test.ts:263-264` | ✅ PASS |
| AUTH-16 `req.auth` from claims, no DB | `{ userId, tenantId, role }` equal to claims | `http/require-auth.test.ts:74-75` - `toEqual(input)` with random UUIDs that exist in no table, so a DB lookup could not succeed | ✅ PASS |
| AUTH-17 role not allowed | 403 `FORBIDDEN` | `http/require-auth.test.ts:160-161` - `toBe(403)` + exact body | ✅ PASS |
| AUTH-18 role allowed | handler runs | `http/require-auth.test.ts:176-177` - `toBe(200)`, `toEqual({ ok: true })` | ✅ PASS |
| TEN-01 `tenants` table | uuid `uuidv7()`, name, timestamptz timestamps, nullable `deleted_at` | **Inspection** (allowed): `infra/migrations/0000_aromatic_clint_barton.sql:2-8`; `infra/schemas/tenants.ts:5-9`; `infra/schemas/columns.ts:3-10` | ✅ PASS (inspection) |
| TEN-02 `users` table | uuid `uuidv7()`, FK `tenant_id`, email, password_hash, `user_role` enum, timestamps | **Inspection**: `infra/migrations/0000_aromatic_clint_barton.sql:1`, `:10-20`, `:22`; `infra/schemas/users.ts:13-28` | ✅ PASS (inspection) |
| TEN-03 partial unique email, unique `(tenant_id, id)` | `WHERE deleted_at IS NULL`; `UNIQUE(tenant_id, id)` | **Inspection**: `infra/migrations/0000_aromatic_clint_barton.sql:23`, `:19`; `infra/schemas/users.ts:30-34` | ✅ PASS (inspection) |
| TEN-04 tenantId only from token | query/body/URL tenantId ignored | `modules/auth/auth.test.ts:235-236` - `?tenantId=<globex>` still returns `tenant.name` `toBe("Acme")`. Code: `modules/auth/auth.service.ts:44` reads only `auth.tenantId` | ✅ PASS |
| TEN-05 auth repository filters by tenant (for `/me`) and excludes soft-deleted rows | `/me` query scoped by `tenantId`; soft-deleted users and tenants excluded | tenant scope: `modules/auth/auth.test.ts:310-311` (Acme user + Globex tenantId → 401); deleted user: `:278-279`; deleted tenant: `:293-294` - `toBe(401)`, `toEqual(unauthorizedBody)` | ✅ PASS |
| INF-01 Postgres 18 | `postgres:18-alpine`, volume `/var/lib/postgresql` | **Inspection**: `infra/compose.yaml:5`, `:13`; container is up and the `uuidv7()` defaults migrate cleanly | ✅ PASS (inspection) |
| INF-02 env refuses bad config | `JWT_SECRET` ≥ 32, `CORS_ORIGIN` URL, `NODE_ENV` enum | **Inspection** (accepted by the coordinator): `infra/env.ts:6-10` (`z.string().min(32)`, `z.url()`, `z.enum([...]).default("development")`) | ✅ PASS (inspection) |
| INF-03 CORS with credentials | allow-origin = `CORS_ORIGIN`, allow-credentials `true` | `app.test.ts:13-17` - `toBe(204)`, `toBe("http://localhost:5173")`, `toBe("true")` | ✅ PASS |
| INF-04 separate test DB, created, migrated, truncated | `stocksync_test`, `pg_database` check, migrations, truncate between tests | **Inspection + sensor**: `infra/test/database-url.ts:13-20`; `infra/test/global-setup.ts:20-25` (`pg_database` check + `CREATE DATABASE`), `:37` migrate; `infra/test/setup.ts:4-12` truncate; `vitest.config.ts:8-17`. Truncation removal (M20) was killed in iteration 0 | ✅ PASS |
| SEED-01 Acme/Globex, admin+operator, lowercase, bcrypt cost 10 | 2 tenants × (admin, operator), lowercase emails, `$2?$10$` hashes | `infra/seed/seed.test.ts:28-35` exact `toEqual` of tenant/email/role rows; `:46` `toMatch(/^\$2[aby]\$10\$/)`; `:47-49` `verifyPassword(...)` `toBe(true)` | ✅ PASS |
| SEED-02 idempotent | second run: no error, no duplicates | `infra/seed/seed.test.ts:54-61` - two runs, `tenantCount` `toBe(2)`, `userCount` `toBe(4)` | ✅ PASS |

**Status**: ✅ All 29 ACs covered. No spec-precision gaps. The spec's assumption "`/auth/me` with a soft-deleted tenant → 401" is now tested, but its `Confirmed?` column still says `n`. The user still needs to confirm it; that is not a test gap.

### Edge cases

- [x] Uppercase login email matches stored lowercase email: `modules/auth/auth.test.ts:127-132`
- [x] Token signed with a different secret → 401: `http/require-auth.test.ts:94-107`
- [x] Logout with an expired token → 204: `modules/auth/auth.test.ts:326-335`, now with a real expired JWT (`expiredTokenFor`, `:61-69`)

---

## Discrimination Sensor

The re-run used a fresh temporary `git worktree` (detached at HEAD 3f93833, with the current uncommitted and untracked files copied in, `node_modules` symlinked and `.env` copied). Mutants ran one at a time against the shared `stocksync_test` database.

During the first pass, M5, M7 and M8 also failed many unrelated tests (for example, seed tests failed under M7). The most likely cause is another suite running at the same time against the shared database. Those three mutants were re-run with an unmutated baseline before and after them (55/55 both times). Each then failed only its target test, and the table records the clean runs.

Afterwards the worktree was removed (`git worktree remove --force` + `git worktree prune`). The real tree's `git status --porcelain` matched the pre-sensor baseline except for root `package.json` and `turbo.json`, modified at 00:24:50 during the run. Those edits add a `test:watch` script and turbo cache settings. They are outside the sensor's write path, which only writes under the scratch worktree, and none of the mutants target those files. They are someone else's concurrent edits, so isolation holds.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M3b | `apps/backend/src/modules/auth/auth.repository.ts:39` | Drop the tenant `deleted_at` filter only in the `/me` query | ✅ Killed (`auth.test.ts:293`), was a survivor |
| M19 | `apps/backend/src/infra/jwt.ts:14` | Claims schema accepts any `role` | ✅ Killed (`require-auth.test.ts:130`), was a survivor |
| M1 | `apps/backend/src/modules/auth/auth.service.ts:24` | Skip the dummy `verifyPassword` for unknown emails | ✅ Killed (`auth.test.ts:152`) |
| M2 | `apps/backend/src/modules/auth/auth.repository.ts:39` | Drop `eq(users.tenantId, tenantId)` in `findActiveUserById` | ✅ Killed (`auth.test.ts:310`) |
| M3 | `apps/backend/src/modules/auth/auth.repository.ts:13` | Drop `isNull(tenants.deletedAt)` from the shared `isActive` | ✅ Killed (login and `/me` deleted-tenant tests) |
| M4 | `apps/backend/src/infra/jwt.ts:40` | Remove `algorithms: ["HS256"]` | ✅ Killed (`require-auth.test.ts:116`) |
| M5 | `apps/backend/src/modules/auth/auth.routes.ts:11` | `secure: false` always | ✅ Killed (`auth.test.ts:120`) |
| M7 | `apps/backend/src/http/require-role.ts:7` | `requireRole` always passes | ✅ Killed (`require-auth.test.ts:160`) |
| M8 | `apps/backend/src/infra/seed/seed.ts:51` | Seed tenant without the existence check | ✅ Killed (`seed.test.ts:60`) |
| M10 | `apps/backend/src/modules/auth/auth.routes.ts:32` | `clearCookie` with `sameSite: "strict"` | ✅ Killed (`auth.test.ts:323`, `:334`) |
| M12 | `apps/backend/src/http/require-auth.ts:14` | Swallow verification errors and set a fake `req.auth` | ✅ Killed (7 tests) |
| M16 | `apps/backend/src/modules/auth/auth.repository.ts:13` | Drop `isNull(users.deletedAt)` | ✅ Killed (`auth.test.ts:165`, `:278`) |

Not re-run, unchanged from iteration 0 because their tests and production lines were not touched: M6, M8b, M9, M10b, M11, M13, M14, M15, M20 killed. M9b is an equivalent mutant (seed literals are already lowercase). M17 and M18 cover INF-02, which is verified by inspection.

**Sensor depth**: P0-full (auth path): 12 mutants re-run in this iteration (24 total across iterations)
**Result**: 12/12 killed; both iteration-0 survivors are now killed

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Small modules, no speculative abstractions; `expiredTokenFor` removes a duplicate token builder |
| Surgical changes | ✅ Fix iteration touched only the two test files and `design.md`; `db:studio` is a user-requested one-liner |
| No scope creep | ✅ No products, refresh tokens, rate limiting, RLS or 415 guard |
| Matches patterns | ✅ `modules/auth/*.{routes,service,repository,validation,test}.ts` layout per CLAUDE.md |
| Spec-anchored outcome check | ✅ Status codes, error codes, messages and cookie attributes asserted exactly |
| Per-layer coverage expectation | ✅ Every route covers happy + edge + error paths; middlewares cover every AC |
| Every test maps to a spec requirement | ✅ Extra tests (cross-tenant token, agent session, unknown role) back TEN-05, AUTH-12 and AUTH-14 |
| Documented guidelines followed: `CLAUDE.md` | ✅ Explicit plural table names; `timestamptz`; soft delete with partial unique index; `/me` query filtered by `tenantId`, and the unscoped login query explains why (`auth.repository.ts:15-16`); the seed checks before inserting; comments only explain the *why* |

Notes (not blocking):

- N1: INF-02 has no automated test. It was verified by inspection as agreed.
- N2: AUTH-12's `Secure` attribute on logout in production is not asserted. Login and logout share one `cookieOptions` object (`auth.routes.ts:9-14`, `:32`), so the risk is low.

---

## Gate Check

- **Gate command**: `pnpm --filter stocksync-api typecheck && pnpm --filter stocksync-api test && pnpm lint:check`
- **Result**: typecheck exit 0; 55 passed, 0 failed, 0 skipped (7 files); biome "Checked 40 files, No fixes applied"
- **Test count before feature**: 18
- **Test count after feature**: 55
- **Delta**: +37 new tests (`auth.test.ts` 23, `require-auth.test.ts` 10, `seed.test.ts` 3, `app.test.ts` 1)
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

None. Both fixes from iteration 0 are done and verified.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| AUTH-01 … AUTH-18 | Implementing | ✅ Verified |
| TEN-01, TEN-02, TEN-03 | Implementing | ✅ Verified (inspection) |
| TEN-04, TEN-05 | Implementing | ✅ Verified |
| INF-01, INF-02 | Implementing | ✅ Verified (inspection) |
| INF-03, INF-04 | Implementing | ✅ Verified |
| SEED-01, SEED-02 | Implementing | ✅ Verified |

(The Verifier does not edit `spec.md`. The orchestrator applies these statuses.)

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 29/29 ACs matched the spec outcome; 0 spec-precision gaps; 1 spec assumption still awaiting the user's confirmation (`/me` + deleted tenant → 401, now tested)
**Sensor**: 12/12 killed in this iteration; no real survivors remain
**Gate**: 55 passed, typecheck and lint clean

**What works**: login/me/logout with the exact cookie attributes, dummy-hash timing guard, HS256-only verification with claim validation, role middleware, tenant-scoped `/me`, soft-delete exclusion for users and tenants, idempotent seed, isolated truncated test database, CORS with credentials.

**Next steps**: confirm the `/me` deleted-tenant assumption in `spec.md`, apply the traceability statuses, then commit with the `commit` skill after the user's review.
