# Ads Mock Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: `.specs/features/ads-mock/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md`, `docs/prompts/05-sync.md` (Mock section and Tests > Mock).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Routes and middlewares | integration (supertest, in-memory) | Every AC, injected `random`/`now` | `apps/ads-mock/src/*.test.ts` | `pnpm --filter ads-mock test` |
| Env schema | none | typecheck only; exercised by `server.ts` | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter ads-mock test` |
| Full | After tasks with integration tests | `pnpm --filter ads-mock test` |
| Build | After phase completion or config/entity-only tasks | `pnpm typecheck && pnpm test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Mock

```
T1 → T2 → T3
```

---

## Task Breakdown

### T1: Workspace app scaffold and env

**What**: `package.json`, tsconfigs, `vitest.config.ts`, `src/env.ts`, `src/server.ts`; install dependencies.
**Where**: `apps/ads-mock/`
**Depends on**: None
**Reuses**: `apps/backend/package.json` versions, `apps/backend/src/infra/env.ts` style
**Requirement**: ADS-13

**Done when**:

- [x] `pnpm --filter ads-mock typecheck` passes

**Tests**: none
**Gate**: build

---

### T2: Updates, ads and API key

**What**: `createApp` with the key check, `POST /updates` validation and versioned apply, `GET /ads`.
**Where**: `apps/ads-mock/src/app.ts`
**Depends on**: T1
**Reuses**: none
**Requirement**: ADS-01, ADS-02, ADS-03, ADS-04, ADS-05, ADS-06, ADS-14

**Done when**:

- [x] Older/equal versions ignored, tenants isolated, 400 and 401 cases pass

**Tests**: integration
**Gate**: full

---

### T3: Rate limit and failure injection

**What**: Sliding-window limiter and the three failure modes.
**Where**: `apps/ads-mock/src/rate-limiter.ts`
**Depends on**: T2
**Reuses**: injected `now`/`random`
**Requirement**: ADS-07, ADS-08, ADS-09, ADS-10, ADS-11, ADS-12

**Done when**:

- [x] 429 with `Retry-After` above the limit, recovery after the window, each failure mode's state

**Tests**: integration
**Gate**: build
