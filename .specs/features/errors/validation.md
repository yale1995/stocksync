# Errors Validation

## Validation: errors - PASS

**Date**: 2026-10-03
**Spec**: `.specs/features/errors/spec.md`
**Diff range**: uncommitted working tree vs HEAD 99d3d9d (`apps/backend/src/http/errors.ts`, `apps/backend/src/http/errors.test.ts`, `apps/backend/src/http/error-handler.ts`, `apps/backend/src/http/error-handler.test.ts`, `apps/backend/src/app.ts`, `apps/backend/src/modules/health/health.routes.ts`, `apps/backend/src/modules/health/health.test.ts`, `biome.json`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: re-verification after fix iteration 1. Iteration 0 failed on ERR-02 coverage and on the surviving mutants M3, M5, M6 and M7.

The production code (`errors.ts`, `error-handler.ts`, `app.ts`, `health.routes.ts`) is unchanged since iteration 0. It still matches `docs/prompts/01-errors-auth-multitenancy.md` line for line. Fix iteration 1 added tests only, plus a `biome.json` exclusion for `.specs`.

---

## Task Completion

There is no `tasks.md` for this feature, so the Tasks phase was skipped. Every deliverable listed in the prompt is present. Both fix tasks from iteration 0 are done:

| Fix | Status | Evidence |
| --- | ------ | -------- |
| Fix 1: cover all six classes | ✅ Done | `apps/backend/src/http/errors.test.ts:12-54` |
| Fix 2: prove `createApp()` registers the handler | ✅ Done | `apps/backend/src/http/error-handler.test.ts:118-133` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ERR-01: AppError subclass thrown → its status + `{ error: { code, message } }` | status, code and message of the thrown error | `apps/backend/src/http/error-handler.test.ts:55` - `expect(response.status).toBe(404)`; `:56` - `toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } })` | ✅ PASS |
| ERR-02: six classes with status, code and an overridable default message | 400/`VALIDATION_ERROR`, 401/`UNAUTHORIZED`, 403/`FORBIDDEN`, 404/`NOT_FOUND`, 409/`CONFLICT`, 500/`INTERNAL_SERVER_ERROR` | `apps/backend/src/http/errors.test.ts:13-33` (table rows), with `:39` - `expect(error.status).toBe(status)`, `:40` - `expect(error.code).toBe(code)`, `:41` - `expect(error.message).toBe(message)`; override for every class at `:45-53` - `expect(new ErrorClass("custom").message).toBe("custom")` | ✅ PASS |
| ERR-03: Zod failure → 400 `VALIDATION_ERROR`, issues as `path: message` joined by `; ` | exact joined string | `error-handler.test.ts:75` - `toBe(400)`; `:76-82` - `toEqual({ error: { code: "VALIDATION_ERROR", message: "name: Invalid input: expected string, received number; price.amount: Invalid input: expected number, received string" } })` | ✅ PASS |
| ERR-04: non-AppError → 500 generic body, no stack or original message | `{ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } }` | `error-handler.test.ts:90` - `toBe(500)`; `:91-96` - exact `toEqual`; `:97` - `expect(response.text).not.toContain("boom")`. The same body is checked on the real app at `:126-132` | ✅ PASS |
| ERR-05: async route rejection → same handler | handler's JSON shape | `error-handler.test.ts:103-109` - async route gets 409 + exact body | ✅ PASS |
| ERR-06: `GET /health` → 200 `{ status: "ok" }` from `modules/health/` | 200 `{ status: "ok" }` | `apps/backend/src/modules/health/health.test.ts:9` - `toBe(200)`; `:10` - `toEqual({ status: "ok" })` | ✅ PASS |
| Edge: custom message replaces the default | custom message returned | `errors.test.ts:45-53` (all six classes); `error-handler.test.ts:64-67` (end to end, ConflictError) | ✅ PASS |
| Wiring: handler registered in `createApp()` (prompt: "Register it last in `createApp()`") | real app returns the handler's JSON body | `error-handler.test.ts:126` - `toBe(500)`; `:127-132` - `toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } })` | ✅ PASS |

**Status**: ✅ All ACs covered. No spec-precision gaps.

---

## Discrimination Sensor

The sensor ran in a fresh scratch `git worktree` (detached at 99d3d9d) with the uncommitted files copied in and `node_modules` symlinked. Before mutating, the scratch baseline passed 19/19. The scratch was removed afterwards (`git worktree remove --force` and `git worktree prune`). `git status --porcelain` on the real tree matched the pre-sensor baseline exactly.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M3 | `apps/backend/src/app.ts:11` | removed `app.use(errorHandler)` | ✅ Killed (survived in iteration 0) |
| M5 | `apps/backend/src/http/errors.ts:23` | UnauthorizedError status 401 → 403 | ✅ Killed (survived in iteration 0) |
| M6 | `apps/backend/src/http/errors.ts:29` | ForbiddenError code → `FORBIDDEN_ERROR` | ✅ Killed (survived in iteration 0) |
| M7 | `apps/backend/src/http/errors.ts:16` | ValidationError default → `"Bad request"` | ✅ Killed (survived in iteration 0) |
| M1 | `apps/backend/src/http/error-handler.ts:13` | `new InternalServerError(err.message)` leaks the original message | ✅ Killed |
| M2 | `apps/backend/src/http/errors.ts:54` | `.join("; ")` → `.join(",")` | ✅ Killed |
| M8 | `apps/backend/src/http/errors.ts:41` | ConflictError ignores the caller's message | ✅ Killed |
| M11 | `apps/backend/src/http/errors.ts:52` | keeps only the first Zod issue | ✅ Killed |
| M14 | `apps/backend/src/http/error-handler.ts:7` | AppError branch always sends 500 | ✅ Killed |
| M15 | `apps/backend/src/http/errors.ts:23` | UnauthorizedError ignores the caller's message | ✅ Killed |
| M17 | `apps/backend/src/http/error-handler.ts:16` | unknown-error body returns `err.message` | ✅ Killed |
| M16 | `apps/backend/src/app.ts:9-11` | `errorHandler` registered before `/health` instead of last | ⚪ Equivalent (survived, not a test gap; see the note below) |

Note on M16: the mutant has no observable effect yet. `express.json()` still runs before the handler, so body-parser errors still reach it. `healthRouter` cannot throw. Moving the handler therefore changes no response today. The ordering starts to matter once a route that can throw is mounted in `createApp()`. At that point, that route's own tests going through `createApp()` will cover it.

**Sensor depth**: lightweight-plus (12 manual mutations, including all 4 that survived in iteration 0)
**Result**: 11/11 non-equivalent mutants killed - PASS

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Production code matches the prompt verbatim |
| Surgical changes | ✅ Fix iteration touched only tests and one `biome.json` line |
| No scope creep | ✅ The `biome.json` exclusion of `.specs` is outside the feature's spec. It is justified because the files there are machine-owned (`lessons.json` is generated by a script), and it does not affect app code |
| Matches patterns | ✅ Colocated `*.test.ts`, matching the CLAUDE.md layout. Biome is clean. No comments that restate code |
| Spec-anchored outcome check | ✅ Every assertion targets the exact spec value |
| Per-layer coverage | ✅ All six classes covered 1:1. The handler is covered on the happy, error, validation and async paths, and on the real app |
| Every test maps to a requirement | ✅ All 19 tests map to ERR-01..06, the edge case, or the createApp wiring fix |
| Documented guidelines followed | ✅ `CLAUDE.md`, `docs/prompts/01-errors-auth-multitenancy.md` |

---

## Edge Cases

- [x] Custom message overrides the default. Covered for all six classes at `errors.test.ts:45-53`, and end to end at `error-handler.test.ts:64-67`.

---

## Gate Check

- **Gate command**: `pnpm --filter stocksync-api test`, then `pnpm lint:check`, then `tsc --noEmit` (in `apps/backend`)
- Tests: 19 passed, 0 failed, 0 skipped, in 3 files
- Lint: Biome checked 19 files, no issues
- Typecheck: 1 error, `drizzle.config.ts(8,29)` TS2345 (`dbCredentials.url` is `string | undefined`). This error already exists and fails the same way on clean HEAD. It is not caused by this feature and does not affect the verdict. The spec's success criterion "typecheck ... pass" stays open until it is fixed separately.
- **Test count before feature**: 1
- **Test count after feature**: 19
- **Delta**: +18. No tests were removed or weakened.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| ERR-01 | Pending | ✅ Verified |
| ERR-02 | Needs Fix | ✅ Verified |
| ERR-03 | Pending | ✅ Verified |
| ERR-04 | Pending | ✅ Verified |
| ERR-05 | Pending | ✅ Verified |
| ERR-06 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 6/6 ACs match the spec outcome. No spec-precision gaps.
**Sensor**: 11/11 non-equivalent mutants killed. One equivalent mutant (M16, handler ordering) is documented above.
**Gate**: 19 tests passed, lint clean. The only typecheck error is the drizzle.config.ts issue already on HEAD.

**Follow-ups, not blocking**: fix the `drizzle.config.ts` typecheck error already on HEAD. Once a route that can throw is mounted in `createApp()`, test that route's error responses through `createApp()` so the handler ordering is covered.
