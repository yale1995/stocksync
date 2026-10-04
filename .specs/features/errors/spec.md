# Custom Errors Specification

## Problem Statement

The API has no shared error model. Routes need a single way to signal HTTP failures and a single handler that turns them into a stable JSON shape, without leaking stacks or SQL.

## Goals

- [ ] Every error response has the shape `{ error: { code, message } }`
- [ ] Unknown errors never expose internal details

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| 404 handler for unknown routes | Accepted limitation: Express default 404 |
| Malformed JSON body as 400 | Accepted limitation: ends up as 500 |
| Specific error codes (e.g. `SKU_ALREADY_EXISTS`) or a 405 error | The six classes are the whole set |
| `details` field in responses | Response shape is fixed to `code` + `message` |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Class and handler code | Exactly as written in `docs/prompts/01-errors-auth-multitenancy.md` | Agreed with the user | y |
| Error-handler tests | Throwaway Express app with test routes and the handler | Prompt asks for throwaway routes | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Consistent error responses ⭐ MVP

**User Story**: As an API client, I want every failure to come back in one shape so that I can handle errors uniformly.

**Why P1**: Every later module throws these errors.

**Acceptance Criteria**:

1. ERR-01: WHEN a route throws an `AppError` subclass THEN the system SHALL respond with that error's status and the body `{ error: { code, message } }` using its code and message
2. ERR-02: The system SHALL provide `ValidationError` (400 `VALIDATION_ERROR`), `UnauthorizedError` (401 `UNAUTHORIZED`), `ForbiddenError` (403 `FORBIDDEN`), `NotFoundError` (404 `NOT_FOUND`), `ConflictError` (409 `CONFLICT`) and `InternalServerError` (500 `INTERNAL_SERVER_ERROR`), each with a default message overridable by the caller
3. ERR-03: WHEN a route fails Zod validation THEN the system SHALL respond 400 `VALIDATION_ERROR` with every issue joined as `path: message` separated by `; `
4. ERR-04: IF a route throws an error that is not an `AppError` THEN the system SHALL respond 500 with `{ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } }` and no stack or original message
5. ERR-05: WHEN an async route rejects THEN the system SHALL handle the rejection with the same error handler
6. ERR-06: The system SHALL keep `GET /health` responding 200 `{ status: "ok" }` after moving it to `src/modules/health/`

**Independent Test**: supertest against a throwaway app with the handler, plus the health test.

---

## Edge Cases

- IF a caller passes a custom message to a subclass THEN the system SHALL return that message instead of the default

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ERR-01 | P1: Consistent error responses | Execute | Pending |
| ERR-02 | P1: Consistent error responses | Execute | Pending |
| ERR-03 | P1: Consistent error responses | Execute | Pending |
| ERR-04 | P1: Consistent error responses | Execute | Pending |
| ERR-05 | P1: Consistent error responses | Execute | Pending |
| ERR-06 | P1: Consistent error responses | Execute | Pending |

**Coverage:** 6 total, 6 mapped, 0 unmapped

---

## Success Criteria

- [ ] typecheck, tests and `pnpm lint:check` pass
