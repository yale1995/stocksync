# Logging Specification

## Problem Statement

The Bonus asks for structured logging with a request/correlation id. The API, the sync worker, the health check and the ads mock print free text with `console`, there is no access log and no request id. This feature replaces them with JSON logs (`pino`, `pino-http`), gives every API request an `X-Request-Id` that shows up in its logs and in the response, and links the worker's batches to the mock's logs through the same id.

## Goals

- [x] Every API request has an id, returned as `X-Request-Id` and present on its log lines
- [x] One JSON access line per request, with the tenant and user when authenticated, never a body, cookie or header
- [x] Worker and mock lines of one batch share the batch id

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Logging in services and repositories, `AsyncLocalStorage` | Prompt: the id travels through `req.log` only |
| Database schema changes | Not needed |
| `X-Request-Id` in the OpenAPI spec | Prompt out of scope |
| Frontend changes | It does not read or send the header |
| Log shipping, metrics, tracing | Prompt out of scope |
| README | Prompt out of scope |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/07-logging.md` | Applied as written | Agreed with the user on 2026-10-06 | y |
| Mock environment | `apps/ads-mock/src/env.ts` gains `NODE_ENV` (`development\|test\|production`, default `development`); `pino-pretty` only in development, in both apps | The mock had no `NODE_ENV`; the user chose "pretty only in dev" | y |
| Logger injection in tests | Backend `createApp({ logger })` defaults to the root logger; the mock's `AppOptions.logger` defaults to a silent logger | Tests assert on an in-memory destination | y (plan approved) |
| One error line per unexpected error | `errorHandler` sets `res.err = err`; the `pino-http` access line logs it at `error` with the stack | Design choice the prompt left open | y (plan approved) |
| `/health` at `debug` | Decided by path `/health` (query string ignored) and status `< 400` | A 503 still logs at `error` | y (plan approved) |
| Worker log tests | The string-based `log` tests are rewritten to assert the table's levels and fields | The message strings no longer exist | y (plan approved) |
| `tick failed` | Logged by `tick()` with the batch logger when a batch was claimed, the base logger otherwise, then rethrown; `run()` only swallows | Keeps `batchId` on a failure after the claim and one line per failure | y (plan approved) |
| Dev output | `pino-pretty` as a main-thread stream (not a transport) in development: one line per entry, local time, `[<first 8 chars of req.id or batchId>] <msg> <responseTime>ms`, hiding `pid`, `hostname`, `req`, `res`, `responseTime`, `component`, `tenantId`, `batchId` (the JSON keeps them) | The default pretty output took ~10 lines per request; the user asked for a compact view with the short id | y (2026-10-06) |
| Access line message | `<METHOD> <originalUrl> <status>` (`aborted` when the client aborts), in every environment | Replaces the generic "request completed" | y (2026-10-06) |
| Logged errors | `err` reduced to `{ type, message, stack }` | body-parser errors carry the raw request body; found in the dev smoke test | y (2026-10-06) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Request id and access log (API) ⭐ MVP

**Acceptance Criteria**:

1. LOG-01: WHEN a request has no `X-Request-Id` THEN the system SHALL respond with an `X-Request-Id` header holding a generated UUID
2. LOG-02: WHEN a request has an `X-Request-Id` matching `^[A-Za-z0-9._-]{1,128}$` THEN the system SHALL echo it unchanged; IF it does not match (too long, spaces, newlines) THEN the system SHALL replace it with a generated UUID
3. LOG-03: The system SHALL list `X-Request-Id` in `Access-Control-Expose-Headers` for the allowed origin
4. LOG-04: WHEN a response finishes THEN the system SHALL write one access line with the request id, `method`, `url`, `statusCode` and `responseTime`, plus `tenantId`, `userId` and `role` when the request is authenticated and none of them on a 401
5. LOG-05: The system SHALL log the access line at `info` for 2xx/3xx, `warn` for 4xx, `error` for 5xx, and `debug` for a successful `/health`
6. LOG-06: WHEN an unexpected error occurs THEN the system SHALL respond with the generic 500 envelope without a request id, and write exactly one `error` line carrying the request id and the stack
7. LOG-07: The system SHALL never log request or response bodies, headers, the `access_token` cookie value, the login password or `Set-Cookie`
8. LOG-08: WHEN the health check fails THEN the system SHALL log the cause with the shared logger as `health check failed`, never in the body
9. LOG-09: The system SHALL read `LOG_LEVEL` (`fatal|error|warn|info|debug|trace|silent`, default `info`) and write plain JSON to stdout outside development

### P1: Sync worker ⭐ MVP

**Acceptance Criteria**:

1. LOG-10: WHEN the worker claims a batch THEN the system SHALL bind a new `batchId` and the `tenantId` to every line of that tick and send the `batchId` to the mock as `X-Request-Id`
2. LOG-11: The system SHALL log `event superseded` (`debug`; `sku`, `version`, `supersededBy`), `batch sent` (`info`; `items`, `applied`/`ignored` when returned, `durationMs`), `batch rate limited` (`warn`; `items`, `retryAfterMs`), `event will retry` (`warn`; `sku`, `version`, `attempts`, `maxAttempts`, `retryInMs`, `error`) and `event failed` (`error`; `sku`, `version`, `attempts`, `maxAttempts`, `error`)
3. LOG-12: WHEN a tick throws THEN the system SHALL log `tick failed` at `error` with `err`, without `batchId` when nothing was claimed, and keep running

### P2: Ads mock

**Acceptance Criteria**:

1. LOG-13: The mock SHALL apply the same request id rule and write one access line per request
2. LOG-14: WHEN `/updates` is handled past validation THEN the mock SHALL log one line with `tenantId`, the item count and the outcome `applied` (with `applied`/`ignored`), `error`, `timeout` or `apply-then-error`, carrying the request id; a 429 or 401 SHALL only get the access line
3. LOG-15: The mock SHALL never log the `X-Api-Key` header

---

## Edge Cases

- WHEN a CORS-rejected or unknown route is requested THEN it SHALL still get an id and an access line (the logger is the first middleware)
- WHEN the client aborts THEN `pino-http` SHALL still write the access line

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| LOG-01 | P1: Request id and access log | Execute | Verified |
| LOG-02 | P1: Request id and access log | Execute | Verified |
| LOG-03 | P1: Request id and access log | Execute | Verified |
| LOG-04 | P1: Request id and access log | Execute | Verified |
| LOG-05 | P1: Request id and access log | Execute | Verified |
| LOG-06 | P1: Request id and access log | Execute | Verified |
| LOG-07 | P1: Request id and access log | Execute | Verified |
| LOG-08 | P1: Request id and access log | Execute | Verified |
| LOG-09 | P1: Request id and access log | Execute | Verified |
| LOG-10 | P1: Sync worker | Execute | Verified |
| LOG-11 | P1: Sync worker | Execute | Verified |
| LOG-12 | P1: Sync worker | Execute | Verified |
| LOG-13 | P2: Ads mock | Execute | Verified |
| LOG-14 | P2: Ads mock | Execute | Verified |
| LOG-15 | P2: Ads mock | Execute | Verified |

**Coverage:** 15 total, 15 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] `pnpm typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
