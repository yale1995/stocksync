# Logging Validation

## Validation: logging - PASS

**Verdict (iteration 4, new round on the dev-output delta)**: PASS. Iteration 3's blocking gap is closed: removing the `err` serializer from the shared `loggerOptions` (M30) now fails `apps/backend/src/infra/logger.test.ts:116`. The minor pretty-options gaps (M39 hidden keys, M40 single line) fail `apps/backend/src/infra/logger.test.ts:65`. All 15 ACs and the Assumptions rows "Dev output", "Access line message" and "Logged errors" are asserted. Gate: backend 570 tests, ads mock 46, 0 failed. Still open: M41/M26b (root-logger wiring, optional by coordinator decision) and M45 (`aborted` label, covered by the accepted client-abort gap).

### Iteration 4

**Diff range**: `2d3cf37` + the uncommitted delta (`git diff HEAD -- apps` plus the untracked `apps/backend/src/infra/pretty.ts`, `apps/ads-mock/src/pretty.ts`, `apps/ads-mock/src/pretty.test.ts`). Product code is byte-identical to iteration 3; only `apps/backend/src/infra/logger.test.ts` changed.
**Gate**: backend 22 files, 570 passed; ads mock 3 files, 46 passed; 0 failed, 0 skipped. The Postgres container had stopped; I started it with `pnpm --filter stocksync-api db:up` and discarded the first sensor run, which failed on `ECONNREFUSED`.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| "Logged errors", non-HTTP path (`loggerOptions`) | `err` reduced to `{ type, message, stack }` | `apps/backend/src/infra/logger.test.ts:125-130` - an `Error` with `body`/`detail` logged through `createMemoryLogger()`; `err toEqual({ type: "Error", message: "boom", stack: any(String) })`, raw `not.toContain("secret")` | ✅ PASS |
| "Dev output", single line and hidden keys | `singleLine`; `ignore` `pid,hostname,req,res,responseTime,component,tenantId,batchId` | `apps/backend/src/infra/logger.test.ts:66-76` - `singleLine toBe(true)`; `ignore.split(",") toEqual([...8 keys])` (config-level, not rendered output; enough to pin the spec list) | ✅ PASS |

**Sensor (iteration 4)**: this ran in a detached worktree at `2d3cf37` with the current delta applied and the untracked files copied in, using `pnpm install --offline` and a symlinked `.env`. The delta was confirmed identical to the real tree before and after the run. Afterwards the worktree was removed, and the real tree's `git status --porcelain` matched its baseline.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M30 | `apps/backend/src/infra/logger.ts:15` | `loggerOptions` without `serializers.err` | ✅ Killed (`logger.test.ts:116`) |
| M39 | `apps/backend/src/infra/pretty.ts:27` | `req` dropped from `ignore` | ✅ Killed (`logger.test.ts:65`) |
| M40 | `apps/backend/src/infra/pretty.ts:24` | `singleLine: false` | ✅ Killed (`logger.test.ts:65`) |
| M32 (control) | `apps/backend/src/infra/logger.ts:7` | `serializeError` keeps every property | ✅ Killed (`logger.test.ts:116`, `http-logger.test.ts:229`) |

**Iteration 4 outcome**: 4/4 killed. Open, non-blocking: M41/M26b (optional), M45 (accepted client-abort gap).

**Traceability (iteration 4)**: LOG-07 changed from Needs Fix back to Verified in `spec.md`; all 15 are now Verified.

---

### Iteration 3 (compact dev output, access message, `err` reduction) - failed, closed by iteration 4

**Verdict (iteration 3)**: failed. The dev-output delta works, and so does the fix that keeps the request body out of the HTTP 500 line. One security gap remains untested: the `err` serializer in the shared `loggerOptions`. That serializer is the only thing reducing errors logged outside pino-http: `health check failed` and the worker's `tick failed`. Mutant M30 removes it from `loggerOptions` (`apps/backend/src/infra/logger.ts:15`) and every test still passes. The fix is one test.

**Diff range**: `2d3cf37` + the uncommitted delta (`git diff HEAD -- apps` plus the untracked `apps/backend/src/infra/pretty.ts`, `apps/ads-mock/src/pretty.ts`, `apps/ads-mock/src/pretty.test.ts`). Spec Assumptions rows: "Dev output", "Access line message", "Logged errors".
**Gate**: backend 22 files, 568 passed; ads mock 3 files, 46 passed; 0 failed, 0 skipped.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| LOG-07 / "Logged errors", HTTP path | a body-parser error's raw body never logged; `err` is exactly `{ type, message, stack }` | `apps/backend/src/http/middlewares/http-logger.test.ts:229-245` - raw `not.toContain(PASSWORD)`; `err toEqual({ type: "SyntaxError", message: any(String), stack: any(String) })` | ✅ PASS |
| "Logged errors", non-HTTP path (`loggerOptions`, used by `health check failed` and `tick failed`) | `err` reduced to `{ type, message, stack }` | no test; M30 survives | ❌ GAP |
| "Access line message" | `<METHOD> <originalUrl> <status>` on the success and error paths, both apps | `http-logger.test.ts:135` - `msg: "GET /api/v1/products?page=1 200"` (the original URL, kills M38); `http-logger.test.ts:221` - `msg: "POST /health 500"`; `apps/ads-mock/src/app.test.ts:469` - `msg: "POST /updates 200"` | ✅ PASS |
| "Access line message", `aborted` | `aborted` when the client aborts | no test (M45 survives); covered by the accepted client-abort gap | ⚠️ Accepted gap |
| "Dev output", `formatMessage` | `[<8 chars of req.id or batchId>] <msg> <responseTime>ms`; a line without an id is unchanged | `apps/backend/src/infra/logger.test.ts:53` - `"[09894ae7] GET /api/v1/products 200 12ms"`; `:62` - `"[5f2c9a1e] batch sent"`; `:65-69` no id; `apps/ads-mock/src/pretty.test.ts:21` | ✅ PASS |
| "Dev output", only in development | pretty stream only for `development` | `apps/backend/src/infra/logger.test.ts:37-41`, `apps/ads-mock/src/pretty.test.ts:5-9` - defined for `development`, `undefined` for `test`/`production` | ✅ PASS (the root-logger wiring is still unasserted, M41 = M26b) |
| "Dev output", single line, hidden keys | `singleLine`, `ignore` `pid,hostname,req,res,responseTime,component,tenantId,batchId` | no assertion on `prettyOptions` (M39, M40 survive) | ⚠️ Spec-precision gap (minor, dev-only cosmetics) |

**Sensor (iteration 3)**: this ran in a detached worktree at `2d3cf37` with the delta patch applied and the untracked files copied in, using `pnpm install --offline` and a symlinked `.env`. Each mutant was restored by rewriting the file, and the delta was confirmed intact against the real tree's `git diff HEAD -- apps`. Afterwards the worktree was removed, and the real tree's `git status --porcelain` matched its baseline.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M29 | `apps/backend/src/http/middlewares/http-logger.ts:69` | pino-http without `err: serializeError` | ⚪ Survived, redundant: the `loggerOptions` serializer on the same logger still applies |
| M29+M30 | both | both `err` serializers removed | ✅ Killed (`http-logger.test.ts:229`) |
| M30 | `apps/backend/src/infra/logger.ts:15` | `loggerOptions` without `serializers.err` | ❌ Survived (HTTP is still covered by M29's copy; non-HTTP `err` lines are not reduced) |
| M31 | `apps/backend/src/http/middlewares/http-logger.ts:65` | `wrapSerializers: true` | ✅ Killed |
| M32 | `apps/backend/src/infra/logger.ts:7` | `serializeError` returns the full std serialization | ✅ Killed |
| M33 | `apps/backend/src/infra/pretty.ts:5` | short id 9 chars | ✅ Killed |
| M34 | `apps/backend/src/infra/pretty.ts:18` | no `ms` suffix | ✅ Killed |
| M35 | `apps/backend/src/infra/pretty.ts:14` | `batchId` ignored | ✅ Killed |
| M36 | `apps/backend/src/http/middlewares/http-logger.ts:61` | `customSuccessMessage` removed | ✅ Killed |
| M37 | `apps/backend/src/http/middlewares/http-logger.ts:62` | `customErrorMessage` removed | ✅ Killed |
| M38 | `apps/backend/src/http/middlewares/http-logger.ts:34` | message uses `req.url` instead of `originalUrl` | ✅ Killed |
| M39 | `apps/backend/src/infra/pretty.ts:27` | `req` dropped from `ignore` | ⚠️ Survived (minor) |
| M40 | `apps/backend/src/infra/pretty.ts:24` | `singleLine: false` | ⚠️ Survived (minor) |
| M41 | `apps/backend/src/infra/logger.ts:24` | root logger always pretty (wiring) | ⚠️ Survived (same as M26b, known follow-up) |
| M42 | `apps/ads-mock/src/pretty.ts:37` | mock pretty outside production only | ✅ Killed (closes iteration 2's M28) |
| M43 | `apps/ads-mock/src/logger.ts:47` | mock `customSuccessMessage` removed | ✅ Killed |
| M44 | `apps/ads-mock/src/pretty.ts:18` | mock no `ms` suffix | ✅ Killed |
| M45 | `apps/backend/src/http/middlewares/http-logger.ts:33` | `aborted` label removed | ⚠️ Survived (accepted client-abort gap) |

**Iteration 3 outcome**: 13 of 18 killed (counting M29+M30 as one), 1 redundant, 1 blocking survivor (M30), 4 minor survivors.

**Fix 4 (Major, blocking)**: in `apps/backend/src/infra/logger.test.ts`, use `createMemoryLogger()` (which applies `loggerOptions`). Call `logger.error({ err: Object.assign(new Error("boom"), { body: "secret-body", detail: "secret-detail" }) }, "x")`, then assert that the line's `err` `toEqual({ type: "Error", message: "boom", stack: any(String) })` and that the raw output does not contain `secret`. Done when M30 is killed.

**Optional (minor)**: assert `prettyOptions` includes `singleLine: true` and the `ignore` list, or render one line through `prettyDestination("development")` into a buffer and check it is one line without `pid`/`hostname` (M39, M40). The root-logger wiring is M41/M26b.

**Traceability (iteration 3)**: LOG-07 changed from Verified to Needs Fix in `spec.md`, because the `err` reduction outside HTTP is untested. The other 14 requirements stay Verified.

**Observation**: the ads mock has no `err` serializer. Today it never logs an `err`: parse failures become a 400 in `invalidJson`, and Express's final handler does not set `res.err`. So nothing leaks now. If the mock ever starts logging errors, it should reuse `serializeError`.

---

### Iteration 2 verdict: passed

 All 15 ACs (LOG-01..LOG-15) are asserted on the spec-defined values. Iteration 1 found 4 survivors (M10, M24, M25, M26). Fix iteration 1 added tests, and the re-run sensor kills all of them, plus a new cookie-redact mutant and the mock's redact mutant. Gate: backend 564 tests, ads mock 44, 0 failed. Two minor survivors remain (M26b, M28). Both affect only how `NODE_ENV` reaches the `pino-pretty` transport at an entrypoint (`apps/backend/src/infra/logger.ts:24`, `apps/ads-mock/src/server.ts:10`). The decision itself is tested (`apps/backend/src/infra/logger.test.ts:37-41`), so they do not block. They are listed as optional follow-ups. The client-abort edge case is an accepted gap, because pino-http provides that behaviour.

Iteration 1 (`0b319bc..a40da1a`) failed; its findings are kept below under "Iteration 1".

**Date**: 2026-10-06
**Spec**: `.specs/features/logging/spec.md` (LOG-01..LOG-15, 2 edge cases, Assumptions table); source prompt `docs/prompts/07-logging.md`
**Diff range**: `0b319bc..HEAD` (`e6fbe41 feat(api): add structured logs with a request id`, `f13f27e feat(ads-mock): add structured logs`; rebuilt after fix iteration 1, which changed `infra/env.ts`, `infra/logger.ts`, `health-unavailable.test.ts` and added `infra/logger.test.ts`, `ads-mock/src/logger.test.ts`; iteration 1 ran on `b4ae2ee`, `a40da1a`). Uncommitted `.specs/` and `docs/` changes are out of the code scope.
**Verifier**: independent sub-agent (author != verifier)

Paths: `LT` = `apps/backend/src/infra/logger.test.ts`, `MLT` = `apps/ads-mock/src/logger.test.ts`, `HLT` = `apps/backend/src/http/middlewares/http-logger.test.ts`, `SWT` = `apps/backend/src/modules/sync/sync.worker.test.ts`, `ACT` = `apps/backend/src/modules/sync/ads-client.test.ts`, `HUT` = `apps/backend/src/modules/health/health-unavailable.test.ts`, `MAT` = `apps/ads-mock/src/app.test.ts`.

**Full-path evidence**: `apps/backend/src/modules/health/health-unavailable.test.ts:124` (LOG-05 503), `apps/backend/src/infra/logger.test.ts:17` (LOG-09), `apps/backend/src/http/middlewares/http-logger.test.ts:62` (LOG-01), `apps/backend/src/http/middlewares/http-logger.test.ts:218` (LOG-06), `apps/backend/src/modules/sync/sync.worker.test.ts:677` (LOG-10), `apps/ads-mock/src/app.test.ts:473` (LOG-14).

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | Done | Logger module and `LOG_LEVEL`; no test (see LOG-09 gap) |
| T2 | Done | `http-logger.ts`, first middleware, `exposedHeaders`, `res.err` |
| T3 | Done | `HLT` (21 tests), `error-handler.test.ts` drops console spies |
| T4 | Done | `health.service.ts` logs through `logger.error` |
| T5 | Done | `sendUpdates(..., requestId)` sends `X-Request-Id` |
| T6 | Done | Worker lines, `batchId`, `tick failed` |
| T7 | Done | Mock logger, outcome line, tests |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| LOG-01 no incoming id | `X-Request-Id` is a generated UUID | `HLT:62` - `expect(response.headers["x-request-id"]).toMatch(UUID)` (v4 regex) | ✅ PASS |
| LOG-02 valid id echoed | echoed unchanged, incl. 128 chars | `HLT:75` - `toBe(id)` for `abc-123`, `trace.ID_9`, `"a".repeat(128)` | ✅ PASS |
| LOG-02 invalid id replaced | too long (129), spaces, newline, other chars, empty → UUID | `HLT:91` - `toMatch(UUID)` (table at `HLT:80-86`); newline at `HLT:103-104` on `genReqId` directly (Node refuses to send a newline header) | ✅ PASS |
| LOG-03 CORS expose | `Access-Control-Expose-Headers` contains `X-Request-Id` | `HLT:115` - `toContain("X-Request-Id")` | ✅ PASS |
| LOG-04 access line, authenticated | request id, `method`, `url`, `statusCode`, `responseTime`, `tenantId`, `userId`, `role` | `HLT:133-145` - `toMatchObject({ level: info, req: { id, method: "GET", url }, res: { statusCode: 200 }, tenantId, userId, role: "admin" })`, `responseTime: any(Number)`; ids compared to the DB user | ✅ PASS |
| LOG-04 401 line | no auth fields | `HLT:158-160` - `not.toHaveProperty("tenantId"/"userId"/"role")` | ✅ PASS |
| LOG-05 levels | 2xx `info`, 4xx `warn`, 5xx `error`, successful `/health` `debug`; a 503 from `/health` still `error` (Assumptions) | `HLT:191` - `expect(line.level).toBe(LEVELS[level])` over 200/401/404/`/health`/`/health?x=1`/500 (`HLT:163-176`). 503: `HUT:109-127` - `ping` rejects, `response.status === 503`, access line `toMatchObject({ level: LEVELS.error, res: { statusCode: 503 } })` (iteration 2; kills M24) | ✅ PASS |
| LOG-06 unexpected error | generic 500 envelope, no request id in body, exactly one `error` line with request id and stack | `HLT:208-222` - `toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } })`, `response.text not.toContain(id)`, `errorLines toHaveLength(1)`, `err.stack` contains `SyntaxError` | ✅ PASS |
| LOG-07 no secrets | no body, headers, cookie value, password, `Set-Cookie` | `HLT:240-245` - raw log `not.toContain(token / PASSWORD / EMAIL / "set-cookie" / "headers" / '"body"')` ; redact defense in depth `LT:59-69` - cookie, authorization, `x-api-key`, `set-cookie` all `"[Redacted]"`, raw `not.toContain("secret")` | ✅ PASS |
| LOG-08 health failure | `logger.error({ err }, "health check failed")`, never in body | `HUT:101-105` - body `not.toContain(SECRET)`; `loggerError toHaveBeenCalledWith({ err: objectContaining({ message: SECRET }) }, "health check failed")` | ✅ PASS |
| LOG-09 `LOG_LEVEL` and output | enum, default `info`; plain JSON outside development | `LT:17` - `envSchema.parse(validEnv).LOG_LEVEL toBe("info")`; `LT:20-27` each of the 7 values accepted; `LT:29-33` `verbose`, `INFO`, `""` rejected; `LT:38-40` `transportFor("development")` is `{ target: "pino-pretty" }`, `test`/`production` `undefined` (iteration 2). The wiring `transportFor(env.NODE_ENV)` at `logger.ts:24` is unasserted (M26b, minor) | ✅ PASS |
| LOG-10 batchId | new `batchId` + `tenantId` on every tick line; `batchId` sent as `X-Request-Id` | `SWT:674-677` - `requestId toMatch(UUID)`, every line `toMatchObject({ tenantId: acme, batchId: call.requestId })`; `SWT:688` new id per batch; `ACT:85` - received header `requestId: REQUEST_ID` | ✅ PASS |
| LOG-11 worker lines | levels, messages and fields of the table | `SWT:710-729` superseded (`debug`, `sku`, `version`, `supersededBy`) and sent (`info`, `items`, `applied: 1`, `ignored: 1`, `durationMs: 0`); `SWT:739-745` counts omitted; `SWT:766-776` retry (`warn`, `attempts: 1`, `maxAttempts`, `retryInMs: 500`, `error`) then failed (`error`, no `retryInMs`); `SWT:787-794` rate limited (`warn`, `items`, `retryAfterMs: 2000`) | ✅ PASS |
| LOG-12 tick failed | `error`, `err`, `batchId` after claim, none before; keeps running | `SWT:852-862` - one error line `{ msg: "tick failed", batchId: requestIds[0], err.message }`, `ticks === 3`, all events sent; `SWT:884-894` - before claim: one `error` line, `not.toHaveProperty("batchId"/"tenantId")` | ✅ PASS |
| LOG-13 mock id rule + access line | same regex rule; one access line | `MAT:466-471` - echoed id, access line `{ level: info, req: { id, method: "POST", url: "/updates" }, res: { statusCode: 200 } }`; `MAT:548` invalid id → UUID | ✅ PASS |
| LOG-14 mock outcome line | `tenantId`, item count, outcome with `applied`/`ignored`; failure modes named; 429/401 access line only | `MAT:473-482` applied (`items: 2`, `applied: 2`, `ignored: 0`, `req.id`); `MAT:502-511` each of `error`/`timeout`/`apply-then-error`; `MAT:530-536` 401/429 exactly one line | ✅ PASS |
| LOG-15 no API key | key value and header never logged | `MAT:565-567` - raw `not.toContain(API_KEY / "wrong-key" / "x-api-key")`; redact `MLT:21-24` - `x-api-key` `"[Redacted]"` (iteration 2) | ✅ PASS |

**Status**: ✅ All ACs covered (iteration 2).

---

## Discrimination Sensor - iteration 2

This was a re-run of the iteration 1 survivors plus the new wiring and redact paths. It used a fresh detached worktree at `f13f27e`, with `pnpm install --offline` and `.env` symlinked in. Afterwards the worktree was removed with `git worktree remove --force`. The real tree's `git status --porcelain` then matched its baseline (` M .specs/LESSONS.md`, ` M .specs/STATE.md`, ` M .specs/lessons.json`, `?? .specs/features/logging/`, `?? docs/`).

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M24 | `apps/backend/src/http/middlewares/http-logger.ts:32` | a 503 from `/health` logged at `debug` | ✅ Killed (`HUT:109`) |
| M25 | `apps/backend/src/infra/env.ts:13` | `LOG_LEVEL` default `debug` | ✅ Killed (`LT:16`) |
| M26 | `apps/backend/src/infra/logger.ts:17` | `transportFor` pretty outside production | ✅ Killed (`LT:37`) |
| M26b | `apps/backend/src/infra/logger.ts:24` | root logger calls `transportFor("development")` (wiring) | ⚠️ Survived (minor, follow-up) |
| M10 | `apps/backend/src/infra/logger.ts:11` | `set-cookie` dropped from `redact` | ✅ Killed (`LT:45`) |
| M10b | `apps/backend/src/infra/logger.ts:8` | `cookie` dropped from `redact` | ✅ Killed (`LT:45`) |
| M27 | `apps/ads-mock/src/logger.ts:9` | mock `redact` emptied | ✅ Killed (`MLT:7`) |
| M28 | `apps/ads-mock/src/server.ts:10` | mock pretty outside development | ⚠️ Survived (minor, untested entrypoint, follow-up) |

**Iteration 2 outcome**: 6/8 killed; the 2 survivors are entrypoint wiring of a tested rule (output format only, no data or secret exposure) - PASS ✅

## Iteration 1

### Discrimination Sensor - iteration 1

Run in a detached temp worktree at `HEAD` (`scratchpad/wt`, `pnpm install --offline`, `.env` symlinked), each mutant applied, the covering test files run, the file restored. Worktree removed with `git worktree remove --force`; real-tree `git status --porcelain` matched the pre-sensor baseline (` M .specs/STATE.md`, `?? .specs/features/logging/`, `?? docs/`).

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M1 | `apps/backend/src/http/middlewares/http-logger.ts:14` | `genReqId` drops the regex check | ✅ Killed (6 tests) |
| M2 | `apps/backend/src/http/middlewares/http-logger.ts:33` | 4xx logged at `error` | ✅ Killed |
| M3 | `apps/backend/src/http/middlewares/http-logger.ts:34` | `/health` debug rule removed | ✅ Killed |
| M4 | `apps/backend/src/http/middlewares/http-logger.ts:32` | `/health` → `debug` before the status check | ✅ Killed (via the POST `/health` 500) |
| M5 | `apps/backend/src/http/middlewares/http-logger.ts:50` | `customProps` auth fields dropped | ✅ Killed |
| M6 | `apps/backend/src/app.ts:49` | `exposedHeaders` removed | ✅ Killed |
| M7 | `apps/backend/src/http/middlewares/error-handler.ts:21` | extra `req.log.error` (two error lines) | ✅ Killed |
| M8 | `apps/backend/src/http/middlewares/error-handler.ts:21` | `res.err` not set (no stack) | ✅ Killed |
| M9 | `apps/backend/src/http/middlewares/http-logger.ts:52` | `req` serializer keeps headers | ✅ Killed |
| M10 | `apps/backend/src/infra/logger.ts:11` | `set-cookie` dropped from `redact` | ❌ Survived (masked by the reduced serializers) |
| M11 | `apps/backend/src/modules/sync/sync.worker.ts:130` | a fresh UUID sent instead of `batchId` | ✅ Killed |
| M12 | `apps/backend/src/modules/sync/ads-client.ts:69` | `X-Request-Id` header not sent | ✅ Killed |
| M13 | `apps/backend/src/modules/sync/sync.worker.ts:101` | batch logger not rebound for the catch | ✅ Killed |
| M14 | `apps/backend/src/modules/sync/sync.worker.ts:180` | `event failed` at `warn` | ✅ Killed |
| M15 | `apps/backend/src/modules/sync/sync.worker.ts:106` | `event superseded` at `info` | ✅ Killed |
| M16 | `apps/backend/src/modules/sync/sync.worker.ts:196` | `run()` rethrows (stops) | ✅ Killed |
| M17 | `apps/backend/src/modules/health/health.service.ts:68` | message changed | ✅ Killed |
| M18 | `apps/ads-mock/src/logger.ts:19` | mock `genReqId` drops the regex | ✅ Killed |
| M19 | `apps/ads-mock/src/app.ts:130` | `apply-then-error` logged as `error` | ✅ Killed |
| M20 | `apps/ads-mock/src/logger.ts:42` | mock serializer keeps headers | ✅ Killed |
| M21 | `apps/ads-mock/src/app.ts:95` | outcome line on a 401 | ✅ Killed |
| M22 | `apps/ads-mock/src/app.ts:151` | `applied`/`ignored` dropped | ✅ Killed |
| M23 | `apps/backend/src/app.ts:44` | logger moved after CORS | ⚪ Survived, equivalent (a string `CORS_ORIGIN` never rejects; nothing observable changes) |
| M24 | `apps/backend/src/http/middlewares/http-logger.ts:32` | a 503 from `/health` logged at `debug` | ❌ Survived |
| M25 | `apps/backend/src/infra/env.ts:13` | `LOG_LEVEL` default `debug` | ❌ Survived |
| M26 | `apps/backend/src/infra/logger.ts:19` | `pino-pretty` outside development | ❌ Survived |

**Sensor depth**: expanded (26 mutants; the feature touches secrets in logs)
**Iteration 1 outcome**: 21/26 killed, 1 equivalent, 4 survived; not discriminating at the time (all 4 killed in iteration 2)

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ (no `AsyncLocalStorage`, no service logging, no OpenAPI or frontend change) |
| Matches patterns | ✅ (`genReqId` duplicated in the mock by design: separate apps, design.md) |
| Spec-anchored outcome check | ✅ (iteration 2) |
| Per-layer Coverage Expectation met | ✅ (iteration 2; `envSchema` exported for the test, `transportFor` extracted) |
| Every test maps to a spec requirement | ✅ |
| Documented guidelines followed: `CLAUDE.md` (comments explain why only) | ✅ |

---

## Edge Cases

- [x] Unknown route gets an id and an access line: `HLT:166` (404 at `warn`, found by request id). A CORS-rejected request cannot occur with a fixed-string `CORS_ORIGIN` (M23 equivalent).
- [x] Client abort still writes the access line: **accepted gap** (coordinator decision, iteration 2). It is pino-http's `close` handling, not project code, so it has no project test.

---

## Gate Check

- **Gate command**: `pnpm --filter stocksync-api test` and `pnpm --filter ads-mock test` (Postgres up)
- **Result (iteration 2)**: backend 22 files, 564 passed, 0 failed; ads mock 2 files, 44 passed, 0 failed; 0 skipped
- **Result (iteration 1)**: backend 550 passed; ads mock 43 passed
- **Test count before feature**: not re-measured
- **New tests**: `HLT` 21, `MAT` +8 (`logs` block), `SWT` +8 (`log` block and two `run` tests), `ACT` request id assertion
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans (iteration 1, all applied in fix iteration 1)

### Fix 1: 503 `/health` access level (LOG-05) - Major

- **Root cause**: the level table covers a 500 on `/health` only through a malformed POST; no test drives a 503 from the health check through the access line.
- **Fix task**: in `HLT` (or a `HUT`-style file that mocks `health.repository.js`), make `findDatabaseInfo` reject, `GET /health` with a memory logger, assert `response.status === 503` and the access line `level === LEVELS.error`.
- **Done when**: M24 is killed.

### Fix 2: `LOG_LEVEL` schema and output (LOG-09) - Major

- **Root cause**: T1 shipped with `Tests: none`.
- **Fix task**: unit test the env schema (export it apart from the exiting parse, as L-015 suggests): `LOG_LEVEL` absent → `"info"`, each of the 7 values accepted, `"verbose"` rejected. Test that `logger.ts` uses no transport unless `NODE_ENV=development` (e.g. export a `loggerTransport(nodeEnv)` helper or `vi.resetModules` + `vi.stubEnv` and inspect the built options).
- **Done when**: M25 and M26 are killed.

### Fix 3: `redact` defense in depth (LOG-07, prompt) - Minor

- **Root cause**: the reduced serializers already remove headers, so removing a `redact` path changes nothing observable through the app.
- **Fix task**: with `createMemoryLogger()`, log `{ req: { headers: { cookie, authorization, "x-api-key" } }, res: { headers: { "set-cookie" } } }` and assert each value is `[Redacted]`; same for the mock's `loggerOptions`.
- **Done when**: M10 is killed.

---

## Optional follow-ups (iteration 2, non-blocking)

- M26b: assert the root logger's transport wiring, e.g. `vi.stubEnv("NODE_ENV", "production")` + `vi.resetModules()`, import `logger.ts` and check that no transport is set. A spy on `pino` is another option.
- M28: give the mock a `transportFor` like the backend's and use it in `server.ts`, with the same unit test.

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| LOG-01..LOG-04 | Implemented | ✅ Verified |
| LOG-05 | Needs Fix (iteration 1) | ✅ Verified (iteration 2) |
| LOG-06..LOG-08 | Implemented | ✅ Verified |
| LOG-09 | Needs Fix (iteration 1) | ✅ Verified (iteration 2) |
| LOG-10..LOG-15 | Implemented | ✅ Verified |

---

## Summary

**Overall (iteration 2)**: ready; superseded by iteration 3 (see top)

**Spec-anchored check**: 15/15 ACs matched spec outcome
**Sensor**: iteration 2 6/8 killed (2 minor wiring survivors, follow-ups); iteration 1 survivors all killed
**Gate**: 608 passed (564 backend + 44 mock), 0 failed

**What works**: request id rule and echo in both apps, CORS exposure, access line fields and levels including the 503 `/health` case, one error line with the stack, secret-free logs with redaction tested directly, `LOG_LEVEL` schema and the dev-only transport rule, the worker's batch id carried through to the mock, and every worker and mock line in the table.

**Issues found**: none blocking. The optional follow-ups are M26b and M28. The client abort is an accepted gap.

**Next steps**: feature done; open the PR only with the user's go-ahead.
