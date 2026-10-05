# Sync Worker Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: `.specs/features/sync-worker/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md`, `apps/backend/vitest.config.ts`, `docs/prompts/05-sync.md` (Worker section, Tests > Worker), confirmed lessons L-006/L-007.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| HTTP client | integration (local http server) | Every result mapping | `src/modules/sync/ads-client.test.ts` | `pnpm --filter stocksync-api test` |
| Token bucket | unit | Spacing and window property | `src/modules/sync/token-bucket.test.ts` | `pnpm --filter stocksync-api test` |
| Worker tick and repository | integration (real DB, fake client) | Every worker AC | `src/modules/sync/sync.worker.test.ts` | `pnpm --filter stocksync-api test` |
| Env and entry point | none | typecheck plus a local run | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api exec vitest run src/modules/sync` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion or config/entity-only tasks | `pnpm typecheck && pnpm test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Worker

```
T1 → T2 → T3 → T4 → T5 → T6
```

---

## Task Breakdown

### T1: Env variables

**What**: `ADS_*`/`SYNC_*` in `infra/env.ts`, test values in `vitest.config.ts`.
**Where**: `apps/backend/src/infra/env.ts`
**Depends on**: None
**Reuses**: existing env schema
**Requirement**: WRK-01

**Done when**:

- [x] Typecheck passes and the suite still runs

**Tests**: none
**Gate**: build

---

### T2: HTTP AdsClient

**What**: Interface, result type and HTTP implementation with timeout and error mapping.
**Where**: `apps/backend/src/modules/sync/ads-client.ts`
**Depends on**: T1
**Reuses**: none
**Requirement**: WRK-03, WRK-04, WRK-05

**Done when**:

- [x] Each mapping is asserted against a local server

**Tests**: integration
**Gate**: full

---

### T3: Token bucket

**What**: Capacity-1 bucket with injected clock and sleep.
**Where**: `apps/backend/src/modules/sync/token-bucket.ts`
**Depends on**: T2
**Reuses**: none
**Requirement**: WRK-06

**Done when**:

- [x] Takes are spaced by 1000 / rate ms and never exceed the rate in any second

**Tests**: unit
**Gate**: quick

---

### T4: Worker tick and repository queries

**What**: Claim, coalesce, send, record outcome; `run` loop.
**Where**: `apps/backend/src/modules/sync/sync.worker.ts`
**Depends on**: T3
**Reuses**: `sync.repository.ts`, `recordSyncEvent` flows to create events
**Requirement**: WRK-06, WRK-07, WRK-08, WRK-09, WRK-10, WRK-11, WRK-12, WRK-13, WRK-14, WRK-15

**Done when**:

- [x] Every worker test of the prompt passes, plus crash rollback

**Tests**: integration
**Gate**: full

---

### T5: Entry point and scripts

**What**: `src/worker.ts`, `worker` and `dev:worker` scripts; manual end-to-end run with the mock.
**Where**: `apps/backend/src/worker.ts`
**Depends on**: T4
**Reuses**: `createSyncWorker`, `createHttpAdsClient`
**Requirement**: WRK-02

**Done when**:

- [x] Worker and mock run locally and `GET /ads` shows the seeded products of both tenants

**Tests**: none
**Gate**: build

---

### T6: Detailed worker log

**What**: Per-event log lines (superseded, sent with applied/ignored, failure with attempt and retry delay, failed, rate limited); the HTTP client reads the counts from a 2xx body.
**Where**: `apps/backend/src/modules/sync/sync.worker.ts`
**Depends on**: T5
**Reuses**: `AdsResult`, injected `log`
**Requirement**: WRK-16

**Done when**:

- [x] Each log format is asserted, and a 2xx body without counts is still ok

**Tests**: integration
**Gate**: build
