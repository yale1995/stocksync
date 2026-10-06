# Frontend Health Specification

## Problem Statement

`GET /health` already reports the server, the database and the sync queue, but only as JSON. This feature adds a public `/health` page to the frontend that renders that response. It must keep working when the database is down, which is when the login stops working and the page is most useful.

## Goals

- [ ] One page shows whether the API and its database are up, with the server, database and sync queue details of `GET /health`
- [ ] A database outage (503) reads as a state of the system, not as a broken page

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Link in the sidebar or on the login page | User chose a public page reached only by typing `/health` |
| Polling or refetch on focus/reconnect | User chose fetch on open plus a manual refresh |
| Backend changes to `GET /health` | The endpoint is done (`.specs/features/health`) |
| History, charts or per-tenant numbers | Per-tenant numbers live on `/sync` |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Access | Public route outside `_auth`, with no session check and no link anywhere | User's choice; the page must work when login cannot | y |
| Refresh | One request on open and a "Refresh" button; no polling, no refetch on window focus or reconnect | User's choice | y |
| Health URL | `new URL("/health", env.VITE_API_URL)`: the API origin plus `/health`, no new env var | `/health` is served at the API root, outside `/api/v1` (AD-024); `VITE_API_URL` already names the API | n |
| 503 handling | The health request accepts 200 and 503 as data; any other status or no response is an error | The 503 body is a full health report with `status: "unavailable"` | n |
| Layout | Standalone page like `/login` (no sidebar, which needs a user): header with "System health", the overall status, "Checked at <time>" and the Refresh button, then three sections: Server, Database, Sync queue | Same building blocks as `/sync` (PageHeader, cards, Skeleton, Alert) | n |
| Overall status labels | `ok` → "Operational", `unavailable` → "Unavailable", always as text next to any color | State never relies on color alone (direction contract) | n |
| Field labels | Server: Status, Version, Node.js, Environment, Provider. Database: Status, Version, Latency ("<n> ms"), Connections ("<open> of <max>"). Sync queue: Pending, Failed, Oldest pending, Last successful sync | Readable names for the response fields | n |
| Nulls | Any `null` database field shows "—"; `oldestPendingAt: null` shows "None"; `lastSuccessfulSyncAt: null` shows "Never" | Matches `/sync` ("Never") and keeps rows aligned | n |
| Dates | Relative time plus absolute timestamp in `<time dateTime>`, with the existing `src/lib/format.ts` helpers | Same format as `/sync` | n |
| `sync: null` | The Sync queue section shows "Unavailable while the database is down." | The API omits the queue when it cannot read it | n |
| Response typing | Hand-written `Health` type in `src/api/types.ts`, no runtime validation | Frontend decision: hand-written API types | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Health at a glance ⭐ MVP

**User Story**: As store staff or a reviewer, I want one page that shows the health of the API, the database and the sync queue so that I can tell whether the system works without reading JSON.

**Why P1**: It is the whole feature.

**Acceptance Criteria**:

1. FHLT-01: WHEN `/health` opens THEN the page SHALL request `GET <API origin>/health` once, without requiring a session
2. FHLT-02: WHEN the response is 200 with `status: "ok"` THEN the page SHALL show the overall status "Operational"
3. FHLT-03: The page SHALL show `server` as Status "Up", Version, Node.js, Environment and Provider
4. FHLT-04: WHEN `database.status` is `"up"` THEN the page SHALL show Status "Up", Version, Latency as "<latencyMs> ms" and Connections as "<openConnections> of <maxConnections>"
5. FHLT-05: WHEN `sync` is present THEN the page SHALL show Pending and Failed counts, Oldest pending and Last successful sync as relative time with an absolute timestamp in a `<time dateTime>` element
6. FHLT-06: WHEN `oldestPendingAt` is `null` THEN the page SHALL show "None", and WHEN `lastSuccessfulSyncAt` is `null` THEN it SHALL show "Never"
7. FHLT-07: The page SHALL show "Checked at <time>" for the moment the last response arrived

**Independent Test**: render `/health` without a session and an MSW 200 health body; every section shows its values.

---

### P1: Database outage ⭐ MVP

**User Story**: As store staff, I want a 503 from the health check to show what is down so that I know the problem is the database, not the page.

**Why P1**: The outage is the moment the page exists for.

**Acceptance Criteria**:

1. FHLT-08: WHEN the response is 503 with `status: "unavailable"` THEN the page SHALL show the overall status "Unavailable" and the server section as for a 200
2. FHLT-09: WHEN `database.status` is `"down"` THEN the page SHALL show Status "Down" and "—" for Version, Latency and Connections
3. FHLT-10: WHEN `sync` is `null` THEN the Sync queue section SHALL show "Unavailable while the database is down."

**Independent Test**: answer the MSW handler with the 503 body; the page shows "Unavailable", "Down" and the sync message, and no error alert.

---

### P1: Loading, errors and refresh ⭐ MVP

**User Story**: As store staff, I want loading, failures and refreshes to be explicit so that I never read an old check as current.

**Why P1**: Required state handling for every page.

**Acceptance Criteria**:

1. FHLT-11: WHILE the first response is loading the page SHALL show skeletons and a status "Checking system health…"
2. FHLT-12: IF the first request gets no response or a status other than 200 or 503 THEN the page SHALL show "Could not check system health", the error message and a "Retry" button that requests the health again
3. FHLT-13: WHEN the user presses "Refresh" THEN the page SHALL request the health again and show the new values and the new "Checked at" time
4. FHLT-14: WHILE a refresh is in flight the "Refresh" button SHALL be disabled and read "Refreshing…"
5. FHLT-15: IF a refresh fails while data is shown THEN the page SHALL keep the last data and show "Could not refresh. Showing the check from <time>." in a polite live region
6. FHLT-16: The page SHALL NOT request the health again on its own (no interval, window focus or reconnect refetch)

**Independent Test**: fail the second request after a successful first; the warning appears over the first data; a third successful refresh removes it.

---

## Edge Cases

- WHEN a refresh after a failed one succeeds THEN the page SHALL remove the refresh warning
- WHEN the sync Failed count is above 0 THEN the figure SHALL use the failure color together with its "Failed" label; WHEN it is 0 it SHALL NOT use the failure color
- IF the API answers 401 THEN the page SHALL treat it as an error (FHLT-12) and SHALL NOT redirect to `/login`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| FHLT-01 | P1: Health at a glance | Execute | Implemented |
| FHLT-02 | P1: Health at a glance | Execute | Implemented |
| FHLT-03 | P1: Health at a glance | Execute | Implemented |
| FHLT-04 | P1: Health at a glance | Execute | Implemented |
| FHLT-05 | P1: Health at a glance | Execute | Implemented |
| FHLT-06 | P1: Health at a glance | Execute | Implemented |
| FHLT-07 | P1: Health at a glance | Execute | Implemented |
| FHLT-08 | P1: Database outage | Execute | Implemented |
| FHLT-09 | P1: Database outage | Execute | Implemented |
| FHLT-10 | P1: Database outage | Execute | Implemented |
| FHLT-11 | P1: Loading, errors and refresh | Execute | Implemented |
| FHLT-12 | P1: Loading, errors and refresh | Execute | Implemented |
| FHLT-13 | P1: Loading, errors and refresh | Execute | Implemented |
| FHLT-14 | P1: Loading, errors and refresh | Execute | Implemented |
| FHLT-15 | P1: Loading, errors and refresh | Execute | Implemented |
| FHLT-16 | P1: Loading, errors and refresh | Execute | Implemented |

**Coverage:** 16 total, 16 implemented (inline execution, no tasks.md), 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm --filter frontend test`, `pnpm lint:check` and `pnpm --filter frontend build` pass
- [ ] With the API running, `/health` opened without logging in shows "Operational"; with Postgres stopped, Refresh shows "Unavailable" and "Down"
