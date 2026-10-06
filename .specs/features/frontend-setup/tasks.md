# Frontend Setup Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**Project override:** no commits per task. The user asked to be consulted before any commit, so tasks are verified and left uncommitted, and are committed with the `commit` skill after review.

---

**Design**: inline (setup, no domain logic): Vite + React 19 + TS in `apps/frontend`, TanStack Router file-based routes via `@tanstack/router-plugin`, TanStack Query client in the router context, Tailwind v4 via `@tailwindcss/vite`, shadcn/ui initialised (`components.json`, `src/lib/utils.ts`, theme tokens from `.impeccable/surfaces/src.md`), `/api` proxied to `http://localhost:3333`, `src/api/client.ts` + `src/api/types.ts`.
**Status**: Done

---

## Test Coverage Matrix

> Guidelines found: `CLAUDE.md` (no frontend testing rules), `docs/prompts/06-frontend.md` (Tests: Vitest + Testing Library + MSW in jsdom). Style sampled from `apps/backend/src/**/*.test.ts` (co-located `*.test.ts`, `describe`/`it`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| API client | unit (MSW) | Every AC and edge case of the client | `apps/frontend/src/api/*.test.ts` | `pnpm --filter frontend test` |
| Config / types / app shell | none | build gate only | - | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `pnpm --filter frontend test` |
| Full | After tasks with integration tests | `pnpm --filter frontend test` |
| Build | After phase completion or config-only tasks | `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` |

---

## Execution Plan

### Phase 1: Toolchain

```
T1 → T2 → T3
```

### Phase 2: API client

```
T4 → T5
```

---

## Task Breakdown

### T1: Vite + React package

**What**: Dependencies, scripts, `tsconfig.json`, `vite.config.ts` (React plugin, router plugin, Tailwind plugin, `@` alias, `/api` proxy), `index.html`, `src/main.tsx`, `src/router.tsx`, `src/routes/__root.tsx`.
**Where**: `apps/frontend/vite.config.ts`
**Depends on**: None
**Reuses**: monorepo scripts in `package.json`, `turbo.json`
**Requirement**: FSET-01, FSET-02, FSET-03

**Done when**:

- [x] `pnpm --filter frontend build` emits `dist/` and generates `src/routeTree.gen.ts`
- [x] `pnpm --filter frontend typecheck` passes

**Tests**: none
**Gate**: build

---

### T2: Tailwind and shadcn/ui base

**What**: `src/index.css` with Tailwind v4 and theme tokens from the direction contract, `components.json`, `src/lib/utils.ts` (`cn`), Inter font.
**Where**: `apps/frontend/src/index.css`
**Depends on**: T1
**Reuses**: `apps/frontend/.impeccable/surfaces/src.md`
**Requirement**: FSET-01

**Done when**:

- [x] Build passes with Tailwind classes compiled

**Tests**: none
**Gate**: build

---

### T3: Repo wiring

**What**: Biome ignores `src/routeTree.gen.ts`; turbo and CI pick the package up.
**Where**: `biome.json`
**Depends on**: T2
**Reuses**: existing `files.includes`
**Requirement**: FSET-04

**Done when**:

- [x] `pnpm lint:check` passes with the generated file present

**Tests**: none
**Gate**: build

---

### T4: Test harness

**What**: Vitest jsdom config, `src/test/setup.ts` (jest-dom, MSW server lifecycle, relative fetch URLs), `src/test/server.ts`, `src/test/render.tsx` (`renderApp(path)` with a fresh router and QueryClient).
**Where**: `apps/frontend/src/test/setup.ts`
**Depends on**: None
**Reuses**: backend `vitest.config.ts` layout
**Requirement**: FSET-01

**Done when**:

- [x] `pnpm --filter frontend test` runs in jsdom with MSW

**Tests**: none
**Gate**: build

---

### T5: API client and types

**What**: `apiFetch`, `ApiError`, `setUnauthorizedHandler` in `src/api/client.ts`; hand-written types in `src/api/types.ts`; `src/api/client.test.ts`.
**Where**: `apps/frontend/src/api/client.ts`
**Depends on**: T4
**Reuses**: backend `common.validation.ts`, `*.validation.ts` response schemas (mirrored by hand)
**Requirement**: FSET-05, FSET-06, FSET-07, FSET-08, FSET-09, FSET-10, FSET-11, FSET-12, FSET-13

**Done when**:

- [x] Every client AC and edge case has a test
- [x] Gate passes

**Tests**: unit
**Gate**: build
