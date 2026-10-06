# API Versioning Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: inline. `app.ts` mounts `/health` at the root and the `apiRoutes` table (without `/health`) on a `v1` router at `/api/v1`. The OpenAPI document declares `servers: [{ url: "/api/v1" }]` and overrides `/health` with a path-level `servers: [{ url: "/" }]`. The coverage test joins mounted routes and documented paths with their prefixes.

**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md`, `AGENTS.md`, existing supertest suites in `src/modules/*/*.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| App routing (`app.ts`) | integration (supertest) | Every VER AC on routing; every existing route test calls the versioned URL | `src/app.test.ts`, `src/modules/*/*.test.ts` | `pnpm --filter stocksync-api test` |
| OpenAPI document and coverage | unit + integration | VER-05..07 | `src/http/openapi.test.ts`, `src/http/controllers/docs.test.ts` | `pnpm --filter stocksync-api test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter stocksync-api exec vitest run src/http` |
| Full | After tasks with integration tests | `pnpm --filter stocksync-api db:up && pnpm --filter stocksync-api test` |
| Build | After phase completion | `pnpm typecheck && pnpm test && pnpm lint:check` |

---

## Execution Plan

### Phase 1: Versioning

```
T1 → T2
```

---

## Task Breakdown

### T1: Mount the API under /api/v1

**What**: `/health` mounted at the root and removed from `apiRoutes`; `apiRoutes` mounted on a `v1` router at `/api/v1`; every existing route test calls `/api/v1/...`; `app.test.ts` covers the prefix, the 404 for unprefixed routes, `/health` at the root only and the docs at the root.
**Where**: `apps/backend/src/app.ts`
**Depends on**: None
**Reuses**: `apiRoutes`, `notFoundHandler`
**Requirement**: VER-01, VER-02, VER-03, VER-04

**Done when**:

- [x] `app.test.ts` asserts VER-01..04 and the cookie edge case
- [x] Every existing supertest call uses the versioned URL with unchanged assertions
- [x] Full gate passes with the previous test count plus the new tests

**Tests**: integration
**Gate**: full

---

### T2: Versioned OpenAPI document

**What**: `servers: [{ url: "/api/v1" }]` on the document, `servers: [{ url: "/" }]` on `/health`, and a coverage test that compares prefixed routes with server-joined paths.
**Where**: `apps/backend/src/http/openapi.ts`
**Depends on**: T1
**Reuses**: `apiRoutes`
**Requirement**: VER-05, VER-06, VER-07

**Done when**:

- [x] `openapi.test.ts` asserts both `servers` entries
- [x] `docs.test.ts` coverage compares full URLs in both directions
- [x] Build gate passes

**Tests**: integration
**Gate**: build

---

## Phase Execution Map

```
Phase 1:  T1 → T2
```
