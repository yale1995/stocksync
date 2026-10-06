# Frontend Auth Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: inline. `src/api/auth.ts` (`login`, `logout`, `getMe`, `meQuery`); `routes/login.tsx` (Zod search `{ redirect?, reason? }`); `routes/_auth.tsx` (`beforeLoad` → `ensureQueryData(meQuery)`, 401 → `redirect`) with `components/app-layout.tsx`; `src/auth/session.ts` (`registerSessionExpiry(router, queryClient)`, used by `main.tsx` and `renderApp`); `components/route-focus.tsx` in `__root.tsx`. UI with shadcn Button, Input, Label, Alert, Card, Badge in the direction contract's grammar.
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md` (no frontend testing rules), `docs/prompts/06-frontend.md` (Tests > Login, Session). Style follows `apps/frontend/src/api/client.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Routes, layout, session handling | integration (Testing Library + router + MSW) | Every AC and edge case of the task | `apps/frontend/src/**/*.test.tsx` | `pnpm --filter frontend test` |
| shadcn primitives | none | build gate only (vendored library code) | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter frontend test` |
| Full | After tasks with integration tests | `pnpm --filter frontend test && pnpm --filter frontend typecheck` |
| Build | After phase completion or config-only tasks | `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` |

---

## Execution Plan

### Phase 1: Auth

```
T1 → T2 → T3 → T4 → T5 → T6
```

---

## Task Breakdown

### T1: shadcn primitives

**What**: Add shadcn `button`, `input`, `label`, `alert`, `card`, `badge` via the CLI.
**Where**: `apps/frontend/src/components/ui/`
**Depends on**: None
**Reuses**: `components.json`, `src/index.css` tokens
**Requirement**: AUTH-01

**Done when**:

- [x] Components compile against the theme tokens

**Tests**: none
**Gate**: build

---

### T2: Auth API and login route

**What**: `src/api/auth.ts`; `routes/login.tsx` with field validation, API alert, redirect handling and signed-in redirect; `routes/login.test.tsx`.
**Where**: `apps/frontend/src/routes/login.tsx`
**Depends on**: T1
**Reuses**: `apiFetch`, `ApiError`, `renderApp`
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07

**Done when**:

- [x] Every Sign in AC and the redirect / network edge cases have a test
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T3: Guard, layout and placeholder pages

**What**: `routes/_auth.tsx` guard + layout (`components/app-layout.tsx`), `_auth/index.tsx`, placeholder `_auth/products.tsx`, `_auth/sales.new.tsx`, `_auth/sync.tsx`; `routes/_auth.test.tsx`.
**Where**: `apps/frontend/src/routes/_auth.tsx`
**Depends on**: T2
**Reuses**: `meQuery`, `PageHeader`
**Requirement**: AUTH-08, AUTH-09, AUTH-10, AUTH-11

**Done when**:

- [x] Guard redirect, `/` redirect, user block and `aria-current` are tested
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T4: Logout

**What**: "Log out" action in the layout with success and failure handling; tests in `routes/_auth.test.tsx`.
**Where**: `apps/frontend/src/components/app-layout.tsx`
**Depends on**: T3
**Reuses**: `logout` from `src/api/auth.ts`
**Requirement**: AUTH-12, AUTH-13

**Done when**:

- [x] Success and failure paths are tested
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T5: Session expiry

**What**: `registerSessionExpiry` wired in `main.tsx` and `renderApp`; expired message on the login page; `auth/session.test.tsx`.
**Where**: `apps/frontend/src/auth/session.ts`
**Depends on**: T4
**Reuses**: `setUnauthorizedHandler`, `meQuery`
**Requirement**: AUTH-14, AUTH-15, AUTH-16

**Done when**:

- [x] Expiry, return after login and parallel 401s are tested
- [x] Gate passes

**Tests**: integration
**Gate**: full

---

### T6: Focus on route change

**What**: `RouteFocus` in `__root.tsx` moves focus to the page `h1` when the path changes; test in `routes/_auth.test.tsx`.
**Where**: `apps/frontend/src/components/route-focus.tsx`
**Depends on**: T5
**Reuses**: router `onResolved` event
**Requirement**: AUTH-17

**Done when**:

- [x] Focus test passes
- [x] Build gate passes

**Tests**: integration
**Gate**: build
