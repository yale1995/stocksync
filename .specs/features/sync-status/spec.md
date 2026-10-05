# Sync Status Specification

## Problem Statement

Part B item 5 requires a way to see the sync status per tenant: pending, sent and failed counts and the last successful sync. The Part C sync status page polls it. This feature adds `GET /sync/status`, scoped to the caller's tenant, reading `sync_events` (features `sync-events` and `sync-worker`).

## Goals

- [ ] An admin or operator sees their tenant's counts per status, the last successful sync and the latest failures
- [ ] No data of another tenant is ever visible

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Manual retry of failed events | README future improvement |
| Per-request history (`sync_batches`) | README future improvement |
| Frontend status page | Part C |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/05-sync.md` | Applied as written | Agreed with the user | y |
| Role check | `requireAuth` only | Admin and operator are the only roles, same as `GET /products` | y (plan approved) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Sync status ⭐ MVP

**Acceptance Criteria**:

1. STS-01: WHEN an admin or operator calls `GET /sync/status` THEN the system SHALL respond 200 with exactly `{ pending, sent, failed, superseded, lastSuccessfulSyncAt, failedEvents }`
2. STS-02: The system SHALL count the caller's tenant events per status, returning 0 for a status with no events
3. STS-03: The system SHALL set `lastSuccessfulSyncAt` to the greatest `sent_at` of the tenant as an ISO string, or `null` when nothing was sent
4. STS-04: The system SHALL return in `failedEvents` the at most 20 events whose status is currently `failed`, ordered by `updated_at desc, id desc`, each exactly `{ id, productId, sku, trigger, attempts, lastError, updatedAt }`
5. STS-05: The system SHALL take the tenant only from the token and never include events of another tenant
6. STS-06: IF the request has no cookie or an invalid token THEN the system SHALL respond 401 `UNAUTHORIZED`

---

## Edge Cases

- WHEN a tenant has no events THEN all counts SHALL be 0, `lastSuccessfulSyncAt` `null` and `failedEvents` empty
- WHEN an event that was `failed` becomes `superseded` THEN it SHALL leave `failedEvents`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| STS-01 | P1: Sync status | Execute | Implemented |
| STS-02 | P1: Sync status | Execute | Implemented |
| STS-03 | P1: Sync status | Execute | Implemented |
| STS-04 | P1: Sync status | Execute | Implemented |
| STS-05 | P1: Sync status | Execute | Implemented |
| STS-06 | P1: Sync status | Execute | Implemented |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm test` (with `db:up`) and `pnpm lint:check` pass
