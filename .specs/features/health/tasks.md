# Health Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. `docs/prompts/06-health.md` fixes the delivery as two commits: `feat(api): report server, database and sync queue health` (code and tests), then `chore: add spec-driven artifacts for health`.

---

**Design**: inline (Medium scope, no new pattern): `modules/health/health.repository.ts` (queries), `health.service.ts` (one 1000 ms timeout around every query, builds the response), thin `health.controller.ts` (200/503, `Cache-Control: no-store`). Failure injection by `vi.mock` of the repository in `health-unavailable.test.ts`.
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md`, `docs/prompts/06-health.md` (Tests).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Route, service, repository | integration (supertest + real DB) | Every AC with the database up | `src/modules/health/health.test.ts` | `pnpm --filter stocksync-api test` |
| Route, service (failures) | integration (mocked repository) | HLT-10..HLT-12 | `src/modules/health/health-unavailable.test.ts` | `pnpm --filter stocksync-api test` |
| OpenAPI document and schemas | unit | HLT-13, strict schema | `src/http/openapi.test.ts`, `src/http/controllers/response-schemas.test.ts` | `pnpm --filter stocksync-api test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api exec vitest run src/modules/health src/http` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion or config/entity-only tasks | `pnpm typecheck && pnpm test && pnpm lint:check && pnpm --filter stocksync-api build` |

---

## Execution Plan

### Phase 1: Health

```
T1 → T2 → T3
```

---

## Task Breakdown

### T1: Queries and service

**What**: `ping`, `findDatabaseInfo`, `summarizeSyncQueue` (one cross-tenant `FILTER` query); `getHealth()` with `HEALTH_CHECK_TIMEOUT_MS = 1000`.
**Where**: `apps/backend/src/modules/health/health.repository.ts`, `health.service.ts`
**Depends on**: None
**Reuses**: `db`, `syncEvents` schema, `env`
**Requirement**: HLT-03, HLT-04, HLT-05, HLT-06, HLT-07, HLT-08, HLT-10, HLT-11, HLT-12

**Done when**:

- [x] The service returns the agreed shape, or the down shape on rejection or timeout

**Tests**: integration
**Gate**: full

---

### T2: Route, schema and OpenAPI

**What**: thin controller (200/503, `no-store`), new `healthSchema`, `/health` documents `200` and `503`, Health tag description.
**Where**: `apps/backend/src/http/controllers/health.controller.ts`, `health.validation.ts`, `apps/backend/src/http/openapi.ts`, `openapi-description.ts`
**Depends on**: T1
**Reuses**: `json()` helper, `timestampSchema`
**Requirement**: HLT-01, HLT-02, HLT-09, HLT-13

**Done when**:

- [x] `/health` answers through the service and the document lists both statuses

**Tests**: unit
**Gate**: quick

---

### T3: Tests

**What**: prompt tests 1-7; `app.test.ts`, `openapi.test.ts` and `response-schemas.test.ts` updated.
**Where**: `apps/backend/src/modules/health/health.test.ts`, `health-unavailable.test.ts`
**Depends on**: T2
**Reuses**: event fixture pattern of `sync-status.test.ts`
**Requirement**: HLT-01..HLT-13

**Done when**:

- [x] Every test of the prompt passes and the full suite is green

**Tests**: integration
**Gate**: build
