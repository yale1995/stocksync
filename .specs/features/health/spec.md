# Health Specification

## Problem Statement

The assessment's Bonus asks for "basic metrics or a health endpoint (queue size, last sync)". `GET /health` always answers `200 { status: "ok" }` without touching the database, so it only proves the Express process is up. This feature turns it into a real check of the server, the database and the sync queue in one response.

## Goals

- [ ] One public request shows whether the API and its database are up, with server, database and sync queue details
- [ ] A database outage or a hung query answers 503 within 1000 ms, without leaking the underlying error

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Liveness/readiness split, Prometheus `/metrics`, worker heartbeat table | One route only (prompt 06) |
| Per-tenant numbers | They stay in `GET /api/v1/sync/status` |
| Bumping `package.json`'s version | Prompt 06 |
| README known limitations (information disclosure, seq scans) | Written later with the README |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/06-health.md` | Applied as written | Agreed with the user on 2026-10-06 | y |
| Failure injection for HLT-10/HLT-11 | `vi.mock` of `health.repository.ts` in a separate `health-unavailable.test.ts`; no DI parameter on the service | Keeps the service signature clean and Postgres running | y (plan approved) |
| Timeout test | Fake `setTimeout`/`clearTimeout` and advance by the exported `HEALTH_CHECK_TIMEOUT_MS` | The test must not wait a real second | y (plan approved) |
| Reading `version` | `readFileSync` of `package.json` relative to the module URL, parsed with Zod at load | A JSON import breaks the build's `rootDir: src`; the relative URL works from `src/` and `dist/` | y (plan approved) |
| OpenAPI tag description | `"Server, database and sync queue health."` instead of `"Liveness check."` | The endpoint is no longer liveness-only | y (plan approved) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Health check ⭐ MVP

**User Story**: As an operator (or a probe), I want one public endpoint that reports the server, the database and the sync queue so that I can tell whether the API works and whether the sync is falling behind.

**Why P1**: It is the whole feature.

**Acceptance Criteria**:

1. HLT-01: WHEN anyone calls `GET /health` without a cookie while the database is up THEN the system SHALL respond 200 with `status: "ok"`
2. HLT-02: The system SHALL respond to `GET /health` with `Cache-Control: no-store`
3. HLT-03: The system SHALL return `server` as `{ status: "up", version: <package.json version>, nodeVersion: process.version, environment: NODE_ENV, provider: "local" }`
4. HLT-04: WHEN the database is up THEN the system SHALL return `database` with `status: "up"`, the raw `server_version` as `version`, `max_connections` as an integer, the `pg_stat_activity` count of the current database as `openConnections`, and the `SELECT 1` round trip as integer `latencyMs`
5. HLT-05: WHEN the database is up THEN the system SHALL return `sync` as `{ pending, failed, oldestPendingAt, lastSuccessfulSyncAt }` computed across every tenant
6. HLT-06: The system SHALL count every `pending` event in `sync.pending`, including events waiting for a backoff
7. HLT-07: WHEN no event is pending THEN the system SHALL return `oldestPendingAt: null`, and WHEN no event was ever sent THEN `lastSuccessfulSyncAt: null`
8. HLT-08: The system SHALL never include a tenant id in the health response
9. HLT-09: The system SHALL keep HTTP 200 regardless of the sync numbers (no `"degraded"` status)
10. HLT-10: IF a database query of the check rejects THEN the system SHALL respond 503 with `status: "unavailable"`, `database: { status: "down", version: null, maxConnections: null, openConnections: null, latencyMs: null }`, `sync: null` and `server` unchanged
11. HLT-11: IF the database queries do not settle within 1000 ms THEN the system SHALL respond 503 with the same body as HLT-10
12. HLT-12: IF the check fails THEN the system SHALL not include the underlying error message in the body and SHALL log it with `console.error`
13. HLT-13: The OpenAPI document SHALL describe `GET /health` with `200` and `503` responses referencing the `Health` schema, served from `/`

**Independent Test**: `curl -i /health` returns 200 with the full shape; stopping the database returns 503 with the down shape.

---

## Edge Cases

- WHEN `sync_events` is empty THEN the system SHALL return `{ pending: 0, failed: 0, oldestPendingAt: null, lastSuccessfulSyncAt: null }`
- WHEN `GET /api/v1/health` is called THEN the system SHALL respond 404 `NOT_FOUND` (AD-024)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HLT-01 | P1: Health check | Execute | Verified |
| HLT-02 | P1: Health check | Execute | Verified |
| HLT-03 | P1: Health check | Execute | Verified |
| HLT-04 | P1: Health check | Execute | Verified |
| HLT-05 | P1: Health check | Execute | Verified |
| HLT-06 | P1: Health check | Execute | Verified |
| HLT-07 | P1: Health check | Execute | Verified |
| HLT-08 | P1: Health check | Execute | Verified |
| HLT-09 | P1: Health check | Execute | Verified |
| HLT-10 | P1: Health check | Execute | Verified |
| HLT-11 | P1: Health check | Execute | Verified |
| HLT-12 | P1: Health check | Execute | Verified |
| HLT-13 | P1: Health check | Execute | Verified |

**Coverage:** 13 total, 13 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Every test of prompt 06 passes against the real test database
- [ ] A rejected or hung query answers 503 without waiting a real second in tests
