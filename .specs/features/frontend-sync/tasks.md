# Frontend Sync Status Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: inline. `src/lib/format.ts` gains `formatDateTime` and `formatRelative`; `src/api/sync.ts` has `getSyncStatus` and `syncStatusQuery` (`refetchInterval: 5000`); `routes/_auth/sync.tsx` renders `components/sync/sync-summary.tsx` (counts + last sync) and `components/sync/failed-events-table.tsx`, with loading, error + Retry and the refresh warning. Tests pin `TZ=UTC`.
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md` (no frontend testing rules), `docs/prompts/06-frontend.md` (Tests > Sync status), `.specs/LESSONS.md` L-001 (cover every enum variant with a table-driven test). Style follows `apps/frontend/src/routes/_auth/products.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Formatting helpers | unit | Every unit and boundary of the relative format; the absolute format | `apps/frontend/src/lib/format.test.ts` | `pnpm --filter frontend test` |
| Route and components | integration (Testing Library + router + MSW) | Every AC and edge case; every trigger value | `apps/frontend/src/routes/_auth/sync.test.tsx` | `pnpm --filter frontend test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter frontend test` |
| Full | After tasks with integration tests | `pnpm --filter frontend test && pnpm --filter frontend typecheck` |
| Build | After phase completion or config-only tasks | `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` |

---

## Execution Plan

### Phase 1: Sync status

```
T1 → T2 → T3 → T4
```

---

## Task Breakdown

### T1: Date formatting

**What**: `formatDateTime(iso)` and `formatRelative(iso, now)` with unit tests; `TZ=UTC` for tests.
**Where**: `apps/frontend/src/lib/format.ts`
**Depends on**: None
**Reuses**: existing `format.ts`
**Requirement**: SYNC-02

**Done when**:

- [x] Unit tests cover seconds, minutes, hours, days and the absolute format

**Tests**: unit
**Gate**: quick

---

### T2: Status summary

**What**: `src/api/sync.ts`; the route with counts, last successful sync ("Never" when null) and 5 s polling; tests.
**Where**: `apps/frontend/src/routes/_auth/sync.tsx`
**Depends on**: T1
**Reuses**: `apiFetch`, `PageHeader`, `renderApp`
**Requirement**: SYNC-01, SYNC-02, SYNC-03, SYNC-04

**Done when**:

- [x] Every listed AC has a test
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T3: Failed updates table

**What**: `FailedEventsTable` with readable triggers, "—" for a missing error and the empty state; tests (every trigger value).
**Where**: `apps/frontend/src/components/sync/failed-events-table.tsx`
**Depends on**: T2
**Reuses**: shadcn `table`, `formatDateTime`
**Requirement**: SYNC-05, SYNC-06, SYNC-07

**Done when**:

- [x] Every listed AC and edge case has a test
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T4: Loading, error and refresh warning

**What**: Skeletons + status, error + Retry, and the non-blocking warning kept until a refetch succeeds; tests.
**Where**: `apps/frontend/src/routes/_auth/sync.tsx`
**Depends on**: T3
**Reuses**: `Alert`, `Skeleton`
**Requirement**: SYNC-08, SYNC-09, SYNC-10, SYNC-11

**Done when**:

- [x] Every listed AC has a test
- [x] Build gate passes

**Tests**: integration
**Gate**: build
