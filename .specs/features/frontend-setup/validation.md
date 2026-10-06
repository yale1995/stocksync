# Frontend Setup Validation

## Validation: frontend-setup - PASS (iteration 1)

**Date**: 2026-10-06
**Spec**: `.specs/features/frontend-setup/spec.md` (FSET-01..FSET-13 + 2 edge cases); source of truth `docs/prompts/06-frontend.md`; rules `CLAUDE.md`
**Diff range**: uncommitted working tree on `feat/frontend-setup` vs `main` (`apps/frontend/**` new, `biome.json`, `.gitignore`, `pnpm-lock.yaml` modified; `.impeccable/`, `PRODUCT.md`, `docs/` ignored as user-owned)
**Verifier**: independent sub-agent (author != verifier)
**Iteration**: 1 of max 3 (iteration 0 failed on G1, closed by a test-only change in `T`)

## Iteration 1 (re-verification)

**Date**: 2026-10-06. **Verdict**: PASS. `CL` is unchanged (SHA-1 `6b509bb5`); only `T` changed.

- **G1 closed**: `T:154-175` is an `it.each` over 403 `FORBIDDEN`, 409 `CONFLICT` and 500 `INTERNAL_SERVER_ERROR` that registers a handler and asserts `T:171` `expect(onUnauthorized).not.toHaveBeenCalled()`, `T:172` `expect(error.status).toBe(status)` and `T:173` `expect(error.code).toBe(code)`. FSET-11 is now fully discriminated.
- **Gate** (repo root, exit 0): typecheck 3/3 tasks; frontend tests 1 file, **13 passed**, 0 failed, 0 skipped (10 + 3 new cases); biome "Checked 106 files. No fixes applied."; vite build succeeded.
- **Sensor** (fresh scratch copy, `node_modules` symlinked, unmutated copy passed 13/13, scratch deleted afterwards):

| # | File:line | Mutant | Iteration 1 |
| - | --------- | ------ | ----------- |
| M6 | `CL:54` | handler on any status >= 400 except login | **killed** (`T:154`, 403, 409 and 500 cases) |
| M6b | `CL:54` | handler on any status != 200 except login | killed (`T:154`) |
| M1 | `CL:53` | login exemption dropped | killed (`T:177`) |
| M2 | `CL:45` | `Content-Type` dropped | killed (`T:20`) |
| M3 | `CL:57` | 204 returns the parsed body | killed (`T:57`) |
| M4 | `CL:49` | network status 0 -> 500 | killed (`T:121`) |
| M5 | `CL:54` | handler call replaced by a no-op | killed (`T:133`) |
| M7 | `CL:45` | extra headers not merged | killed (`T:20`) |
| M8 | `CL:66` | fallback code changed | killed (`T:97`) |
| M9 | `CL:64` | API message replaced | killed (`T:70`, `T:177`) |
| M10 | `CL:3` | base `/api/v1` -> `/api` | killed (all request tests) |

**Sensor**: 11/11 killed (M11, the equivalent `GET /auth/login` mutant, not re-run: unreachable behavior, see iteration 0).
**Isolation**: `git status --porcelain` identical before and after the sensor (including ` M .specs/STATE.md`, the orchestrator's AD-025..027 entry); `CL` SHA-1 unchanged; only this `validation.md` was written.

---

## Iteration 0 (history)


All 13 ACs and both edge cases are implemented and asserted on the spec's exact values, and the gate is green. The verdict is FAIL for one reason: the sensor found a surviving mutant on the highest-risk branch (FSET-11 "401 only"). No test shows that a non-401 error leaves the unauthorized handler alone, so a client that logs the user out on a 403 or 409 passes (G1). Test-only fix.

`CL` = `apps/frontend/src/api/client.ts`, `T` = `apps/frontend/src/api/client.test.ts`, `TY` = `apps/frontend/src/api/types.ts`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Vite + React package | Done | `apps/frontend/vite.config.ts`, `package.json:6-12`; uncommitted by project override (tasks.md) |
| T2 Tailwind and shadcn/ui base | Done | build emits `dist/assets/index-*.css` (10.65 kB); `components.json`, `src/lib/utils.ts` present |
| T3 Repo wiring | Done | `biome.json:13` ignores `apps/frontend/src/routeTree.gen.ts` |
| T4 Test harness | Done | `apps/frontend/src/test/setup.ts:8-31`, `server.ts`, `render.tsx` |
| T5 API client and types | Done | `CL:1-82`, `TY:1-76`, `T:19-198` |

---

## Spec-Anchored Acceptance Criteria

Config-level ACs (FSET-01..04, FSET-13) are build-gate / inspection only per the Test Coverage Matrix in tasks.md; they are verified by file:line inspection, not by tests.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| FSET-01 scripts | `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck` defined | `apps/frontend/package.json:6-12` (all six keys); gate ran `typecheck`, `test`, `build` through them | PASS (inspection) |
| FSET-02 `/api` proxy | requests under `/api` go to `http://localhost:3333` | `apps/frontend/vite.config.ts:22` `proxy: { "/api": "http://localhost:3333" }`; live `curl -i http://localhost:5173/api/v1/auth/me` returned `401` with `x-powered-by: Express` and body `{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}` | PASS (inspection + live) |
| FSET-03 router | file-based routes in `src/routes/`, context `{ queryClient }` | `apps/frontend/vite.config.ts:11` `tanstackRouter(...)`; `apps/frontend/src/router.tsx:12` `context: { queryClient }`; `src/routes/__root.tsx`; build generated `src/routeTree.gen.ts` | PASS (inspection) |
| FSET-04 lint ignores generated tree | `pnpm lint:check` ignores `routeTree.gen.ts` | `biome.json:13` `"!apps/frontend/src/routeTree.gen.ts"`; `pnpm lint:check` clean with the file present ("Checked 106 files") | PASS (inspection + gate) |
| FSET-05 request shape | `/api/v1` + path, JSON body, `Content-Type: application/json` | `T:37` `pathname` `toBe("/api/v1/sales")`; `T:38` method `"POST"`; `T:39` `Content-Type` `toBe("application/json")`; `T:41` `receivedBody` `toEqual({ items: [{ productId: "p1", quantity: 2 }] })` | PASS |
| FSET-06 2xx JSON | resolves with the parsed body | `T:51-54` `resolves.toEqual({ id: "p1", sku: "ABC-1" })` | PASS |
| FSET-07 204 | resolves `undefined` | `T:65-67` `resolves.toBeUndefined()` | PASS |
| FSET-08 API error shape | `ApiError` with status, `code`, `message` from the body | `T:90` `status` `toBe(409)`; `T:91` `code` `toBe("CONFLICT")`; `T:92-94` `message` `toBe("Insufficient stock for ABC-1 (available: 1, requested: 3)")` (`catchApiError` also asserts `toBeInstanceOf(ApiError)`, `T:15`) | PASS |
| FSET-09 non-API error body | status kept, `UNKNOWN_ERROR`, "Something went wrong. Please try again." | `T:115-117` `status` `toBe(502/500)`, `code` `toBe("UNKNOWN_ERROR")`, `message` `toBe("Something went wrong. Please try again.")`, for a non-JSON body and for JSON without the `error` shape (`T:97-107`) | PASS |
| FSET-10 network error | status `0`, `NETWORK_ERROR`, "Could not reach the server. Check your connection and try again." | `T:126` `toBe(0)`; `T:127` `toBe("NETWORK_ERROR")`; `T:128-130` message `toBe(...)` | PASS |
| FSET-11 401 calls handler once, still throws | handler called once; `ApiError` thrown | `T:149` `expect(onUnauthorized).toHaveBeenCalledTimes(1)`; `T:150-151` `status` `toBe(401)`, `code` `toBe("UNAUTHORIZED")` | PASS on value; the "401 only" scope is not discriminated (G1, M6) |
| FSET-12 login 401 exempt | handler not called | `T:178` `expect(onUnauthorized).not.toHaveBeenCalled()`; `T:179` message `toBe("Invalid email or password")` | PASS (M1 killed) |
| FSET-13 hand-written types | `CurrentUser`, `Product`, `Page<T>`, `Sale`, `SyncStatus`, `ErrorCode` | `TY:15`, `TY:27`, `TY:22`, `TY:45`, `TY:69`, `TY:1`; compared by hand with backend schemas: `CurrentUser` role/tenant vs `apps/backend/src/http/controllers/auth.validation.ts:13-14`, `Product` fields vs `products.validation.ts:60-63` | PASS (inspection) |

**Status**: all ACs covered on exact values; 0 spec-precision gaps (each AC defines an exact outcome). One discrimination gap on FSET-11 (G1).

---

## Edge Cases

- [x] 401 with no handler registered still throws the `ApiError`: `T:182-197`, `T:196` `expect(error.status).toBe(401)` (via `catchApiError`, `T:15`)
- [x] Extra headers sent alongside `Content-Type`: `T:40` `expect(received?.headers.get("Idempotency-Key")).toBe("key-1")` together with `T:39`

---

## Discrimination Sensor

Isolation: `src`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` and `components.json` of `apps/frontend` copied to the session scratchpad with `node_modules` symlinked; the unmutated copy passed first (10/10). Each mutant is an exact single-occurrence replacement of `CL`, run with `vitest run`, then `CL` was re-copied from the real tree for the next mutant. The scratch was deleted afterwards. The real tree was never edited.

| # | File:line | Mutant | Result |
| - | --------- | ------ | ------ |
| M1 | `CL:53` | login exemption dropped (`isLogin = false`) | killed (`T:154`) |
| M2 | `CL:45` | `Content-Type` header dropped | killed (`T:20`) |
| M3 | `CL:57` | 204 returns the parsed body instead of `undefined` | killed (`T:57`) |
| M4 | `CL:49` | network error status `0` -> `500` | killed (`T:121`) |
| M5 | `CL:54` | unauthorized handler call replaced by a no-op | killed (`T:133`; first attempt with an empty replacement was an invalid mutant that swallowed the next `if`, redone as `void 0`) |
| **M6** | `CL:54` | handler called on any status >= 400 except login | **survived** (G1) |
| M7 | `CL:45` | extra `headers` not merged | killed (`T:20`) |
| M8 | `CL:66` | fallback code `UNKNOWN_ERROR` -> `INTERNAL_SERVER_ERROR` | killed (`T:97`) |
| M9 | `CL:64` | API `message` replaced by the generic message | killed (`T:70`, `T:154`) |
| M10 | `CL:3` | base `/api/v1` -> `/api` | killed (all request tests) |
| M11 | `CL:53` | login exemption applies to any method (`GET /auth/login` too) | survived (equivalent in practice, see below) |

**Sensor depth**: lightweight-plus (11 mutants; the client is the one behavioral unit and carries the session-expiry path)
**Result (iteration 0)**: 9/11 killed, 2 survived (M6 is a gap, M11 is non-blocking); M6 killed in iteration 1

M11: the spec only defines `POST /auth/login` as exempt; the API has no `GET /auth/login`, so the survivor changes no reachable behavior. Not a fix task.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (client 82 lines, no extra abstractions) | PASS |
| Surgical changes (only `biome.json` ignore + Tailwind `css.parser` setting, `.gitignore` for `.impeccable` local state) | PASS |
| No scope creep (no screens, no shadcn components, per Out of Scope) | PASS |
| Matches patterns (co-located `*.test.ts`, `describe`/`it`, double quotes via biome) | PASS |
| Spec-anchored outcome check (asserted values match spec strings and codes verbatim) | PASS |
| Per-layer coverage (client: every AC and both edge cases have a test) | PASS |
| Every test maps to a spec requirement (`T:20` FSET-05 + edge 2, `T:44` FSET-06, `T:57` FSET-07, `T:70` FSET-08, `T:97` FSET-09, `T:121` FSET-10, `T:133` FSET-11, `T:154` FSET-12, `T:182` edge 1) | PASS |
| Documented guidelines followed: `CLAUDE.md` (comments only for the *why*: `CL:52`, `vite.config.ts:9,19`); no frontend testing rules exist | PASS |
| Discrimination sensor | FAIL (M6 survived) |

---

## Gate Check

- **Gate command**: `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` (repo root)
- **Result**: exit 0. Typecheck 3/3 tasks (ads-mock, frontend, backend; 2 cached); frontend tests 1 file, **10 passed**, 0 failed, 0 skipped; biome "Checked 106 files. No fixes applied."; vite build 151 modules transformed, `dist/` emitted
- **Test count before feature**: 0 (the frontend package had no tests)
- **Test count after feature**: 10
- **Delta**: +10
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

### G1 (Minor, test-only): "401 only" not discriminated (FSET-11; M6)

- **Root cause**: `T:133-152` only exercises a 401, so a client that also calls the handler for other error statuses (403, 409, 500) passes. That would log the user out on a stock conflict or a forbidden action.
- **Fix task**: in `T`, add a test (or `it.each`) that registers a handler, answers 403 and 409 (and 500) with the API error shape, and asserts `expect(onUnauthorized).not.toHaveBeenCalled()` while the `ApiError` is still thrown with the response status. Done when M6 fails and M1, M5 still fail.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| FSET-01 | Implemented | Verified |
| FSET-02 | Implemented | Verified |
| FSET-03 | Implemented | Verified |
| FSET-04 | Implemented | Verified |
| FSET-05 | Implemented | Verified |
| FSET-06 | Implemented | Verified |
| FSET-07 | Implemented | Verified |
| FSET-08 | Implemented | Verified |
| FSET-09 | Implemented | Verified |
| FSET-10 | Implemented | Verified |
| FSET-11 | Implemented | Verified (iteration 1, G1 closed) |
| FSET-12 | Implemented | Verified |
| FSET-13 | Implemented | Verified |

---

## Isolation

`git status --porcelain` before the sensor (captured at start) and after differ in one entry only: ` M .specs/STATE.md`, which appeared while this run was in progress and is not a file this Verifier touched (no write to it from the sensor, which only used the scratchpad copy). The `apps/frontend` entries are identical. Scratch copy deleted. Only this `validation.md` was written by the Verifier.

---

## Summary

**Overall**: Ready (iteration 1; iteration 0 was FAIL on G1)

**Spec-anchored check**: 13/13 ACs and 2/2 edge cases matched the spec outcome; 0 spec-precision gaps
**Sensor**: 11/11 killed in iteration 1 (iteration 0: 9/11)
**Gate**: 13 frontend tests passed (iteration 1); typecheck, biome and build clean

**What works**: proxy (live 401 from Express through Vite), router context, biome ignore, request shape, parsed body, 204, API and generic errors, network error, handler once on 401, login exemption, edge cases, hand-written types matching the backend schemas.

**Issues found**: none open (G1 closed in iteration 1).

**Next steps**: none for verification.
