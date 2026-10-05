# Sync Status Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: inline (Medium scope, no new pattern): repository queries in `modules/sync/sync.repository.ts` filtered by `tenant_id` (served by the `(tenant_id, status)` index), `getSyncStatus` in `sync.service.ts`, `syncRouter` in `http/controllers/sync.controller.ts` mounted at `/sync`.
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md`, `docs/prompts/05-sync.md` (Tests > Status).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Route, service, repository | integration (supertest + real DB) | Every AC and edge case | `src/modules/sync/sync-status.test.ts` | `pnpm --filter stocksync-api test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api exec vitest run src/modules/sync` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion or config/entity-only tasks | `pnpm typecheck && pnpm test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Status

```
T1 → T2
```

---

## Task Breakdown

### T1: Status queries and service

**What**: Counts per status, `max(sent_at)`, latest 20 failed events; `getSyncStatus(tenantId)`.
**Where**: `apps/backend/src/modules/sync/sync.service.ts`
**Depends on**: None
**Reuses**: `sync.repository.ts`, `syncEvents` schema
**Requirement**: STS-02, STS-03, STS-04, STS-05

**Done when**:

- [x] Service returns the agreed shape for the caller's tenant

**Tests**: integration
**Gate**: full

---

### T2: Route and tests

**What**: `GET /sync/status` with `requireAuth`, mounted in `app.ts`; `sync-status.test.ts`.
**Where**: `apps/backend/src/http/controllers/sync.controller.ts`
**Depends on**: T1
**Reuses**: `requireAuth`, test helpers pattern
**Requirement**: STS-01, STS-06

**Done when**:

- [x] Every status test of the prompt passes

**Tests**: integration
**Gate**: build
