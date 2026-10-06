# Frontend Sync Status Specification

## Problem Statement

Admins need to trust that the ads never promote out-of-stock items, or see clearly when they might. This feature turns the `/sync` placeholder into a status page backed by `GET /api/v1/sync/status`, polled every 5 seconds: counts per status, the last successful sync, and the latest failed updates with their error. Source of truth: `docs/prompts/06-frontend.md` (Screens > Sync status, Tests > Sync status).

## Goals

- [ ] Sync health is readable at a glance: how many updates are pending, sent, failed and superseded, and when the last one succeeded
- [ ] Every failed update is listed with what failed and why
- [ ] The page stays current without a reload and never hides that a refresh failed

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Manual retry of failed events | README future improvement (API has no endpoint) |
| Server-sent events | Polling is the agreed trade-off (README) |
| History or charts | Not required |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/06-frontend.md` and the direction contract | Applied as written | Agreed with the user | y |
| Count layout | One card with four labelled figures (Pending, Sent, Failed, Superseded), not four separate cards | Direction contract: no grey-on-grey card grids; one card reads as one status | y |
| Failed count emphasis | Red figure plus the word "Failed" only when the count is above 0 | State never relies on color alone; red is reserved for failures | y |
| Date format | Absolute: `Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium" })` in the browser's time zone; relative: `Intl.RelativeTimeFormat("en", { numeric: "auto" })` in seconds, minutes, hours or days | UI is English; tests pin the time zone to UTC | y |
| Relative time rounding | Truncated to whole units: 90 minutes → "1 hour ago", 36 hours → "yesterday" | The common convention for "time ago"; found as an undefined rule by the Verifier | y |
| Trigger labels | `product_created` → "Product created", `stock_changed` → "Stock changed", `price_changed` → "Price changed", `product_deleted` → "Product deleted" | Readable names for the backend enum | y |
| Missing `lastError` | "—" | The column stays aligned and does not invent an error | y |
| Refresh-failed warning | "Could not refresh. Showing data from <time>; retrying every 5 seconds." in a polite live region, above the data | Non-blocking (prompt); says what is shown and what happens next | y |
| Polling while the tab is hidden | TanStack Query's default (`refetchIntervalInBackground: false`) | Prompt: the default already pauses polling | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Sync status at a glance ⭐ MVP

**User Story**: As an admin, I want to see the sync counts and the last successful sync so that I know whether the ads are up to date.

**Acceptance Criteria**:

1. SYNC-01: The page SHALL request `GET /sync/status` and show the pending, sent, failed and superseded counts, each with its label
2. SYNC-02: WHEN `lastSuccessfulSyncAt` is set THEN the page SHALL show it as relative time and as an absolute timestamp in a `<time dateTime>` element
3. SYNC-03: WHEN `lastSuccessfulSyncAt` is `null` THEN the page SHALL show "Never"
4. SYNC-04: WHILE the page is open the system SHALL request `GET /sync/status` again every 5 seconds and show the new values

**Independent Test**: render `/sync` with an MSW status; advance 5 s and see the counts change.

---

### P1: Failed updates ⭐ MVP

**User Story**: As an admin, I want to see each failed update with its error so that I can tell what is wrong.

**Acceptance Criteria**:

1. SYNC-05: The page SHALL list `failedEvents` in a table named "Failed updates" with the columns SKU, Trigger, Attempts, Last error and Updated at, in the API's order
2. SYNC-06: The system SHALL show each trigger with its readable label
3. SYNC-07: WHEN `failedEvents` is empty THEN the page SHALL show "No failed updates"

**Independent Test**: render a status with two failed events and one with none.

---

### P1: Loading and errors ⭐ MVP

**User Story**: As an admin, I want loading and failures to be explicit so that I never read stale data as current.

**Acceptance Criteria**:

1. SYNC-08: WHILE the first status is loading the page SHALL show skeletons and a status "Loading sync status…"
2. SYNC-09: IF the first request fails THEN the page SHALL show the error message and a "Retry" button that requests the status again
3. SYNC-10: IF a refetch fails while data is shown THEN the page SHALL keep the last data and show "Could not refresh. Showing data from <time>; retrying every 5 seconds."
4. SYNC-11: WHEN a later refetch succeeds THEN the page SHALL remove that warning

**Independent Test**: fail the second poll and see the warning over the first data; let the third succeed and see it disappear.

---

## Edge Cases

- WHEN `lastError` is `null` THEN the row SHALL show "—"
- WHEN the failed count is 0 THEN the figure SHALL NOT use the failure color

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SYNC-01 | P1: Sync status at a glance | Execute | Implemented |
| SYNC-02 | P1: Sync status at a glance | Execute | Implemented |
| SYNC-03 | P1: Sync status at a glance | Execute | Implemented |
| SYNC-04 | P1: Sync status at a glance | Execute | Implemented |
| SYNC-05 | P1: Failed updates | Execute | Implemented |
| SYNC-06 | P1: Failed updates | Execute | Implemented |
| SYNC-07 | P1: Failed updates | Execute | Implemented |
| SYNC-08 | P1: Loading and errors | Execute | Implemented |
| SYNC-09 | P1: Loading and errors | Execute | Implemented |
| SYNC-10 | P1: Loading and errors | Execute | Implemented |
| SYNC-11 | P1: Loading and errors | Execute | Implemented |

**Coverage:** 11 total, 11 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm --filter frontend test`, `pnpm lint:check` and `pnpm --filter frontend build` pass
- [ ] With the backend and the worker running, a sale moves the counts on `/sync` within 5 seconds without a reload
