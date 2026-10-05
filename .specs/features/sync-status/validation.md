# Sync Status Validation

## Validation: sync-status - PASS (iteration 1)

**Date**: 2026-10-05
**Spec**: `.specs/features/sync-status/spec.md` (STS-01..STS-06 + 2 edge cases); source of truth `docs/prompts/05-sync.md` ("GET /sync/status", "Tests > Status"); rules `CLAUDE.md`
**Diff range**: uncommitted working tree on `feat/sync-status` vs `feat/sync-worker` 8233cea (`app.ts`, `sync.repository.ts`, `sync.service.ts` modified; `sync.controller.ts`, `sync-status.test.ts` new)
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 1 of max 3 (iteration 0 failed on G1, G2; both closed by test-only changes in `T`)

## Iteration 1 (re-verification)

**Date**: 2026-10-05. **Verdict**: PASS ✅. Production code is unchanged since iteration 0 (SHA-1 of `R` `7ce3c4cc`, `SV` `57db3ae0`, `C` `0d92f3c1`, `app.ts` `e47959c1` identical); only `T` changed (`353411d3` → `a9fad186`).

- **G1 closed**: `T:161-199` now sets `updatedAt: at(Math.min(22 - i, 21))` (`T:171`), so `updated_at` runs against the insertion order (`id` uuidv7, `version`, `created_at`), with events 0 and 1 tied on the latest timestamp. Expected list (`T:181-196`): the tied pair by `id desc`, then stocks 2..19; `toEqual` at `T:198`, `failed: 23` at `T:197`.
- **G2 closed**: new test `T:247-269` sends the Acme cookie with Globex's id in `?tenantId=`, `X-Tenant-Id` and a JSON body, and asserts `toEqual` Acme's seed-only state while Globex has a failed event.

Sensor re-run (scratch copy of `apps/backend` with `node_modules` symlinked, `stocksync_test`, one vitest at a time, exact single-occurrence replacement, scratch `src` diffed back to identical after every mutant, scratch deleted afterwards):

| # | File:line | Mutant | Iteration 0 | Iteration 1 |
| - | --------- | ------ | ----------- | ----------- |
| M15 | `R:214` | `updated_at asc` | killed | killed (`T:161`) |
| M16 | `R:214` | tie-break `id asc` | killed | killed (`T:161`) |
| M17 | `R:214` | tie-break dropped | killed | killed (`T:161`, 2/2 runs) |
| M18 | `R:214` | `created_at desc, id desc` | survived | **killed** (`T:161`) |
| M30 | `R:214` | `id desc` only | survived | **killed** (`T:161`) |
| M31 | `R:214` | `version desc` only | survived | **killed** (`T:161`) |
| M25 | `C:8` | tenant from `req.query.tenantId ?? token` | survived | **killed** (`T:247`) |
| M26 | `C:8` | tenant from `x-tenant-id` header `?? token` | survived | **killed** (`T:247`) |
| M27 | `C:8` | tenant from `req.body.tenantId ?? token` | survived | **killed** (`T:247`) |

Each kill is an `AssertionError` in the named test only (1 failed, 10 passed), not a load or runtime error. M1-M14 and M19-M29 target code that did not change and assertions that were not weakened; they are carried over as killed. **Sensor**: 31/31 killed.

Stability: the unmutated scratch copy passed `sync-status.test.ts` 3 times in a row (11/11 each). Real tree: `vitest run src/modules/sync` 5 files, 85 passed; `tsc --noEmit` clean; `biome check` on `T` clean. Feature test count 10 → 11 (suite total 337 → 338).

M17 note: with the tie-break dropped Postgres returned the tied pair in insertion order both runs, which differs from `id desc`; the kill depends on that plan-level order, so it is reliable here but not guaranteed by SQL.

---

## Iteration 0 (history)

The endpoint behaved as specified and every AC had an exact-value assertion, but two spec rules were not discriminated by the tests. The primary sort key of `failedEvents` (`updated_at desc`) is never exercised against the insertion order, so ordering by `id`, `version` or `created_at` passes (G1). STS-05's "tenant only from the token" is never challenged by a request that names another tenant, so a controller that lets `?tenantId=` override the token passes (G2).

`T` = `apps/backend/src/modules/sync/sync-status.test.ts`, `R` = `apps/backend/src/modules/sync/sync.repository.ts`, `SV` = `apps/backend/src/modules/sync/sync.service.ts`, `C` = `apps/backend/src/http/controllers/sync.controller.ts`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Status queries and service | ✅ Done | `R:173-216`, `SV:15-33`; uncommitted by project override (tasks.md) |
| T2 Route and tests | ✅ Done | `C:7-9`, `apps/backend/src/app.ts:27`, `T:88-265` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| STS-01 admin/operator → 200, exact shape | 200 with exactly `{ pending, sent, failed, superseded, lastSuccessfulSyncAt, failedEvents }` | `T:90-99` `toEqual({ pending: 2, sent: 0, failed: 0, superseded: 0, lastSuccessfulSyncAt: null, failedEvents: [] })` (admin); `T:148` operator `.expect(200)`; `T:245-250` both roles 200 | ✅ PASS |
| STS-02 counts per status, 0 when none | caller's counts; 0 for an absent status | `T:150-156` `toMatchObject({ pending: 1, sent: 3, failed: 1, superseded: 2, ... })`; `T:124-131` all zeros for a tenant without events | ✅ PASS |
| STS-03 `lastSuccessfulSyncAt` | greatest `sent_at` as ISO string, `null` when nothing sent | `T:155` `"2026-10-05T12:00:30.000Z"` from sentAt 10/30/20 s (max is not first or last inserted); `T:97`, `T:129` `null` | ✅ PASS |
| STS-04 `failedEvents` | ≤20 current `failed`, `updated_at desc, id desc`, exactly 7 fields | `T:159-197` `toEqual(expected)` over 23 failed events: length 20, tie on `updated_at` ordered `id desc`, exact field set; `T:211-212` superseded excluded | ⚠️ PASS on value, but the `updated_at` key is not discriminated (G1: M18, M30, M31 survive) |
| STS-05 tenant only from token, no cross-tenant data | other tenant's events never included | `T:215-243` Acme `toEqual` seed-only state while Globex has failed + sent; Globex sees its own | ⚠️ PASS for isolation, but "only from the token" is not challenged (G2: M25-M27 survive) |
| STS-06 no cookie / invalid token | 401 `UNAUTHORIZED` | `T:252-264` `toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required" } })` for both cases | ✅ PASS |

**Status (iteration 0)**: gaps G1, G2, closed in iteration 1. No spec-precision gaps: every AC defines an exact outcome and the tests assert exact values.

---

## Edge Cases

- [x] Tenant without events → zeros, `null`, `[]`: `T:102-132` `toEqual`
- [x] `failed` → `superseded` leaves `failedEvents`: `T:199-213` (`failed: 0`, `failedEvents: []`)

---

## Discrimination Sensor

Isolation: `apps/backend` (`src`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env`) was copied to `scratchpad/sync-status/backend` with `node_modules` symlinked, because the user's `tsx watch` API and worker run against `stocksync` and would hot-reload an in-place mutant. Tests ran against `stocksync_test` only, one vitest at a time (`pgrep vitest` empty before each run). The unmutated copy passed first (10/10). Each mutant was an exact single-occurrence replacement, run with `vitest run src/modules/sync/sync-status.test.ts`, then restored and its SHA-1 checked. The scratch copy (including `.env`) was deleted afterwards.

| # | File:line | Mutant | Result |
| - | --------- | ------ | ------ |
| M1 | `R:180` | counts: tenant filter dropped | killed (4 tests) |
| M2 | `R:191` | `max(sent_at)`: tenant filter dropped | killed (`T:215`) |
| M3 | `R:212` | failed list: tenant filter dropped | killed (`T:215`) |
| M4 | `SV:18` | counts start as `{}` (no default 0) | killed (4 tests) |
| M5 | `SV:18` | `superseded` missing default 0 | killed (3 tests) |
| M6 | `SV:22` | pending ↔ sent keys swapped | killed (3 tests) |
| M7 | `SV:22` | failed ↔ superseded keys swapped | killed (4 tests) |
| M8 | `R:189` | `max` → `min` sent_at | killed (`T:134`) |
| M9 | `SV:27` | `lastSuccessfulSyncAt ?? new Date(0)` | killed (3 tests) |
| M10 | `R:212` | status in (`failed`, `superseded`) | killed (`T:199`) |
| M11 | `R:212` | status in (`failed`, `pending`) | killed (4 tests) |
| M12 | `SV:15` | limit 19 | killed (`T:159`) |
| M13 | `SV:15` | limit 21 | killed (`T:159`) |
| M14 | `R:215` | no limit | killed (`T:159`) |
| M15 | `R:214` | `updated_at asc` | killed (`T:159`) |
| M16 | `R:214` | tie-break `id asc` | killed (`T:159`) |
| M17 | `R:214` | tie-break dropped | killed (`T:159`) |
| **M18** | `R:214` | order by `created_at desc, id desc` | **survived** (G1) |
| **M30** | `R:214` | order by `id desc` only | **survived** (G1) |
| **M31** | `R:214` | order by `version desc` only | **survived** (G1) |
| M19 | `R:208` | `failedEvents` leaks `tenantId` | killed (`T:159`) |
| M20 | `R:208` | `failedEvents` adds `stock` | killed (`T:159`) |
| M21 | `R:207` | `lastError` missing | killed (`T:159`) |
| M22 | `R:208` | `updatedAt` read from `created_at` | killed (`T:159`) |
| M23 | `C:7` | `requireAuth` removed | killed (10 tests) |
| M24 | `apps/backend/src/app.ts:27` | mounted at `/sync-status` | killed (10 tests) |
| **M25** | `C:8` | tenant from `req.query.tenantId ?? token` | **survived** (G2) |
| **M26** | `C:8` | tenant from `x-tenant-id` header `?? token` | **survived** (G2) |
| **M27** | `C:8` | tenant from `req.body.tenantId ?? token` | **survived** (G2) |
| M28 | `C:8` | status 201 | killed (8 tests) |
| M29 | `SV:26` | extra top-level field `total` | killed (3 tests) |

**Sensor depth**: expanded (STS-05 is tenant isolation, a data-integrity path)
Iteration 0 outcome: 31 mutants, 25 killed, 6 survived (2 gaps), closed in iteration 1.

Why G1 survives: `T:161-170` inserts the failed events in one statement with `updatedAt` rising with the insertion index, and `id` is `uuidv7()` (`apps/backend/src/infra/schemas/sync-events.ts:39`), so `id`, `version` and `created_at` all follow the same order as `updated_at`. Any of them as the primary key yields the expected list. In production they diverge: an older event whose retry fails later has a newer `updated_at` but an older `id`/`version`.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes (only `app.ts` mount + three repository functions + service + router) | ✅ |
| No scope creep (no role check beyond `requireAuth`, as the spec's assumption table records) | ✅ |
| Matches patterns (repository filtered by `tenantId` at `R:180`, `R:191`, `R:212`; router in `http/controllers/`) | ✅ |
| Spec-anchored outcome check (asserted values match spec) | ✅ |
| Per-layer coverage (integration: happy, edge, error for the one route) | ✅ |
| Every test maps to a spec requirement - no unclaimed tests | ✅ (`T:89` STS-01/02/03, `T:102` edge 1, `T:134` STS-02/03, `T:159` STS-04, `T:199` edge 2, `T:215` STS-05, `T:245` STS-01, `T:252` STS-06) |
| Documented guidelines followed: `CLAUDE.md` (tenant filter, comments only for *why*: `T:168`) | ✅ |
| Discrimination sensor | ✅ 31/31 in iteration 1 (G1, G2 closed) |

---

## Gate Check

- **Gate command**: Build `pnpm typecheck && pnpm test && pnpm lint:check`, run as its parts: backend `vitest run` (scratch copy, byte-identical to the real `src` by `diff -r`, test DB `stocksync_test`), `tsc --noEmit` in `apps/backend` (real tree), `biome check .` (repo root)
- **Result** (iteration 0): 15 files, **337 passed**, 0 failed, 0 skipped; `tsc` clean; biome "Checked 80 files. No fixes applied."
- **Test count before feature**: 327 (337 minus the 10 tests in `T`; no other test file changed)
- **Test count after feature**: 337
- **Delta**: +10
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

### G1 (Major): `failedEvents` primary order `updated_at desc` not discriminated (STS-04; M18, M30, M31)

- **Root cause**: in `T:161-170` the failed events' `updated_at` rises with the insertion order, which is also the `id` (uuidv7), `version` and `created_at` order.
- **Fix task**: in `T:159`, give the failed events an `updatedAt` that runs against the insertion order (e.g. `at(22 - i)` with the tie kept on two events), or bump `updated_at` of the earliest-inserted events after insert, so the newest `updated_at` belongs to an event with an older `id` and `version`. Keep the 21-vs-20 limit and the `id desc` tie. Done when M18, M30, M31 fail and M15-M17 still fail.

### G2 (Minor): "tenant only from the token" not challenged (STS-05; M25-M27)

- **Root cause**: `T:215-243` proves isolation for requests that carry no tenant hint, so a controller that accepts a tenant from the query, a header or the body (falling back to the token) still passes.
- **Fix task**: in `T:215` (or a new test), call `GET /sync/status?tenantId=<globex>` with the Acme cookie, a JSON body `{ tenantId: globex }` and an `X-Tenant-Id: <globex>` header, and assert the Acme response `toEqual` Acme's seed-only state. Done when M25, M26 and M27 fail.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| STS-01 | Implemented | ✅ Verified |
| STS-02 | Implemented | ✅ Verified |
| STS-03 | Implemented | ✅ Verified |
| STS-04 | Implemented | ✅ Verified (iteration 1, G1 closed) |
| STS-05 | Implemented | ✅ Verified (iteration 1, G2 closed) |
| STS-06 | Implemented | ✅ Verified |

---

## Isolation

Iteration 1: real-tree SHA-1 of every file in `modules/sync/`, `http/middlewares/`, `sync.controller.ts` and `app.ts` identical before and after the sensor (`T` `a9fad186`); `git status --porcelain` (10 entries) and `git diff | shasum` (`d1412918`) match the iteration 1 baseline. Scratch copy deleted; only this `validation.md` was written.

Iteration 0: Real-tree SHA-1 before and after the sensor are identical: `sync.controller.ts` `0d92f3c1`, `app.ts` `e47959c1`, `sync.repository.ts` `7ce3c4cc`, `sync.service.ts` `57db3ae0`, `sync-status.test.ts` `353411d3`, plus every other file in `modules/sync/` and `http/middlewares/`. `git status --porcelain` (8 entries) and `git diff | shasum` (`a5e9ec76`) match the baseline. Only this `validation.md` was written.

---

## Summary

**Overall**: ✅ Ready (iteration 1)

**Spec-anchored check**: 6/6 ACs asserted on exact spec values; 0 spec-precision gaps
**Sensor**: 31/31 killed (iteration 0: 25/31)
**Gate**: `src/modules/sync` 85 passed; suite 338 (337 + 1 new test); tsc and biome clean

**What works**: shape, counts with default 0, `max(sent_at)` / `null`, current-`failed` filter, limit 20, `id desc` tie-break, exact `failedEvents` fields, tenant filter in all three queries, `requireAuth` 401s, mount path.

**Next steps**: none for verification. Lessons for G1 and G2 were recorded in iteration 0; iteration 1 adds no new signal.
