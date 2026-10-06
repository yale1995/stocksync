# API Versioning Validation

## Validation: api-versioning - PASS ✅ (iteration 2)

**Date**: 2026-10-05
**Spec**: `.specs/features/api-versioning/spec.md` (VER-01..VER-07, 2 edge cases); rules `CLAUDE.md`
**Diff range**: uncommitted working tree on `feat/api-versioning` vs HEAD 8881c30 (`git diff` over 11 tracked source/test files, plus the untracked `apps/backend/src/http/api-prefix.ts`)
**Verifier**: independent sub-agent (author ≠ verifier)

Iteration 1 found one gap (G1), and it is closed. The VER-02 `it.each` now also covers `POST /auth/logout`, `POST /products/{id}/stock-adjustments` and `GET /products/{id}/stock-movements`. S17 (`stockMovementsRouter` also mounted unprefixed) is now killed. So is an unprefixed extra mount of every other API router (S19-S22). Since iteration 1, only `app.test.ts` changed among the source and test files.

`A` = `apps/backend/src/app.ts`, `AT` = `apps/backend/src/app.test.ts`, `O` = `apps/backend/src/http/openapi.ts`, `OT` = `apps/backend/src/http/openapi.test.ts`, `DT` = `apps/backend/src/http/controllers/docs.test.ts`, `AuT` = `apps/backend/src/modules/auth/auth.test.ts`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | G1 fixed in iteration 2 |
| T2 | ✅ Done | - |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| VER-01 auth, products, stock movements, sales and sync answer under `/api/v1` exactly as before | same responses with the prefix | Every module test moved to `/api/v1/...` (60 sites in `modules/*/*.test.ts`) with the assertions unchanged (see Test Integrity). `AT:28-41` login at `/api/v1/auth/login`, then `GET /api/v1/products` `status toBe(200)`, `meta.total toBe(2)`. S4, S5 and S13 killed | ✅ PASS |
| VER-02 the same routes without `/api/v1` → 404 `NOT_FOUND` | 404, `error.code === "NOT_FOUND"` | `AT:43-63` `it.each` over `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /products`, `POST /sales`, `GET /sync/status`, `POST /products/{uuid}/stock-adjustments`, `GET /products/{uuid}/stock-movements` → `status toBe(404)`, `error.code toBe("NOT_FOUND")`. Every router has at least one probe. S1, S17, S19, S20, S21 and S22 killed | ✅ PASS (G1 closed) |
| VER-03 `GET /health` 200; `GET /api/v1/health` 404 | 200 `{status:"ok"}`; 404 `NOT_FOUND` | `AT:65-73` `root.status toBe(200)`, `root.body toEqual({status:"ok"})`, `versioned.status toBe(404)`, `error.code toBe("NOT_FOUND")`; `health.test.ts:7-11`. S2 and S3 killed | ✅ PASS |
| VER-04 `/docs` and `/openapi.json` stay at the root | 200 at the root | `DT:58-64` `GET /openapi.json` `status toBe(200)`; `DT:113-120` `GET /docs` `status toBe(200)`, `^text/html`. S11 killed | ✅ PASS |
| VER-05 `servers: [{url:"/api/v1"}]`, paths relative | exact servers; no path starts with `/api` | `OT:92-94` `document.servers toEqual([{ url: "/api/v1" }])`; `OT:100-104` `paths.filter(startsWith("/api")) toEqual([])`; `O:302`. S7, S8 and S14 killed | ✅ PASS |
| VER-06 `/health` path item `servers: [{url:"/"}]` | exact path-level servers | `OT:96-98` `paths["/health"].servers toEqual([{ url: "/" }])`; `O:200`. S6 killed | ✅ PASS |
| VER-07 coverage compares prefixed mounted routes with server-joined documented paths, in both directions | `toEqual` of the two sorted sets | `DT:19-38` joins `rootRoutes` as is and `apiRoutes` with `API_PREFIX`; `DT:42-55` joins each path with `(item.servers ?? document.servers)[0].url`, where `/` means the root; `DT:66-70` `documentedOperations(body) toEqual(registeredOperations())`. Because it is a `toEqual` of the two sets, it works in both directions. S9 and S10 killed | ✅ PASS |

**Status**: 7/7 ACs matched the spec outcome; 0 spec-precision gaps.

---

## Edge Cases

- [x] Cookie path `/` and the cookie sent on later `/api/v1` requests. `AT:28-41` reuses the login cookie on `/api/v1/products` (`status toBe(200)`). The path is pinned exactly by `AuT:319-326`, `setCookieHeader toBe("access_token=; Path=/; ...")` on logout. S15 (`/api`) and S16 (`/api/v1/auth`) are killed.
- [x] Unknown route under `/api/v1` → 404 `NOT_FOUND`, same envelope. `AT:75-85` `body toEqual({ error: { code: "NOT_FOUND", message: "Route GET /api/v1/unknown not found" } })`.

---

## Test Integrity

- Module tests (`auth`, `products`, `sales`, `stock-movements`, `sync-events`, `sync-status`): every hunk of `git diff -U0` was checked by a script in both iterations. Once `/api/v1`, whitespace and trailing commas are removed, the removed and added text are identical. The only non-URL edits are Biome reflows of 6 hunks. No assertion was weakened, removed or added, and the `it` count per module file is unchanged.
- No unprefixed business URL is left in a supertest call. The remaining matches are `/health`, which is correct, the `AT:43-55` probes, which are intentional, and OpenAPI document keys in `OT`.
- Test count: 500 → 514 (+11 in `AT`: 1 + 8 `each` cases + 2; +3 in `OT`). Nothing dropped.

---

## Gate Check

- **Build**: `pnpm typecheck && pnpm test && pnpm lint:check` → **exit 0** (ads-mock 35 passed; stocksync-api 19 files, **514 passed**, 0 failed, 0 skipped; Biome checked 91 files with no issues).
- **Test count before / after**: 500 / 514 (+14).

---

## Discrimination Sensor

The sensor ran in a fresh scratch copy for iteration 2 (`rsync` of the tree, excluding `.git`, into the session scratchpad). Each mutant was applied, the tests ran sequentially against `stocksync_test`, and the file was restored. The scratch was deleted afterward. The real tree's `git status --porcelain` matched the pre-sensor baseline exactly, in both iterations. Tests run per mutant: `src/app.test.ts src/http src/modules/health src/modules/auth/auth.test.ts` (217 tests).

| # | File | Mutation | Killed? |
| - | ---- | -------- | ------- |
| S1 | `A:44` | API routers mounted at the root **and** `/api/v1` | ✅ Killed (8, `AT` VER-02) |
| S2 | `A:21-23` | `/health` moved into `apiRoutes` | ✅ Killed (3: `AT`, `DT` coverage, `health.test`) |
| S3 | `A:44` | `/health` also mounted under v1 | ✅ Killed (`AT:65`) |
| S4 | `api-prefix.ts:1` | `API_PREFIX` → `/api/v2` | ✅ Killed (24) |
| S5 | `A:44` | app mounts the literal `/api` | ✅ Killed (23) |
| S6 | `O:200` | `/health` path-level `servers` dropped | ✅ Killed (`OT:96`, `DT` coverage) |
| S7 | `O:302` | document `servers` dropped | ✅ Killed (`OT:92`, `DT` coverage) |
| S8 | `O:302` | document server literal `/api/v2` | ✅ Killed (`OT:92`, `DT` coverage) |
| S9 | `DT:48` | coverage test ignores path-level servers (test mutant) | ✅ Killed |
| S10 | `DT:48` + `O:200` | S9 combined with S6 | ✅ Killed (`OT:96`) |
| S11 | `A:39` | docs router moved under `/api/v1` | ✅ Killed (6, `DT`) |
| S12 | `A:39` | docs router at the root **and** under `/api/v1` | ⚪ Out of spec (iteration 1: survived; VER-04 does not forbid an extra mount). Not re-run |
| S13 | `A:44` | v1 mounted after `notFoundHandler` | ✅ Killed (23) |
| S14 | `O` | one documented path made absolute (`/api/v1/sync/status`) | ✅ Killed (8) |
| S15 | `auth.controller.ts:16` | cookie `path: "/api"` | ✅ Killed (`AuT` logout exact cookie) |
| S16 | `auth.controller.ts:16` | cookie `path: "/api/v1/auth"` | ✅ Killed (same) |
| S17 | `A:44` | `stockMovementsRouter` also mounted unprefixed | ✅ Killed (2, new stock-adjustments and stock-movements probes). Survived in iteration 1 |
| S19 | `A:44` | `authRouter` also mounted unprefixed | ✅ Killed (3, including the new logout probe) |
| S20 | `A:44` | `productsRouter` also mounted unprefixed | ✅ Killed (3) |
| S21 | `A:44` | `salesRouter` also mounted unprefixed | ✅ Killed (1) |
| S22 | `A:44` | `syncRouter` also mounted unprefixed | ✅ Killed (1) |

**Sensor depth**: lightweight+ (21 mutants in spec)
**Result**: 21/21 in-spec mutants killed - **PASS ✅**

Note: the VER-07 coverage test reads the exported `rootRoutes` and `apiRoutes` tables, not the real mounts in `createApp`. A stray extra mount is therefore caught by the `AT` 404 probes, and those now cover every router (S17, S19-S22).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ `api-prefix.ts` holds one constant shared by `app.ts`, `openapi.ts` and `DT` |
| Surgical changes | ✅ only routing, `servers` and test URLs changed |
| No scope creep | ✅ no aliases, no cookie change, ads-mock untouched |
| Matches patterns | ✅ the `rootRoutes` / `apiRoutes` tables mirror the existing `apiRoutes`; the only comment explains why (`A:20`) |
| Spec-anchored outcome check | ✅ |
| Per-layer coverage (routes: happy + edge + error) | ✅ |
| Every new test maps to an AC or edge case | ✅ `AT:28` VER-01 and cookie edge case, `AT:43` VER-02, `AT:65` VER-03, `AT:75` unknown-route edge case, `OT:92/96/100` VER-05/06 |
| Documented guidelines followed: `CLAUDE.md` | ✅ |

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| VER-01 | Implemented | ✅ Verified |
| VER-02 | Implemented | ✅ Verified |
| VER-03 | Implemented | ✅ Verified |
| VER-04 | Implemented | ✅ Verified |
| VER-05 | Implemented | ✅ Verified |
| VER-06 | Implemented | ✅ Verified |
| VER-07 | Implemented | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 7/7 ACs matched the spec outcome; 0 spec-precision gaps; both edge cases covered
**Sensor**: 21/21 in-spec mutants killed (S12 is out of spec)
**Gate**: Build exit 0; 514 passed

**What works**: the `/api/v1` mount, with a 404 for every router reached without the prefix; `/health` only at the root; docs at the root; document `servers` with the `/health` override; the server-aware coverage test; and a module-test migration that only changes URLs.

**Issues found**: none. G1 from iteration 1 is closed.

**Lessons**: iteration 1 recorded G1 under L-001, which was then promoted to confirmed. This iteration is a clean PASS, so no new lesson was recorded.
