# API Versioning Specification

## Problem Statement

The API routes live at the root (`/products`, `/sales`), so a breaking change would have no way to coexist with current clients. This feature moves every business route under `/api/v1` before the frontend (Part C) starts consuming the API, while infrastructure routes (`/health`) and the docs stay at the root.

## Goals

- [ ] Every business route answers only under `/api/v1`
- [ ] The OpenAPI document and Scalar call the versioned URLs without changing the documented paths

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Aliases for the old unversioned routes | No client consumes the API yet |
| A v2 or version negotiation by header | Nothing breaking is planned; the prefix leaves room for it |
| `apps/ads-mock` routes | Internal simulated service |
| Restricting the cookie path to `/api` | No gain; the cookie keeps `path: "/"` |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Prefix | `/api/v1`, mounting the existing `apiRoutes` table on a `v1` router | Agreed with the user | y |
| `/health` | Stays at the root, outside `apiRoutes` | Infrastructure route for Docker or load balancer probes, not part of the API contract | y |
| Docs | `/docs` and `/openapi.json` stay at the root | The document describes the version through `servers`; a v2 would get its own document | y |
| OpenAPI paths | Relative (`/products`) with `servers: [{ url: "/api/v1" }]`; `/health` overrides it with a path-level `servers: [{ url: "/" }]` | Idiomatic OpenAPI; Scalar builds the right URL for each path | y |
| Unknown routes | The existing `notFoundHandler` answers 404 `NOT_FOUND` for the old unversioned paths | No special case needed | n |
| Tests | Every supertest call moves to `/api/v1/...`; assertions stay the same | Behavior does not change, only the URL | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Versioned routes ⭐ MVP

**User Story**: As an API client, I want the routes under a version prefix so that a future breaking version can coexist with this one.

**Acceptance Criteria**:

1. VER-01: WHEN a client calls an auth, products, stock movements, sales or sync route under `/api/v1` THEN the system SHALL answer exactly as the unprefixed route did before this feature
2. VER-02: IF a client calls one of these routes without the `/api/v1` prefix THEN the system SHALL respond 404 with code `NOT_FOUND`
3. VER-03: WHEN a client calls `GET /health` THEN the system SHALL respond 200, and `GET /api/v1/health` SHALL respond 404
4. VER-04: The system SHALL keep serving `GET /docs` and `GET /openapi.json` at the root

**Independent Test**: `POST /api/v1/auth/login`, then `GET /api/v1/products` answers 200 while `GET /products` answers 404.

---

### P1: Versioned document ⭐ MVP

**User Story**: As a reviewer, I want the docs to call the versioned URLs so that "Test Request" in Scalar keeps working.

**Acceptance Criteria**:

1. VER-05: The OpenAPI document SHALL declare `servers: [{ url: "/api/v1" }]` and keep every path relative to it
2. VER-06: The `/health` path item SHALL declare `servers: [{ url: "/" }]`
3. VER-07: The route coverage test SHALL compare each mounted route, joined with its prefix, against each documented path joined with its effective server URL, in both directions

**Independent Test**: Open `/docs`, log in and call `GET /products` from Scalar; the request goes to `/api/v1/products` and answers 200.

---

## Edge Cases

- WHEN the client logs in at `/api/v1/auth/login` THEN the `access_token` cookie SHALL be sent on later `/api/v1` requests (cookie path `/`)
- WHEN a route is unknown under `/api/v1` THEN the system SHALL respond 404 `NOT_FOUND` with the same envelope as before

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| VER-01 | P1: Versioned routes | Execute | Verified |
| VER-02 | P1: Versioned routes | Execute | Verified |
| VER-03 | P1: Versioned routes | Execute | Verified |
| VER-04 | P1: Versioned routes | Execute | Verified |
| VER-05 | P1: Versioned document | Execute | Verified |
| VER-06 | P1: Versioned document | Execute | Verified |
| VER-07 | P1: Versioned document | Execute | Verified |

**Coverage:** 7 total, 7 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
- [ ] Scalar's "Test Request" works against `/api/v1` after a login
