# Logging Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. `docs/prompts/07-logging.md` fixes the delivery as three commits: `feat(api): add structured logs with a request id`, `feat(ads-mock): add structured logs`, then `chore: add spec-driven artifacts for logging`.

---

**Design**: `.specs/features/logging/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md`, `docs/prompts/07-logging.md` (Tests).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| HTTP logger middleware | integration (supertest + real DB) | LOG-01..LOG-07 | `apps/backend/src/http/middlewares/http-logger.test.ts` | `pnpm --filter stocksync-api test` |
| Health service | integration (mocked repository) | LOG-08 | `apps/backend/src/modules/health/health-unavailable.test.ts` | `pnpm --filter stocksync-api test` |
| Sync worker, ads client | integration (real DB, fake client) / unit (local HTTP server) | LOG-10..LOG-12 | `apps/backend/src/modules/sync/sync.worker.test.ts`, `ads-client.test.ts` | `pnpm --filter stocksync-api test` |
| Ads mock app | integration (supertest) | LOG-13..LOG-15 | `apps/ads-mock/src/app.test.ts` | `pnpm --filter ads-mock test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api exec vitest run src/modules/sync/ads-client.test.ts` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test && pnpm --filter ads-mock test` |
| Build | After phase completion or config/entity-only tasks | `pnpm typecheck && pnpm test && pnpm lint:check && pnpm build` |

---

## Execution Plan

### Phase 1: API

```
T1 → T2 → T3
T1 → T4
```

### Phase 2: Worker and mock

```
T5 → T6
T7
```

---

## Task Breakdown

### T1: Logger module and env

**What**: `LOG_LEVEL` in env, `infra/logger.ts`, memory logger test helper, `LOG_LEVEL=silent` in vitest config; `server.ts` logs the port.
**Where**: `apps/backend/src/infra/env.ts`, `infra/logger.ts`, `infra/test/memory-logger.ts`, `server.ts`, `vitest.config.ts`
**Depends on**: None
**Reuses**: `env`
**Requirement**: LOG-09

**Done when**:

- [x] The root logger is built from `LOG_LEVEL` and the suite still runs silent

**Tests**: none
**Gate**: build

---

### T2: HTTP logger middleware

**What**: `createHttpLogger` (genReqId, header, levels, serializers, auth props); first middleware in `createApp({ logger })`; CORS `exposedHeaders`; `errorHandler` sets `res.err`.
**Where**: `apps/backend/src/http/middlewares/http-logger.ts`, `app.ts`, `error-handler.ts`
**Depends on**: T1
**Reuses**: `requireAuth`'s `req.auth`
**Requirement**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07

**Done when**:

- [x] Every response carries `X-Request-Id` and produces one access line

**Tests**: integration
**Gate**: full

---

### T3: Middleware tests

**What**: prompt tests 1-7 with the memory logger; error-handler test drops its console spies.
**Where**: `apps/backend/src/http/middlewares/http-logger.test.ts`, `error-handler.test.ts`
**Depends on**: T2
**Reuses**: seed users, `createApp`
**Requirement**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07

**Done when**:

- [x] Tests 1-7 pass

**Tests**: integration
**Gate**: full

---

### T4: Health check logging

**What**: `health.service.ts` logs `health check failed` with the shared logger; its test spies on `logger.error`.
**Where**: `apps/backend/src/modules/health/health.service.ts`, `health-unavailable.test.ts`
**Depends on**: T1
**Reuses**: `logger`
**Requirement**: LOG-08

**Done when**:

- [x] The 503 path logs through the logger and never in the body

**Tests**: integration
**Gate**: full

---

### T5: Ads client request id

**What**: `sendUpdates(tenantId, items, requestId)` sends `X-Request-Id`.
**Where**: `apps/backend/src/modules/sync/ads-client.ts`, `ads-client.test.ts`
**Depends on**: None
**Reuses**: local HTTP server helper of `ads-client.test.ts`
**Requirement**: LOG-10

**Done when**:

- [x] The header reaches the server

**Tests**: unit
**Gate**: quick

---

### T6: Worker structured logs

**What**: `logger` dep, `batchId` per claimed batch, the table's lines, `tick failed`; `worker.ts` start/stop lines; worker tests rewritten for fields and levels.
**Where**: `apps/backend/src/modules/sync/sync.worker.ts`, `sync.worker.test.ts`, `apps/backend/src/worker.ts`
**Depends on**: T5
**Reuses**: memory logger helper
**Requirement**: LOG-10, LOG-11, LOG-12

**Done when**:

- [x] The `requestId` sent equals the lines' `batchId` and every situation logs its level and fields

**Tests**: integration
**Gate**: full

---

### T7: Ads mock logs

**What**: `LOG_LEVEL`/`NODE_ENV` env, `logger.ts`, pino-http first middleware, outcome line in `/updates`, `server.ts`; tests.
**Where**: `apps/ads-mock/src/env.ts`, `logger.ts`, `app.ts`, `server.ts`, `app.test.ts`
**Depends on**: None
**Reuses**: request id rule of T2
**Requirement**: LOG-13, LOG-14, LOG-15

**Done when**:

- [x] The request id is on the access and outcome lines, and no line has the API key

**Tests**: integration
**Gate**: build
