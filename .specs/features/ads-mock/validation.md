# Ads Mock Validation

## Validation: ads-mock - PASS

**Date**: 2026-10-05
**Spec**: `.specs/features/ads-mock/spec.md` (ADS-01..ADS-14 + 2 edge cases); source of truth `docs/prompts/05-sync.md` ("Mock: `apps/ads-mock`", "Tests > Mock")
**Diff range**: uncommitted working tree on `feat/ads-mock` vs `feat/sync-events` `6a1e459`. Untracked: `apps/ads-mock/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}`, `apps/ads-mock/src/{app,app.test,env,rate-limiter,server}.ts`, `.specs/features/ads-mock/`, `docs/`. Modified: `pnpm-lock.yaml`, `.specs/STATE.md`
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 1. The iteration 0 report (verdict: not ready, gaps G1-G3) is kept below; the Iteration 1 section at the end supersedes it.

Iteration 0 was FAIL because two non-equivalent mutants on an explicit SHALL survive: ADS-04 requires an **integer** `priceCents` and an **integer** `version`, and no test sends a fractional value for either (M10, M13). Both are test-only fixes. All other behavior is covered with assertions that check the outcomes the spec defines. 45 of 50 mutants are killed. Of the 5 survivors, 1 is equivalent (M22), 2 are the gaps above, and 2 are env-schema mutants (M49, M50). ADS-13 was planned without automated tests and was verified by running the schema directly.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Workspace app scaffold and env | ✅ Done | `env.ts:3-23`, `server.ts:1-11`; `pnpm --filter ads-mock typecheck` exit 0 |
| T2 Updates, ads and API key | ⚠️ Done, two Zod `int()` rules not discriminated | `app.ts:27-44`, `app.ts:61-78`, `app.ts:89-95`, `app.ts:113-150`; see G1, G2 |
| T3 Rate limit and failure injection | ✅ Done | `rate-limiter.ts:8-27`, `app.ts:80-87`, `app.ts:97-107`, `app.ts:120-136` |

---

## Spec-Anchored Acceptance Criteria

`T` = `apps/ads-mock/src/app.test.ts`, `A` = `apps/ads-mock/src/app.ts`, `RL` = `apps/ads-mock/src/rate-limiter.ts`.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ADS-01 apply newer, ignore others, 200 `{ applied, ignored }` | 200, exact counts, stored state | `T:62-92` → `toEqual({ applied: 2, ignored: 0 })` + exact `GET /ads` body; `T:127-148` newer version stored with new `updatedAt` `12:00:01.000Z`; `T:150-168` mixed batch `{ applied: 2, ignored: 1 }`. M2, M43, M44, M48 killed | ✅ PASS |
| ADS-02 equal or lower version ignored, state kept | `{ applied: 0, ignored: 1 }`, stored ad unchanged | `T:94-125` `it.each` older (4) and equal (5) → exact response and exact stored ad (stock 7, version 5, original `updatedAt`). M1 (`<=` → `<`) killed by the equal case | ✅ PASS |
| ADS-03 tenants stored independently | same SKU, different state per tenant | `T:170-189` CAM-P in ACME (25/4990/10) and GLOBEX (4/5490/3) via `toMatchObject`. M3 (single shared key) killed | ✅ PASS |
| ADS-04 invalid body or invalid JSON → 400 | 400, nothing applied | `T:191-217` `it.each` 10 cases → `expect(400)` + `ads` `toEqual([])`; `T:219-228` exactly 100 items → 200; `T:230-237` non-JSON → `expect(400, { error: "Invalid JSON body" })`. M4-M9, M11, M12, M14, M45 killed. **No fractional `priceCents` case (M10 survived) and no fractional `version` case (M13 survived)** | ❌ GAP (G1, G2) |
| ADS-05 `GET /ads` 200 sorted by `sku`, 400 for non-uuid | exact fields, `sku` order, 400 | `T:73-91` exact body with all five fields, BON-01 before CAM-P although inserted after it; `T:256-258` `ads("acme")` → 400. M15, M41, M42 killed | ✅ PASS |
| ADS-06 missing or wrong key → 401 on every route | 401 on both routes | `T:241-252` `it.each` missing/wrong → `POST /updates` and `GET /ads` `expect(401, { error: "Invalid API key" })`, nothing applied. M16 (key only on GET), M17 (key only on POST), M18 (presence-only check) killed | ✅ PASS |
| ADS-07 above limit → 429, `Retry-After` whole seconds, across tenants, nothing applied | 429, `Retry-After: "1"`, no state change | `T:269-286` 5 accepted alternating ACME/GLOBEX, 6th → 429, `retry-after` `toBe("1")`, GLOBEX ads `["SKU-1","SKU-3"]` (LATE absent); `T:328-338` 999 ms wait rounds up to `"1"`. M21, M23, M24, M27 (per-tenant limiter), M28 (429 falls through and applies) killed | ✅ PASS |
| ADS-08 accepted again after the window | 429 at +999 ms, 200 at +1000 ms | `T:288-312` exact boundary: 429 at 599 ms after the 2nd request, 200 one ms later, then 429. M19 (`<=` → `<`), M20 (off-by-one window) killed | ✅ PASS |
| ADS-09 fail with probability `FAILURE_RATE`, mode picked at random among three | `random() < rate` fails; thirds → 500 / held 500 / apply then 500 | Threshold: `T:386-390` draw = rate → 200 (M29 killed). Modes via second draw: 0.1 → immediate 500 `T:342-348`; 0.5 → held 500 `T:350-362` (`elapsed >= 45` ms with 50 ms delay); 0.9 → apply then 500 `T:364-374`. M37-M40, M46 (mode mapping), M34 (delay ignored), M47 (504 instead of 500) killed | ✅ PASS |
| ADS-10 immediate and held 500 apply nothing | `ads` empty | `T:347`, `T:361` `toEqual([])`. M30, M32 (apply before failing) killed; M31, M33 (branch removed) killed | ✅ PASS |
| ADS-11 apply-then-500 reflects the batch | stored stock 8, version 4; retry ignored | `T:371-373` `toMatchObject([{ sku: "CAM-P", stock: 8, version: 4 }])`; `T:376-384` retried delivery → 200 `{ applied: 0, ignored: 1 }`. M35, M36 killed | ✅ PASS |
| ADS-12 `FAILURE_RATE` 0 never fails | 200 even when `random()` returns 0 | `T:392-400` 20 requests with `random = 0` → 200 each. M29 killed | ✅ PASS |
| ADS-13 env via Zod, defaults, readable exit on invalid | `PORT` 4000, `FAILURE_RATE` 0.2 in [0,1], `RATE_LIMIT_PER_SECOND` 5, `TIMEOUT_DELAY_MS` 5000, `API_KEY` required | **No automated test** (planned: `tasks.md` Test Coverage Matrix "Env schema: none"). Verified by execution against `env.ts:3-21`: `API_KEY=k` → `{"PORT":4000,"FAILURE_RATE":0.2,"RATE_LIMIT_PER_SECOND":5,"TIMEOUT_DELAY_MS":5000}`; missing `API_KEY` → "Invalid environment variables: ✖ … at API_KEY", exit 1 (also via `server.ts`); `FAILURE_RATE=2` → "Too big: expected number to be <=1", exit 1; `FAILURE_RATE=-0.1` → exit 1; `RATE_LIMIT_PER_SECOND=0` → exit 1. M49, M50 survive by construction | ✅ PASS (execution only, see G3) |
| ADS-14 `createApp({ apiKey, failureRate, rateLimitPerSecond, timeoutDelayMs, random, now })` | injectable randomness and time | `A:10-17`, `A:50-57`; every test builds the app through `T:10-20` with injected `random` and `now`; `T:104`, `T:301-305` drive the clock | ✅ PASS |

**Edge cases**

- [x] Same SKU twice in one batch applied in order against the previous item's state: `T:150-168` versions 2, 1, 3 → `{ applied: 2, ignored: 1 }`, final `{ stock: 3, version: 3 }` (M2, M44 killed)
- [x] 429 and 401 not counted: 401 `T:314-326` (M26, rate limit before the key check, killed); 429 `T:288-312` (M25, rejected requests pushed to the window, killed)

**Status**: ❌ 1 AC with gaps (ADS-04: G1, G2). 0 spec-precision gaps: every AC states a precise outcome. Two assumptions in the spec are still marked "Confirmed? n" (scope of rate limit/failures is `POST /updates` only; timeout mode answers 500 without applying). The tests pin both choices (`T:260-265`, `T:350-362`). They need the user's confirmation, not a code fix.

---

## Discrimination Sensor

Baseline before the sensor: `git status --porcelain` saved, `git diff | shasum` = `11ed73c7cdf9573afbf02cb3be1a533934a70287`, and `shasum` of every file in `apps/ads-mock` (excluding `node_modules`, `.turbo`), because the app is untracked and `git diff` does not cover it. Each source file was backed up to the session scratchpad. Each mutant was a single-occurrence exact replacement (multi-site for M3, M16, M17, M26, M36), run with `npx vitest run` in `apps/ads-mock`, and the file was then copied back and checked against the backup with SHA-256 ("restored ok" after every run). No `git stash` or `checkout` was used. After the sensor, porcelain, the diff hash and all ten file hashes matched the baseline.

| # | File:line | Mutation | Killed? |
| - | --------- | -------- | ------- |
| M1 | `A:70` | version check `<=` → `<` | ✅ Killed (`T:94` equal, `T:376`) |
| M2 | `A:70` | version check removed (always apply) | ✅ Killed (4 tests) |
| M3 | `A:62,65,146` | single shared key instead of `tenantId` | ✅ Killed (`T:170`, `T:269`) |
| M4 | `A:38` | items `.min(1)` → `.min(0)` | ✅ Killed (`T:194`) |
| M5 | `A:39` | items `.max(100)` → `.max(99)` | ✅ Killed (`T:219`) |
| M6 | `A:39` | items `.max(100)` → `.max(101)` | ✅ Killed (`T:195`) |
| M7 | `A:32` | `sku` without `.min(1)` | ✅ Killed (`T:202`) |
| M8 | `A:33` | `stock` without `.int()` | ✅ Killed (`T:204`) |
| M9 | `A:33` | `stock` without `.min(0)` | ✅ Killed (`T:203`) |
| M10 | `A:34` | `priceCents` without `.int()` | ❌ Survived → G1 |
| M11 | `A:34` | `priceCents` without `.min(0)` | ✅ Killed (`T:205`) |
| M12 | `A:35` | `version` `.positive()` → `.min(0)` | ✅ Killed (`T:206`) |
| M13 | `A:35` | `version` without `.int()` | ❌ Survived → G2 |
| M14 | `A:28` | body `tenantId` `z.uuid()` → `z.string()` | ✅ Killed (`T:193`) |
| M15 | `A:44` | query `tenantId` `z.uuid()` → `z.string()` | ✅ Killed (`T:256`) |
| M16 | `A:110,113` | API key only on `POST /updates` | ✅ Killed (`T:241` ×2) |
| M17 | `A:110,140` | API key only on `GET /ads` | ✅ Killed (3 tests) |
| M18 | `A:90` | key check accepts any present key | ✅ Killed (`T:241` wrong, `T:314`) |
| M19 | `RL:13` | window eviction `<=` → `<` | ✅ Killed (`T:288`, `T:314`) |
| M20 | `RL:13` | window shortened by 1 ms | ✅ Killed (`T:288`) |
| M21 | `RL:16` | limit `>=` → `>` | ✅ Killed (4 tests) |
| M22 | `RL:21` | `Math.ceil` → `Math.floor` | ⚪ Survived, equivalent: with a 1 s window `waitMs ∈ (0, 1000]`, and `Math.max(1, ·)` turns both into 1 |
| M23 | `RL:21` | `Retry-After` in ms (`Math.ceil(waitMs)`) | ✅ Killed (`T:269`, `T:328`) |
| M24 | `RL:21` | `Retry-After` + 1 | ✅ Killed (`T:269`, `T:328`) |
| M25 | `RL:17` | rejected requests counted in the window | ✅ Killed (`T:288`) |
| M26 | `A:110,113` | rate limit runs before the key check (401s counted) | ✅ Killed (`T:314`) |
| M27 | `A:97-98` | per-tenant limiter instead of global | ✅ Killed (`T:269`) |
| M28 | `A:99-104` | over-limit request falls through and is applied | ✅ Killed (4 tests) |
| M29 | `A:81` | failure threshold `>=` → `>` | ✅ Killed (`T:386`, `T:392`) |
| M30 | `A:121` | immediate 500 applies the batch | ✅ Killed (`T:342`) |
| M31 | `A:121` | immediate 500 branch removed | ✅ Killed (`T:342`, `T:402`) |
| M32 | `A:125` | held 500 applies the batch | ✅ Killed (`T:350`) |
| M33 | `A:125` | held 500 branch removed | ✅ Killed (`T:350`) |
| M34 | `A:126` | timeout delay ignored (`sleep(0)`) | ✅ Killed (`T:350`) |
| M35 | `A:133` | apply-then-500 answers 200 | ✅ Killed (`T:364`, `T:376`) |
| M36 | `A:132` | apply-then-500 does not apply | ✅ Killed (`T:364`, `T:376`) |
| M37 | `A:48` | modes reordered: timeout, error, apply | ✅ Killed (`T:350`) |
| M38 | `A:48` | modes reordered: apply, timeout, error | ✅ Killed (3 tests) |
| M39 | `A:83` | mode index `× 2` (apply mode unreachable) | ✅ Killed (`T:364`, `T:376`) |
| M40 | `A:83` | mode index `Math.round` | ✅ Killed (`T:350`) |
| M41 | `A:148` | `GET /ads` sorted descending | ✅ Killed (`T:62`, `T:269`) |
| M42 | `A:148` | `GET /ads` unsorted (insertion order) | ✅ Killed (`T:62`) |
| M43 | `A:73` | `updatedAt` from the real clock | ✅ Killed (4 tests) |
| M44 | `A:77` | `ignored: 0` | ✅ Killed (4 tests) |
| M45 | `A:153` | invalid-JSON handler never matches | ✅ Killed (`T:230`) |
| M46 | `A:83` | mode picked from `failureRate`, not a second draw | ✅ Killed (3 tests) |
| M47 | `A:127` | held failure answers 504 | ✅ Killed (`T:350`) |
| M48 | `A:137` | success answers 201 | ✅ Killed (15 tests) |
| M49 | `env.ts:6` | `FAILURE_RATE` without `.max(1)`, default 0.5 | ❌ Survived (no env tests by plan) → G3 |
| M50 | `env.ts:4` | `PORT` default 3000 | ❌ Survived (no env tests by plan) → G3 |

**Sensor depth**: P0-expanded (rate limit, failure injection and versioning are the contract the worker depends on); 50 manual behavior-level mutations
**Sensor outcome (iteration 0)**: 45/50 killed. Of the 5 survivors, 1 is equivalent (M22), 2 are test gaps on an explicit SHALL (M10, M13) and 2 sit in the untested env schema (M49, M50). Not ready ❌ (iteration 1 kills M10 and M13, see below)

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code: one `createApp`, one limiter function, no shared code with the backend | ✅ |
| Surgical changes: only `apps/ads-mock`, the lockfile and specs | ✅ |
| No scope creep: no worker, no compose service, no persistence | ✅ |
| Matches patterns: `env.ts` mirrors the backend style (`safeParse`, `prettifyError`, `process.exit(1)`); Express 5 + Zod 4 + Vitest + supertest as `05-sync.md` asks | ✅ |
| Comments only for the non-obvious why (`A:130-131`, `RL:7`) | ✅ |
| `CLAUDE.md` database rules | n/a (in-memory, no database) |
| Spec-anchored outcome check | ⚠️ ADS-04 integer rules for `priceCents`/`version` not asserted |
| Every test maps to a spec AC or edge case (`T:260` "not rate limited" maps to the spec assumption on `GET /ads` scope) | ✅ |
| Documented guidelines followed: `CLAUDE.md`, `docs/prompts/05-sync.md` | ✅ |

---

## Gate Check

- **Gate command**: `pnpm --filter ads-mock test`, `pnpm --filter ads-mock typecheck`, `npx biome check apps/ads-mock` (the backend suite was not run: this feature does not touch it)
- **Result**: vitest **33 passed**, 0 failed, 0 skipped (1 file, ~330 ms); typecheck exit 0; biome "Checked 9 files. No fixes applied."
- **Test count before feature**: 0 (new app)
- **Test count after feature**: 33
- **Delta**: +33
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

### G1 (Major): fractional `priceCents` accepted by no test (ADS-04, M10)

- **Root cause**: the 400 table at `T:191-211` has "fractional stock" but no "fractional price".
- **Fix task**: add `["fractional price", { tenantId: ACME, items: [item({ priceCents: 49.9 })] }]` to the `it.each` at `T:191`. It must fail with M10 applied.

### G2 (Major): fractional `version` accepted by no test (ADS-04, M13)

- **Root cause**: only `version: 0` and a missing version are tested. A non-integer version would break the integer comparison that the worker's `bigint` versions rely on.
- **Fix task**: add `["a fractional version", { tenantId: ACME, items: [item({ version: 1.5 })] }]` to the same `it.each`. It must fail with M13 applied.

### G3 (Minor): env schema has no automated test (ADS-13, M49, M50)

- **Root cause**: by plan (`tasks.md` matrix "Env schema: none"), and `env.ts` exits at import time. The backend's `infra/env.ts` has no test either, so this matches the project's practice. Behavior was verified by execution in this report.
- **Fix task (optional)**: export the schema (or a `parseEnv(source)`) from `env.ts` and add a test for the defaults, `FAILURE_RATE` bounds and a missing `API_KEY`. The alternative is to accept execution-only evidence explicitly in the spec.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| ADS-01..ADS-03, ADS-05..ADS-12, ADS-14 | Implemented | ✅ Verified |
| ADS-04 | Implemented | ❌ Needs Fix (G1, G2) |
| ADS-13 | Implemented | ✅ Verified by execution (no automated test, G3) |

---

## Summary

**Overall**: ❌ Not Ready (iteration 0)

**Spec-anchored check**: 13/14 ACs matched the spec outcome. ADS-04 has 2 gaps. 0 spec-precision gaps. 2 spec assumptions are still unconfirmed by the user.
**Sensor**: 50 mutations, 45 killed. The 5 survivors are 1 equivalent (M22), 2 gaps (M10, M13) and 2 in the untested env schema (M49, M50).
**Gate**: 33 passed, typecheck and lint clean

**What works**: versioned apply per `(tenantId, sku)` with exact counts and state, including duplicate SKUs in one batch and a retried apply-then-500 delivery. The global sliding-window limit is pinned at the exact 1000 ms boundary, `Retry-After` is in whole seconds, rejected requests are not counted, and 429 applies nothing. The API key is enforced on both routes. Failures are covered at the exact threshold, each mode is checked for applying or not applying, the held delay is real, and the mode index mapping is checked. `GET /ads` order and fields are exact. Invalid JSON returns 400.

**Issues found**: G1 and G2 are two missing 400 cases, both test-only. G3 is optional env-schema tests.

**Next steps**: add the two `it.each` rows (G1, G2), re-run `pnpm --filter ads-mock test`, and re-dispatch the Verifier. Confirm the two open assumptions with the user before committing.

---

## Iteration 1

**Date**: 2026-10-05
**Verdict**: PASS

G1 and G2 are closed: the two new 400 rows kill M10 and M13. G3 is accepted as a documented test gap, not a blocker. ADS-04 is now fully discriminated, and the gate is green with 35 tests.

### Changes since iteration 0

Only `apps/ads-mock/src/app.test.ts` changed. Two rows were added to the 400 `it.each` at `T:191-222`:

- `T:206-209` "fractional price": `item({ priceCents: 49.9 })`
- `T:211-214` "a fractional version": `item({ version: 1.5 })`

Both rows go through the shared body at `T:217-221`: `expect(400)` and `GET /ads` for ACME `toEqual([])`. That is the outcome ADS-04 defines (400, nothing applied). The assertion checks the spec outcome and does not mirror the implementation. `app.ts`, `env.ts`, `rate-limiter.ts` and `server.ts` are unchanged.

### Re-run of the surviving mutants

Baseline before the sensor: `git status --porcelain` saved, `git diff | shasum` = `654bc09bab179a1e45f6402880fd5e99971a44af`, and `shasum` of all 9 files in `apps/ads-mock` (excluding `node_modules`). `app.ts` was backed up to the scratchpad. Each mutant was a single-occurrence exact replacement, run with `npx vitest run`, and then restored and checked against the SHA-256 of the backup ("restored ok" after each run).

| # | File:line | Mutation | Iteration 0 | Iteration 1 |
| - | --------- | -------- | ----------- | ----------- |
| M10 | `A:34` | `priceCents` without `.int()` | Survived | ✅ Killed: 1 failed / 34 passed, "responds 400 for fractional price" (`T:206`) |
| M13 | `A:35` | `version` without `.int()` | Survived | ✅ Killed: 1 failed / 34 passed, "responds 400 for a fractional version" (`T:211`) |

Each mutant fails only its own row, so each row discriminates exactly the rule it targets.

**Sensor totals**: 47/50 killed. Survivors: M22 (equivalent) and M49, M50 (env schema, accepted below).

### G3 decision: env schema without automated tests (ADS-13)

Accepted for PASS. Reasons:

1. The approved plan declares it: `tasks.md:23` Test Coverage Matrix, "Env schema | none | typecheck only; exercised by `server.ts`". This is a planned scope, not a missed test.
2. It matches project practice: the backend's `apps/backend/src/infra/env.ts` has no unit test either.
3. `env.ts:13-21` parses and exits at import time. Testing it would need a refactor (an exported schema or `parseEnv`) that is outside this feature's tasks.
4. The behavior was verified by execution again in this iteration, against the unchanged `env.ts:3-9`. With only `API_KEY=k`: `{"PORT":4000,"FAILURE_RATE":0.2,"RATE_LIMIT_PER_SECOND":5,"TIMEOUT_DELAY_MS":5000}`, exit 0. Missing `API_KEY`: "Invalid environment variables: ✖ … → at API_KEY", exit 1. `FAILURE_RATE=2`: exit 1.

Residual risk: M49 (`FAILURE_RATE` without `.max(1)` or with another default) and M50 (another `PORT` default) would not be caught by CI. Both are configuration defaults that are visible at startup, and the worker does not depend on them for correctness. If the project later adds env tests for the backend, the same pattern should cover this app.

### Gate

- `pnpm --filter ads-mock test`: **35 passed**, 0 failed, 0 skipped (33 → 35, +2)
- `pnpm --filter ads-mock typecheck`: exit 0
- `npx biome check apps/ads-mock`: "Checked 9 files. No fixes applied."

### Open items (not blocking)

Two spec assumptions are still marked "Confirmed? n" and wait for the user's decision. The first is that rate limiting and failure injection apply only to `POST /updates` (pinned by `T:268-273`). The second is that the timeout mode answers 500 without applying (pinned by `T:358-370`). These need the user's confirmation, not code changes.

### Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| ADS-04 | ❌ Needs Fix (G1, G2) | ✅ Verified |
| ADS-13 | ✅ Verified by execution | ✅ Verified by execution (G3 accepted, no automated test by plan) |
| ADS-01..ADS-03, ADS-05..ADS-12, ADS-14 | ✅ Verified | ✅ Verified (unchanged code, suite green) |

### Summary

**Overall**: ✅ Ready (iteration 1 of max 3)
**Spec-anchored check**: 14/14 ACs match the spec outcome (ADS-13 by execution). 0 spec-precision gaps.
**Sensor**: 47/50 killed, 1 equivalent, 2 accepted env-schema survivors.
**Gate**: 35 passed, typecheck and lint clean.
