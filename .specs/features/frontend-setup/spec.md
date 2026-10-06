# Frontend Setup Specification

## Problem Statement

Part C needs a React SPA in `apps/frontend` that consumes the existing `/api/v1` API. Before any screen is built, the package needs its toolchain (Vite, TanStack Router and Query, Tailwind and shadcn/ui), a same-origin connection to the API, one typed API client that turns every failure into a predictable error, and a test harness (Vitest, Testing Library, MSW). Source of truth: `docs/prompts/06-frontend.md`.

## Goals

- [ ] `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test` and `pnpm lint:check` cover the frontend package
- [ ] Every API call goes through one client that returns parsed JSON or throws an `ApiError { status, code, message }`
- [ ] Later features can write route-level tests against MSW handlers with one helper

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Login, guard, layout, screens | Features `frontend-auth`, `frontend-products`, `frontend-sales`, `frontend-sync` |
| shadcn components | Added by the feature that first uses each one |
| Production hosting / reverse proxy config | The dev proxy mirrors it; deployment is not part of the assessment |
| Generated API types | README future improvement (openapi-typescript) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/06-frontend.md` | Applied as written | Agreed with the user | y |
| `ApiError.code` when the error body is not the API shape | `"UNKNOWN_ERROR"`, message "Something went wrong. Please try again." | The prompt asks for a generic message; a distinct code keeps `ErrorCode` honest about where the error came from | y (plan approved) |
| `ApiError` for a network failure | `status: 0`, `code: "NETWORK_ERROR"`, message "Could not reach the server. Check your connection and try again." | `status 0` mirrors what the browser reports for a failed fetch; the sale retry flow needs to tell it apart from an API answer | y (plan approved) |
| Response without a body (204) | `apiFetch` resolves `undefined` | `POST /auth/logout` answers 204 | y |
| Relative URLs in tests | The test setup resolves relative `fetch` URLs against `window.location` | Node's `fetch` rejects relative URLs; the app keeps calling `/api/v1/...` as the browser does | y |
| Package name | `frontend` (existing `package.json`) | Already in the workspace | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Toolchain and same-origin API ⭐ MVP

**User Story**: As a developer, I want the frontend to run, build, typecheck, lint and test from the monorepo scripts, talking to the API on the same origin, so that the screens can be built on a working base.

**Acceptance Criteria**:

1. FSET-01: The frontend package SHALL define the scripts `dev`, `build`, `preview`, `test`, `test:watch` and `typecheck`, so the root `turbo` scripts run them
2. FSET-02: WHEN the Vite dev server receives a request whose path starts with `/api` THEN it SHALL proxy it to `http://localhost:3333`
3. FSET-03: The router SHALL be generated from file-based routes in `src/routes/` and carry the context `{ queryClient }`
4. FSET-04: The repository lint (`pnpm lint:check`) SHALL ignore the generated `src/routeTree.gen.ts`

**Independent Test**: `pnpm typecheck && pnpm test && pnpm lint:check && pnpm --filter frontend build` pass; `pnpm --filter frontend dev` serves the app and `/api/v1/auth/me` reaches the backend.

---

### P1: API client ⭐ MVP

**User Story**: As a developer, I want one `fetch` wrapper for the API so that every screen handles success, API errors, network errors and session expiry the same way.

**Acceptance Criteria**:

1. FSET-05: WHEN `apiFetch(path, { method, body })` is called THEN the client SHALL request `/api/v1` + `path`, sending `body` as JSON with `Content-Type: application/json`
2. FSET-06: WHEN the response is 2xx with a JSON body THEN the client SHALL resolve with the parsed body
3. FSET-07: WHEN the response is 204 THEN the client SHALL resolve with `undefined`
4. FSET-08: IF the response is not 2xx and its body is `{ error: { code, message } }` THEN the client SHALL throw an `ApiError` with the response status, that `code` and that `message`
5. FSET-09: IF the response is not 2xx and its body is not the API error shape THEN the client SHALL throw an `ApiError` with the response status, code `UNKNOWN_ERROR` and message "Something went wrong. Please try again."
6. FSET-10: IF the request fails before a response (network error) THEN the client SHALL throw an `ApiError` with status `0`, code `NETWORK_ERROR` and message "Could not reach the server. Check your connection and try again."
7. FSET-11: WHEN a response is 401 for any request other than `POST /auth/login` THEN the client SHALL call the registered unauthorized handler once and still throw the `ApiError`
8. FSET-12: IF a 401 comes from `POST /auth/login` THEN the client SHALL NOT call the unauthorized handler
9. FSET-13: `src/api/types.ts` SHALL declare by hand `CurrentUser`, `Product`, `Page<T>`, `Sale`, `SyncStatus` and `ErrorCode`, mirroring the backend response schemas

**Independent Test**: unit tests on `apiFetch` with MSW handlers for each response kind.

---

## Edge Cases

- IF the response is 401 and no unauthorized handler is registered THEN the client SHALL still throw the `ApiError`
- WHEN extra headers are passed (e.g. `Idempotency-Key`) THEN the client SHALL send them alongside `Content-Type`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| FSET-01 | P1: Toolchain | Execute | Implemented |
| FSET-02 | P1: Toolchain | Execute | Implemented |
| FSET-03 | P1: Toolchain | Execute | Implemented |
| FSET-04 | P1: Toolchain | Execute | Implemented |
| FSET-05 | P1: API client | Execute | Implemented |
| FSET-06 | P1: API client | Execute | Implemented |
| FSET-07 | P1: API client | Execute | Implemented |
| FSET-08 | P1: API client | Execute | Implemented |
| FSET-09 | P1: API client | Execute | Implemented |
| FSET-10 | P1: API client | Execute | Implemented |
| FSET-11 | P1: API client | Execute | Implemented |
| FSET-12 | P1: API client | Execute | Implemented |
| FSET-13 | P1: API client | Execute | Implemented |

**Coverage:** 13 total, 13 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm test` (with `db:up`), `pnpm lint:check` and `pnpm --filter frontend build` pass
