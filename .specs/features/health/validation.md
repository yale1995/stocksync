# Health Validation

## Validation: health - PASS ✅ (iteration 1)

**Date**: 2026-10-06
**Spec**: `.specs/features/health/spec.md` (HLT-01..HLT-13 + 2 edge cases); source of truth `docs/prompts/06-health.md` ("Decisions", "Tests" 1-7); rules `CLAUDE.md`
**Diff range**: uncommitted working tree on `feat/health` vs `main` da84070 (`health.controller.ts`, `health.validation.ts`, `openapi.ts`, `openapi-description.ts`, `health.test.ts`, `openapi.test.ts`, `response-schemas.test.ts`, `app.test.ts` modified; `health.repository.ts`, `health.service.ts`, `health-unavailable.test.ts` new)
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 1 of max 3 (iteration 0 failed on G1, G2, G3; all closed by test-only changes in `T` and `U`)

## Iteration 1 (re-verification)

**Date**: 2026-10-06. **Verdict**: PASS ✅. Production code is unchanged since iteration 0: every mutant replacement of iteration 0 applied verbatim again (no "not applied"), and SHA-1 now `R` `b947f0d4`, `SV` `e7204b1f`, `C` `fffec833`, `openapi.ts` `b00d8fa3`. Only `T` (`4fc22ef7`) and `U` (`42c14825`) changed.

- **G1 closed (HLT-11)**: `U:57-76` `requestWithFakeTimers()` waits for the health timer with real `setImmediate` polling, advances a literal 999 ms and asserts `expect(settled).toBe(false)` (`U:72-73`), then 1 ms more and returns the 503 (`U:74`). Used with `ping` hanging (`U:119-125`) and with `ping` resolved and `summarizeSyncQueue` hanging (`U:127-136`). The import of `HEALTH_CHECK_TIMEOUT_MS` is gone.
- **G2 closed (HLT-04)**: `T:93` `expect(database.version).toBe(version.rows[0]?.server_version)` from `SHOW server_version` in the test; `T:95-97` `maxConnections` `toBe(Number(SHOW max_connections))`; `T:101-103` `openConnections` `toBeLessThan` the unfiltered `pg_stat_activity` count; `U:79-90` stubs `performance.now` (100 → 103.4) and asserts `expect(response.body.database.latencyMs).toBe(3)`.
- **G3 closed (HLT-12)**: `U:101-104` `toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: SECRET }))`.

Updated evidence for the ACs that were gaps:

| Criterion | `file:line` + assertion | Result |
| --------- | ----------------------- | ------ |
| HLT-04 | `T:92` `toBe("up")`; `T:93` `toBe(server_version)`; `T:95-97` `toBe(Number(max_connections))`; `T:100-106` `1 <= openConnections < unfiltered count`, `<= maxConnections`; `U:89` `latencyMs` `toBe(3)` from 100 → 103.4 | ✅ PASS |
| HLT-11 | `U:72-74` still pending at 999 ms, 503 at 1000 ms; first query (`U:119`) and a later query (`U:127`) | ✅ PASS |
| HLT-12 | `U:100` body without `SECRET`; `U:101-104` `console.error` called with the error carrying `SECRET` | ✅ PASS |

All 13 ACs and both edge cases now match the spec outcome; the iteration 0 rows below for the other ACs still hold (their `U` line numbers moved: `expectUnavailable` is `U:41-55`, rejection tests `U:94-117`).

Sensor re-run (fresh temporary `git worktree` at HEAD with the working-tree diff applied, `node_modules` symlinked, `stocksync_test`, one vitest at a time over `src/modules/health src/http/openapi.test.ts src/app.test.ts`; unmutated scratch green 3/3 runs, 129/129 each; worktree removed afterwards; real tree `git status --porcelain` identical to the pre-sensor baseline):

| # | File:line | Mutant | Iteration 0 | Iteration 1 |
| - | --------- | ------ | ----------- | ----------- |
| M1-M7 | `R:30-43` | sync `FILTER`/`min`/`max`/tenant mutants | killed | killed (`T:105`) |
| M8 | `R:14` | `pg_stat_activity` without `current_database()` | survived | **killed** (`T:101`) |
| M9 | `R:18` | `version` hard-coded | survived | **killed** (`T:93`) |
| M10 | `R:19` | `maxConnections: 100` | survived | ⚪ equivalent: the test server's `max_connections` is 100; `99` and `source - 1` both **killed** (`T:95`) |
| M11 | `SV:51` | `latencyMs` always 0 | survived | **killed** (`U:89`) |
| M12 | `SV:6` | timeout 5000 ms | survived | **killed** (`U:119`, `U:127`) |
| M13 | `SV:50,61` | timeout only around `ping` | survived | **killed** (`U:127`) |
| M14-M17 | `SV:26-72` | down-shape, leak, no log | killed | killed |
| M18 | `SV:67` | `console.error` without the cause | survived | **killed** (`U:101`) |
| M19 | `SV:20` | `environment: "test"` | equivalent | equivalent (`NODE_ENV=test`) |
| M20-M27 | `SV`, `C`, `openapi.ts` | server fields, 200 always, cache header, OpenAPI 503 | killed | killed |
| M28 | `SV:6` | timeout 999 ms (new) | - | killed (`U:73`) |
| M29 | `SV:6` | timeout 1001 ms (new) | - | killed (`U:119`, `U:127`) |
| M30 | `SV:51` | `Math.ceil` instead of `Math.round` (new) | - | killed (`U:89`) |
| M31 | `SV:51` | `latencyMs + 1` (new) | - | killed (`U:89`) |
| M32 | `SV:54` | `summarizeSyncQueue` rejection swallowed (new) | - | killed (`U:107`) |

**Sensor**: 30/30 non-equivalent mutants killed (M10, M19 equivalent in this environment).

**Gate**: `pnpm typecheck && pnpm test && pnpm lint:check && pnpm --filter stocksync-api build` exit 0: stocksync-api 20 files, 526 passed (514 on `main` → 526, +12; +2 since iteration 0); frontend 148; ads-mock 35; 0 failed, 0 skipped.

**Traceability**: HLT-01..HLT-13 Verified (the `Verified` status already in `spec.md` is now backed).

---

## Iteration 0 (history)

**Verdict at the time**: FAIL (G1-G3). Line numbers in this section refer to the iteration 0 files.

The endpoint behaves as specified and every AC has a test, and the sync queue numbers, the down shape, the status codes, the cache header and the OpenAPI document are all asserted on exact values (20/27 mutants killed). Two spec rules are not discriminated. The 1000 ms bound of HLT-11 is never pinned: the test advances timers by the exported constant, so a longer timeout passes, and only `ping` is made to hang, so a timeout that covers only `ping` and leaves the info/sync queries unbounded also passes (G1). The HLT-04 database fields are checked as ranges, not against their sources, so a hard-coded version, `max_connections`, `latencyMs` of 0 or an unfiltered `pg_stat_activity` count pass (G2). HLT-12 only checks that `console.error` was called, not that the cause is logged (G3).

`T` = `apps/backend/src/modules/health/health.test.ts`, `U` = `apps/backend/src/modules/health/health-unavailable.test.ts`, `R` = `apps/backend/src/modules/health/health.repository.ts`, `SV` = `apps/backend/src/modules/health/health.service.ts`, `C` = `apps/backend/src/http/controllers/health.controller.ts`, `OA` = `apps/backend/src/http/openapi.test.ts`, `RS` = `apps/backend/src/http/controllers/response-schemas.test.ts`, `A` = `apps/backend/src/app.test.ts`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Queries and service | ✅ Done | `R:5-50`, `SV:6-75`; cross-tenant comment at `R:24-25` |
| T2 Route, schema and OpenAPI | ✅ Done | `C:7-12`, `health.validation.ts:6-32` (`z.strictObject`, `.meta({ id: "Health" })`), `openapi.ts:204-207`, `openapi-description.ts:69-72` |
| T3 Tests | ⚠️ Done with gaps | Prompt tests 1-7 present (`T:58-139`, `U:59-93`); G1-G3 below |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| HLT-01 no cookie, DB up → 200 ok | 200, `status: "ok"` | `T:61` `expect(response.status).toBe(200)`; `T:62` `expect(response.body.status).toBe("ok")` (request without cookie, `T:19`); `A:69-70` | ✅ PASS |
| HLT-02 `Cache-Control: no-store` | header exactly `no-store` | `T:63` `expect(response.headers["cache-control"]).toBe("no-store")`; `U:45` same on 503 | ✅ PASS |
| HLT-03 `server` block | `{ status: "up", version: package.json, nodeVersion: process.version, environment: NODE_ENV, provider: "local" }` | `T:69-75` `toEqual({ status: "up", version: packageVersion, nodeVersion: process.version, environment: "test", provider: "local" })` | ✅ PASS (M19 `environment: "test"` hard-coded is equivalent under the fixed `NODE_ENV=test`) |
| HLT-04 `database` block when up | `status: "up"`, raw `server_version`, integer `max_connections`, `pg_stat_activity` count of current DB, integer `SELECT 1` round trip | `T:81` `toBe("up")`; `T:82-83` non-empty string; `T:84-85` positive integer; `T:86-89` `1 <= openConnections <= maxConnections`; `T:90-91` non-negative integer | ⚠️ Range checks only, as prompt test 3 asks; the sources named by the spec are not discriminated (G2: M8-M11 survive) |
| HLT-05 `sync` across every tenant | `{ pending, failed, oldestPendingAt, lastSuccessfulSyncAt }` over both tenants | `T:130-135` `toEqual({ pending: 2, failed: 2, oldestPendingAt: at(10).toISOString(), lastSuccessfulSyncAt: at(50).toISOString() })` with events in Acme and Globex (`T:111-125`) | ✅ PASS |
| HLT-06 pending includes backoff | backoff event counted | `T:113-118` Globex pending with `nextAttemptAt: future`; `T:131` `pending: 2` | ✅ PASS |
| HLT-07 nulls | `oldestPendingAt: null` without pending, `lastSuccessfulSyncAt: null` without sent | `T:97-102` `toEqual({ pending: 0, failed: 0, oldestPendingAt: null, lastSuccessfulSyncAt: null })` | ✅ PASS |
| HLT-08 no tenant id | body never contains a tenant id | `T:136-138` `expect(body).not.toContain(acme.tenantId)` / `globex.tenantId` | ✅ PASS |
| HLT-09 200 regardless of sync | no `degraded`, 200 with failed and old pending events | `T:129` `expect(response.status).toBe(200)` with 2 failed and a pending event from the past | ✅ PASS |
| HLT-10 rejected query → 503 down shape | 503, `unavailable`, down database, `sync: null`, server unchanged | `U:44-55` `toBe(503)`, `toBe("unavailable")`, `toEqual(down)`, `toBeNull()`, server `toEqual`; first query (`U:59-67`) and a later query (`U:69-79`) | ✅ PASS |
| HLT-11 queries not settled within 1000 ms → 503 | 503 down shape after 1000 ms, for any query of the check | `U:81-93` hangs `ping` only, advances by the imported `HEALTH_CHECK_TIMEOUT_MS`, `expectUnavailable` | ❌ GAP: neither the 1000 ms value (M12) nor the bound on the info/sync queries (M13) is discriminated (G1) |
| HLT-12 no error message in body, logged with `console.error` | body without the message; `console.error` with the cause | `U:65`, `U:78` `expect(JSON.stringify(response.body)).not.toContain(SECRET)`; `U:66` `expect(consoleError).toHaveBeenCalled()` | ⚠️ Body part PASS (M16 killed); the log assertion does not check the cause (G3: M18 survives) |
| HLT-13 OpenAPI 200 + 503 → `Health`, served from `/` | both statuses reference `#/components/schemas/Health`; `servers: [{ url: "/" }]` | `OA:55` `["get", "/health", ["200", "503"]]` with exact status list `OA:139-146`; `OA:175-176` `$ref` `Health` for 200 and 503; `OA:97` `toEqual([{ url: "/" }])`; strict schema `RS:114-141` | ✅ PASS |

**Status**: ❌ Gaps present (G1 HLT-11, G2 HLT-04, G3 HLT-12). No spec-precision gaps in the spec itself: HLT-04 and HLT-11 define exact outcomes; the prompt's test 3 asks for less than HLT-04 states.

---

## Edge Cases

- [x] Empty `sync_events` → `{ pending: 0, failed: 0, oldestPendingAt: null, lastSuccessfulSyncAt: null }`: `T:94-103` `toEqual`
- [x] `GET /api/v1/health` → 404 `NOT_FOUND`: `A:65-73` `expect(versioned.status).toBe(404)`, `expect(versioned.body.error.code).toBe("NOT_FOUND")`

---

## Discrimination Sensor

Temporary `git worktree` at HEAD under `/private/tmp/claude-501/hlt-sensor` with `git diff main -- apps/backend` applied and the untracked files copied, `node_modules` symlinked, `.env` copied, real `stocksync_test` database. One vitest process at a time over `src/modules/health src/http/openapi.test.ts src/app.test.ts` (205 tests, all green unmutated). Each mutant is a single `perl` replacement checked to differ from the original, restored from the real file after the run. Worktree removed afterwards; real tree `git status --porcelain` identical to the pre-sensor baseline.

| # | File:line | Mutant | Result |
| - | --------- | ------ | ------ |
| M1 | `R:30` | `pending` = `count(*)` without `FILTER` | ✅ Killed (`T:105`) |
| M2 | `R:30` | `superseded` counted as pending | ✅ Killed (`T:105`) |
| M3 | `R:41` | `max(created_at)` instead of `max(sent_at)` | ✅ Killed (`T:105`) |
| M4 | `R:38` | `min` → `max` for `oldestPendingAt` | ✅ Killed (`T:105`) |
| M5 | `R:38` | `min(created_at)` without `FILTER` | ✅ Killed (`T:105`) |
| M6 | `R:34` | `superseded` counted as failed | ✅ Killed (`T:105`) |
| M7 | `R:43` | sync query restricted to one tenant | ✅ Killed (`T:105`) |
| M8 | `R:14` | `pg_stat_activity` count without `datname = current_database()` | ❌ Survived (G2) |
| M9 | `R:18` | `database.version` hard-coded `"unknown"` | ❌ Survived (G2) |
| M10 | `R:19` | `maxConnections` hard-coded `100` | ❌ Survived (G2) |
| M11 | `SV:51` | `latencyMs` always `0` | ❌ Survived (G2) |
| M12 | `SV:6` | `HEALTH_CHECK_TIMEOUT_MS = 5000` | ❌ Survived (G1) |
| M13 | `SV:50,61` | timeout only around `ping`; info and sync queries unbounded | ❌ Survived (G1) |
| M14 | `SV:72` | `sync` zeros instead of `null` when down | ✅ Killed (`U:59,69,81`) |
| M15 | `SV:26` | down `database.version` `""` instead of `null` | ✅ Killed (`U:59,69,81`) |
| M16 | `SV:71` | `error.message` leaked into `database.version` | ✅ Killed (`U:59,69,81`) |
| M17 | `SV:67` | `console.error` removed | ✅ Killed (`U:66`) |
| M18 | `SV:67` | `console.error("Health check failed")` without the cause | ❌ Survived (G3) |
| M19 | `SV:20` | `environment: "test"` hard-coded | ⚪ Equivalent under `NODE_ENV=test` (vitest config); not counted |
| M20 | `SV:20` | `environment: "development"` hard-coded | ✅ Killed (`T:66`, `U`) |
| M21 | `SV:18` | `server.version: "1.0.0"` | ✅ Killed (`T:66`) |
| M22 | `SV:21` | `provider: "railway"` | ✅ Killed (schema parse in `T`, `U`) |
| M23 | `C:10` | always HTTP 200 | ✅ Killed (`U:44`) |
| M24 | `C:9` | `Cache-Control` not set | ✅ Killed (`T:63`, `U:45`) |
| M25 | `C:9` | `no-cache` instead of `no-store` | ✅ Killed (`T:63`, `U:45`) |
| M26 | `openapi.ts:206` | 503 response dropped | ✅ Killed (`OA:139`, `OA:176`) |
| M27 | `openapi.ts:206` | 503 references `ErrorResponse` | ✅ Killed (`OA:176`) |

**Sensor depth**: lightweight+ (27 mutants, every new branch and query clause)
**Outcome (iteration 0)**: 20/26 non-equivalent killed, 6 survived - FAIL ❌

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ (only the files named by the prompt) |
| No scope creep | ✅ (one route, no `/metrics`, no version bump) |
| Matches patterns | ✅ controller thin, service builds the response, repository holds the queries (`CLAUDE.md` Architecture) |
| Cross-tenant query justified | ✅ `R:24-25` comment, as the prompt requires |
| Comments only for non-obvious why | ✅ `R:24-25`, `SV:32`, `OA:148` |
| Spec-anchored outcome check | ❌ HLT-04, HLT-11, HLT-12 partially (G1-G3) |
| Per-layer Coverage Expectation met | ⚠️ route happy + error + timeout covered; timeout path only for the first query |
| Every test maps to a spec requirement | ✅ |
| Documented guidelines followed: `CLAUDE.md`, `docs/prompts/06-health.md` | ✅ |

---

## Gate Check

- **Gate command**: `pnpm typecheck && pnpm test && pnpm lint:check && pnpm --filter stocksync-api build`
- **Result**: exit 0. stocksync-api 20 files, 524 passed; frontend 11 files, 148 passed; ads-mock 1 file, 35 passed; 0 failed, 0 skipped
- **Test count before feature**: 514 (stocksync-api on `main` da84070, 19 files, measured in a temporary worktree)
- **Test count after feature**: 524 (20 files)
- **Delta**: +10 (health 1 → 5, health-unavailable +3, OpenAPI 503 `$ref` +1, response-schemas Health extra-key cases +3, `/health` dropped from the error-envelope `it.each` −1, existing `/health` statuses case updated). No assertion weakened except `A:70` (`toEqual({ status: "ok" })` → `status` only), which the prompt requires.

---

## Fix Plans

### Fix 1 (G1, Major): HLT-11 timeout not pinned to 1000 ms nor to every query

- **Root cause**: `U:81-93` advances by the imported constant and hangs only `ping`.
- **Fix task**: in `U`, (a) assert the bound itself: after `vi.advanceTimersByTimeAsync(999)` the request is still pending, then advance 1 ms and expect 503; or `expect(HEALTH_CHECK_TIMEOUT_MS).toBe(1000)` plus advancing by 1000 literally; (b) add a test with `ping` resolved and `summarizeSyncQueue` (or `findDatabaseInfo`) returning `new Promise(() => {})`, expecting 503 after 1000 ms.
- **Done when**: M12 and M13 are killed.

### Fix 2 (G2, Minor): HLT-04 fields not checked against their sources

- **Root cause**: `T:78-92` checks types and ranges only (prompt test 3).
- **Fix task**: in `T`, compare `database.version` to `(await db.execute(sql\`SHOW server_version\`)).rows[0].server_version` and `maxConnections` to `Number(SHOW max_connections)`; assert `openConnections` is below `SELECT count(*) FROM pg_stat_activity` (background processes have `datname IS NULL`, so the unfiltered count is always higher); in `U` (repository mocked), stub `performance.now` (e.g. 10 then 17.4) and expect `latencyMs: 7`.
- **Done when**: M8-M11 are killed.

### Fix 3 (G3, Minor): HLT-12 log does not need the cause

- **Fix task**: `U:66` → `expect(consoleError).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: SECRET }))`.
- **Done when**: M18 is killed.

---

## Requirement Traceability Update

`spec.md` already marks every requirement `Verified`; that is premature. Recommended:

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| HLT-01, 02, 03, 05, 06, 07, 08, 09, 10, 13 | Verified | ✅ Verified |
| HLT-04 | Verified | ❌ Needs Fix (G2) |
| HLT-11 | Verified | ❌ Needs Fix (G1) |
| HLT-12 | Verified | ❌ Needs Fix (G3) |

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 10/13 ACs matched the spec outcome; HLT-04, HLT-11, HLT-12 partially covered; 0 spec-precision gaps
**Sensor**: 20/26 non-equivalent mutants killed (M8-M13, M18 survived; M19 equivalent)
**Gate**: 524 + 148 + 35 passed, 0 failed

**What works**: the cross-tenant sync summary (every `FILTER`, `min`/`max` and tenant mutant killed), the 503 down shape and `sync: null`, no error message in the body, 200/503 decision, `Cache-Control: no-store`, OpenAPI 200/503 with the `Health` schema served from `/`, 404 under `/api/v1`.

**Issues found**: G1 timeout bound (HLT-11), G2 database field sources (HLT-04), G3 logged cause (HLT-12). All are test-only fixes; no production defect was found.

**Next steps**: implement Fix 1-3 in `U` and `T`, then re-verify (iteration 1).
