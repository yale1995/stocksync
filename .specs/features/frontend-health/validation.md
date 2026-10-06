# Frontend Health Validation

## Validation: frontend-health - PASS

**Verdict**: PASS. All 16 ACs (FHLT-01..FHLT-16) and the 3 edge cases are implemented and asserted on the spec-defined values. The gate is green (166 tests, typecheck, lint, build). The sensor killed 26 of 27 mutants. The one survivor (M13) only changes output when exactly one of `openConnections`/`maxConnections` is null, and the backend never sends that (`apps/backend/src/modules/health/health.service.ts:24-30` sets all database fields to null together). It is minor and does not block.

**Date**: 2026-10-06
**Spec**: `.specs/features/frontend-health/spec.md` (FHLT-01..FHLT-16, 3 edge cases, Assumptions table)
**Diff range**: uncommitted working tree on `feat/frontend-health` vs `main` (HEAD `945d81f`). Modified: `apps/frontend/src/api/client.ts`, `apps/frontend/src/api/types.ts`, `apps/frontend/src/routeTree.gen.ts` (generated). Untracked: `apps/frontend/src/api/health.ts`, `apps/frontend/src/components/health/health-report.tsx`, `apps/frontend/src/routes/health.tsx`, `apps/frontend/src/routes/health.test.tsx`. `docs/` ignored (unrelated).
**Verifier**: independent sub-agent (author != verifier)

Paths (under `apps/frontend/src/`): `HT` = `routes/health.test.tsx`, `R` = `routes/health.tsx`, `REP` = `components/health/health-report.tsx`, `API` = `api/health.ts`, `CL` = `api/client.ts`.

**Full-path evidence**: `apps/frontend/src/routes/health.test.tsx:94` (FHLT-01/16), `apps/frontend/src/routes/health.test.tsx:232` (FHLT-08), `apps/frontend/src/routes/health.test.tsx:317` (FHLT-12 and the 401 edge case), `apps/frontend/src/routes/health.test.tsx:378` (FHLT-15 and the warning-cleared edge case), `apps/frontend/src/api/health.ts:8` (503 accepted as data).

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| Inline execution (no tasks.md) | Done | Spec traceability marks all 16 as Implemented. Every changed file is in the scope above. |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| FHLT-01 request `GET <API origin>/health` once, no session | one request to `http://localhost:3333/health`; stays on `/health` with no user | `HT:99` `expect(router.state.location.pathname).toBe("/health")`; `HT:100` `expect(attempts()).toBe(1)`. The only handler is `HT:11` `http://localhost:3333/health`, so any other URL fails (M24 killed, 18/18 failing) | PASS |
| FHLT-02 200 ok -> "Operational" | "Operational" | `HT:119` `getByText("Operational")`; `HT:120` `queryByText("Unavailable")` `toBeNull()` | PASS |
| FHLT-03 server Status "Up", Version, Node.js, Environment, Provider | exact values per label | `HT:128-132` `field("Server", label)` `toHaveTextContent(/^Up$/)`, `/^1\.4\.0$/`, `/^v24\.11\.0$/`, `/^development$/`, `/^local$/` | PASS |
| FHLT-04 db up: "Up", Version, "<n> ms", "<open> of <max>" | "Up", "18.0", "3 ms", "7 of 100" | `HT:140-143` `toHaveTextContent(/^Up$/)`, `/^18\.0$/`, `/^3 ms$/`, `/^7 of 100$/` | PASS |
| FHLT-05 Pending, Failed, relative + absolute `<time dateTime>` | "4", "2", "2 minutes ago"/"1 minute ago", absolute text in `TIME` with ISO `dateTime` | `HT:153-154` `/^4$/`, `/^2$/`; `HT:157` `"2 minutes ago"`; `HT:159` `tagName` `toBe("TIME")`; `HT:160` `toHaveAttribute("dateTime", "2026-10-06T14:03:09.000Z")`; same for last sync at `HT:163-166` | PASS |
| FHLT-06 null oldest -> "None", null last -> "Never" | "None"; "Never" | `HT:183` `toHaveTextContent(/^None$/)`; `HT:184-186` `/^Never$/`; `HT:187` no `time` in the section | PASS (M06/M07 swaps killed) |
| FHLT-07 "Checked at <time>" of the last response | response time in a `<time>` | `HT:198` `toHaveTextContent("Checked at Oct 6, 2026, 2:05:09 PM")`; `HT:199-201` `tagName` `"TIME"` | PASS |
| FHLT-08 503 -> "Unavailable" + server section as for 200 | "Unavailable", no alert, same server values | `HT:237` `getByText("Unavailable")`; `HT:238` no "Operational"; `HT:239` `queryByRole("alert")` `toBeNull()`; `HT:240-244` the five server values | PASS (M01 killed) |
| FHLT-09 db down: "Down", "—" for Version, Latency, Connections | "Down", "—" x3 | `HT:252-255` `/^Down$/`, `/^—$/` x3 | PASS (see S1 for partial-null) |
| FHLT-10 sync null -> message | "Unavailable while the database is down." | `HT:263-265` `section("Sync queue")` `toHaveTextContent(/^Sync queueUnavailable while the database is down\.$/)` | PASS |
| FHLT-11 loading: skeletons + status "Checking system health…" | `role="status"` text; skeletons; both gone after load | `HT:280-281` `findByText("Checking system health…")` `toHaveAttribute("role","status")`; `HT:282` skeleton count `toBe(6)`; `HT:283` no Server region; `HT:287` status gone after load | PASS |
| FHLT-12 no response / non-200/503 -> "Could not check system health", message, Retry refetches | alert title + error message; Retry makes a 2nd request and shows the report | `HT:290-338` `it.each` (no response, 500, 401): `HT:327` `toHaveTextContent("Could not check system health")`; `HT:328` the message; `HT:331` click Retry; `HT:334` `attempts()` `toBe(2)`; `HT:335` alert gone | PASS (M22 killed) |
| FHLT-13 Refresh -> new values and new "Checked at" | latency 3 -> 9 ms; "Checked at ... 2:06:30 PM" | `HT:369` `/^9 ms$/`; `HT:372-374` `"Checked at Oct 6, 2026, 2:06:30 PM"`; `HT:375` `attempts` `toBe(2)` | PASS |
| FHLT-14 in flight: disabled, "Refreshing…" | disabled button named "Refreshing…" | `HT:364` `findByRole("button",{name:"Refreshing…"})`; `HT:365` `toBeDisabled()`; `HT:371` enabled "Refresh" afterwards | PASS (M16/M17 killed) |
| FHLT-15 refresh fails: keep data, warning in polite live region | exact text with the time of the last good check; data kept; no alert | `HT:394-396` `findByText("Could not refresh. Showing the check from Oct 6, 2026, 2:05:09 PM.")`; `HT:397-400` closest `[aria-live]` is `"polite"`; `HT:401` latency still `/^1 ms$/`; `HT:402` no alert | PASS (M18/M19/M21 killed) |
| FHLT-16 no refetch on interval, focus or reconnect | still 1 request after focus, reconnect and 60 s | `HT:102-108` focus toggle, online toggle, advance 60 000 ms; `HT:110` `attempts()` `toBe(1)` | PASS (M03/M04/M05 killed) |

**Status**: All 16 ACs covered with the spec-defined values. No spec-precision gaps: every AC either gives a literal (labels, messages, formats) or relies on an existing contract (`formatDateTime`/`formatRelative`, `ApiError` messages).

---

## Edge Cases

- [x] Refresh after a failed one succeeds -> warning removed: `HT:404-409` second Refresh, latency `/^3 ms$/`, `queryByText(/^Could not refresh/)` `toBeNull()` (M10 killed).
- [x] Failed > 0 uses the failure color with its "Failed" label; 0 does not: `HT:204-228` `it.each` `{2,true}`/`{0,false}`, `toHaveClass("text-destructive")` / `not.toHaveClass(...)`, value located through its `dt` "Failed" (M08/M09 killed).
- [x] 401 is an error (FHLT-12) and does not redirect to `/login`: `HT:312-315` row plus `HT:324` signed-in user via `setQueryData(meQuery...)` so the session-expiry handler would fire; `HT:329` and `HT:336` pathname `toBe("/health")` (M02 killed). Implementation: `CL:53-54` `isHealth` exemption.

---

## Discrimination Sensor

Isolated scratch: an `rsync` copy of the working tree (uncommitted changes included, `.git`/`node_modules`/`dist`/`docs` excluded) under the session scratchpad, with `node_modules` symlinked. Command per mutant: `pnpm exec vitest run src/routes/health.test.tsx` in the scratch's `apps/frontend`. Baseline in scratch: 18/18 green (also 2 more unmutated runs, both 18/18).

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M01 | `API:8` | `validateStatus` accepts only 200 (drop 503) | Killed (3 outage tests) |
| M02 | `CL:54` | remove `!isHealth` from the 401 handler | Killed (401 row) |
| M03 | `API:18` | `refetchOnWindowFocus: true` | Killed (`HT:110`) |
| M04 | `API:19` | `refetchOnReconnect: true` | Killed (`HT:110`) |
| M05 | `API:15` | add `refetchInterval: 30_000` | Killed (`HT:110`) |
| M06 | `REP:67` | oldest pending fallback "None" -> "Never" | Killed |
| M07 | `REP:70` | last sync fallback "Never" -> "None" | Killed |
| M08 | `REP:62` | failure color always on | Killed (failed 0 row) |
| M09 | `REP:62` | threshold `> 0` -> `> 2` | Killed (failed 2 row) |
| M10 | `R:122` | warning kept whenever data exists (not cleared after success) | Killed |
| M11 | `REP:30` | null version shows "" instead of "—" | Killed |
| M12 | `REP:32` | null latency not dashed ("null ms") | Killed |
| M13 | `REP:35` | connections dash needs both null (`\|\|` -> `&&`) | Survived (see S1) |
| M14 | `REP:37` | swap "<open> of <max>" | Killed |
| M15 | `R:84` | invert Operational/Unavailable | Killed (2 tests) |
| M16 | `R:60` | Refresh never disabled | Killed |
| M17 | `R:64` | no "Refreshing…" label | Killed |
| M18 | `R:98` | `isLoadingError` -> `isError` (refresh failure replaces data with the alert) | Killed |
| M19 | `R:22` | "Checked at" uses the error time | Killed |
| M20 | `REP:46` | sync-null message changed | Killed |
| M21 | `R:121` | drop `aria-live="polite"` | Killed |
| M22 | `R:110` | Retry does nothing | Killed (3 rows) |
| M23 | `REP:142` | absolute time rendered in `<span>` instead of `<time>` | Killed |
| M24 | `CL:30` | health URL relative to `/api/v1` (`"health"`) | Killed (18/18) |
| M25 | `R:140` | loading text without `role="status"` | Killed |
| M26 | `REP:124` | raw `up`/`down` instead of "Up"/"Down" | Killed (4 tests) |
| M27 | `API:17` | `retry: false` -> `retry: 3` | Killed (4 tests) |

**Sensor depth**: expanded (27 manual behavior-level mutants over every branch of the new code)
**Result**: 27 injected, 26 killed, 1 survived (M13, no observable effect for any response the backend sends) - PASS
**Isolation**: `git status --porcelain` of the real tree identical before and after the sensor (baseline ` M client.ts`, ` M types.ts`, ` M routeTree.gen.ts`, `??` for `.specs/features/frontend-health/`, `health.ts`, `components/health/`, `health.test.tsx`, `health.tsx`, `docs/`). Before cleanup, `diff -r` of the real `apps/frontend/src` against the scratch `src` was empty. No git worktree was created; the scratch directory was deleted. Only this `validation.md` was written in the real tree.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | Yes: one query module, one report component, one route |
| Surgical changes | Yes: `client.ts` adds only `HEALTH_URL` and the 401 exemption; `types.ts` adds only `Health` |
| No scope creep | Yes: no sidebar or login link, no polling (out-of-scope items respected) |
| Matches patterns | Yes: same building blocks as `/sync` (`useNow`, `formatRelative`/`formatDateTime`, Skeleton, Alert, live-region warning) |
| Spec-anchored outcome check | Yes |
| Per-layer coverage (route: happy + edge + error) | Yes: 200, 503, loading, network/500/401 errors, refresh success/failure/recovery |
| Every test maps to a spec requirement | Yes: the 18 tests map to FHLT-01..16 and the 3 edge cases |
| Documented guidelines | `CLAUDE.md` code-comment rule: the comments state reasons (`CL:29`, `CL:49-50`, `API:7`, `API:16`, `R:15`). Database rules not applicable |

---

## Gate Check

Run from the repo root on the real working tree:

- `pnpm --filter frontend test`: exit 0, 12 files, **166 passed**, 0 failed, 0 skipped (jsdom `scrollTo` "Not implemented" notices only)
- `pnpm typecheck`: exit 0 (3/3 turbo tasks successful)
- `pnpm lint:check`: exit 0, "Checked 168 files in 52ms. No fixes applied."
- `pnpm --filter frontend build`: exit 0, "built in 224ms", no router warnings
- **Test count before feature**: 148 (frontend-sync iteration 1)
- **Test count after feature**: 166
- **Delta**: +18, all in `apps/frontend/src/routes/health.test.tsx`; no existing test file changed

---

## Gaps (non-blocking)

### S1 (minor): partial-null connections untested

- **Root cause**: `Health.database` (`apps/frontend/src/api/types.ts`) lets `openConnections` and `maxConnections` be null on their own, but the only null fixture (`HT:42-48`) sets all of them to null. Mutant M13 (`REP:35` `||` -> `&&`) would render "null of 100" when only one is null.
- **Why non-blocking**: the backend only sends all-null (`apps/backend/src/modules/health/health.service.ts:24-30`) or all-set (`apps/backend/src/modules/health/health.repository.ts:19-20`), so the case cannot happen today.
- **Optional fix**: add a row with only `openConnections: null` that expects `/^—$/`, or make the `database` type a union of the up and down shapes.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| FHLT-01..FHLT-16 | Implemented | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 16/16 ACs and 3/3 edge cases matched the spec outcome; 0 spec-precision gaps
**Sensor**: 27 injected, 26 killed, 1 survived (M13, unreachable state, minor)
**Gate**: 166 passed, 0 failed; typecheck, lint and build clean

**What works**: public `/health` with no session; 503 rendered as data; 401 exempt from session expiry; no refetch on focus, reconnect or interval; loading, first error with Retry, refresh with a polite warning that clears.

**Issues found**: S1 (minor, optional).

**Next steps**: interactive UAT from the Success Criteria (API running -> "Operational"; Postgres stopped -> Refresh shows "Unavailable" and "Down"). Commit after the user approves.
