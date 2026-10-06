# Frontend Sync Status Validation

## Validation: frontend-sync - PASS (iteration 1)

**Verdict**: PASS. Iteration 0 passed with minor gaps S1-S4; the coordinator closed S1-S3 and documented S4. Re-verification confirms the closures and the behavior change (`formatRelative` truncates with `Math.trunc`).

## Iteration 1 (re-verification)

- **Behavior change reviewed**: `apps/frontend/src/lib/format.ts:28-32` now uses `Math.trunc` for seconds and for the unit value (90 minutes -> "1 hour ago", 36 hours -> "yesterday"); recorded in the spec Assumptions. `apps/frontend/vite.config.ts` adds `routeFileIgnorePattern: "\\.test\\.tsx?$"` (build warning-free).
- **Existing suites**: `apps/frontend/src/routes/_auth.test.tsx` and `apps/frontend/src/auth/session.test.tsx` diffs are still only the `emptySyncStatus` import and `beforeEach`.
- **S1 closed**: `apps/frontend/src/lib/format.test.ts` gained rows for 1 second, 90 minutes ("1 hour ago"), 36 hours ("yesterday") and 2 days 23 hours ("2 days ago"). Round/floor mutants now fail them.
- **S2 closed**: `apps/frontend/src/routes/_auth/sync.test.tsx:248` `expect(document.querySelectorAll("[data-slot=skeleton]")).toHaveLength(9)`. M19b, M19c, M19d each killed.
- **S3 closed**: `apps/frontend/src/routes/_auth/sync.test.tsx:110` "keeps the relative time current while the data does not change" (`:118` "30 seconds ago", `:120` advance 40 000 ms, `:123` "1 minute ago"). M37 killed.
- **S4 open, accepted**: `retry: false` (`apps/frontend/src/api/sync.ts`) stays unobservable because the test QueryClient disables retries (M38 still survives; minor).
- **Gate** (repo root, exit 0): typecheck clean; frontend tests 11 files, **148 passed**, 0 failed, 0 skipped (143 + 5); biome "Checked 158 files in 53ms. No fixes applied."; vite build succeeded in 218 ms with no router warnings.
- **Stability**: gate run plus 3 unmutated runs in a fresh scratch copy: 4/4 green at 148 tests.
- **Sensor** (fresh scratch copy, `node_modules` symlinked): 41 mutants re-run.

| Mutant | Iteration 1 |
| ------ | ----------- |
| M33a unit `trunc` -> `round` | killed (2 days 23 hours row) |
| M33b unit `trunc` -> `floor` | killed (4 rows) |
| M33d seconds `trunc` -> `floor` | killed (`sync.test.tsx:110`) |
| M33c seconds `trunc` -> `round` | survived: only sub-second fractions differ; timestamps have whole seconds in all tests (minor, S5) |
| M33e unit `trunc` -> `ceil` | survived: identical to `trunc` for past times; no future-timestamp row (minor, S5) |
| M19b, M19c, M19d | killed (count of 9) |
| M37 | killed |
| M01-M04, M06, M07, M09, M11-M18, M20-M22, M23b-M32, M34-M36, M43 (earlier kills) | all killed |

**Sensor (iteration 1)**: 41 re-run, 39 killed, 2 survived (M33c, M33e: unobservable or future-time only, outside every AC). Overall: 0 survivors on a spec-defined outcome; M38 (S4) and M33c/M33e (S5) remain as minor, non-blocking.
**Isolation**: `git status --porcelain` identical before and after the iteration-1 gate and sensor (baseline includes ` M .specs/STATE.md`); `diff -r` of the real `src` vs scratch `src` empty; only this `validation.md` was written.

---

## Iteration 0 (history, verdict PASS with minor gaps; counts below are from iteration 0)


**Verdict**: PASS. All 11 ACs and both edge cases are implemented and asserted on the spec-defined values; the gate is green and stable (4/4 runs, 143 tests); the sensor killed 40 of 45 injected mutants, and the 5 survivors are minor or equivalent (see Sensor). No fix task is blocking.

**Date**: 2026-10-06
**Spec**: `.specs/features/frontend-sync/spec.md` (SYNC-01..SYNC-11, 2 edge cases, Assumptions); source `docs/prompts/06-frontend.md` (Screens > Sync status, Tests > Sync status); lesson L-001
**Diff range**: uncommitted working tree on `feat/frontend-sync` (stacked on committed `feat/frontend-sales`). Modified: `src/routes/_auth/sync.tsx`, `src/lib/format.ts`, `src/lib/format.test.ts`, `vite.config.ts`, `src/test/handlers.ts`, `src/routes/_auth.test.tsx`, `src/auth/session.test.tsx`. Untracked: `src/api/sync.ts`, `src/components/sync/*`, `src/hooks/use-now.ts`, `src/routes/_auth/sync.test.tsx`. `docs/` ignored.
**Verifier**: independent sub-agent (author != verifier)

**Full-path evidence**: `apps/frontend/src/routes/_auth/sync.test.tsx:258` (SYNC-10/11), `apps/frontend/src/routes/_auth/sync.test.tsx:119` (SYNC-04), `apps/frontend/src/routes/_auth/sync.test.tsx:187` (SYNC-06), `apps/frontend/src/lib/format.test.ts:26` (relative units), `apps/frontend/src/routes/_auth/sync.tsx:31` (state handling under test).

Paths (under `apps/frontend/src/`): `ST` = `routes/_auth/sync.test.tsx`, `FT` = `lib/format.test.ts`, `R` = `routes/_auth/sync.tsx`, `API` = `api/sync.ts`, `TBL` = `components/sync/failed-events-table.tsx`, `SUM` = `components/sync/sync-summary.tsx`, `FMT` = `lib/format.ts`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Date formatting | Done | `FMT` `formatDateTime`, `formatRelative`; `FT:15-38`; `TZ=UTC` in `vite.config.ts` |
| T2 Status summary | Done | `API`, `SUM`, `R`; `ST:68-140` |
| T3 Failed updates table | Done | `TBL`; `ST:142-211` |
| T4 Loading, error, refresh warning | Done | `R:31-110`; `ST:213-284` |

Confirmed: the diffs of `routes/_auth.test.tsx` and `auth/session.test.tsx` only add `beforeEach(() => { emptySyncStatus(); })` and the import; no assertion was touched. `emptySyncStatus` (`test/handlers.ts`) returns zero counts, `null` last sync and no failed events.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| SYNC-01 request status, four counts with labels | `GET /sync/status`; Pending/Sent/Failed/Superseded each with its value | `ST:74-77` `expect(figure("Pending")).toHaveTextContent("3")` / `"42"` / `"2"` / `"7"` (dt label found by `getByText(label,{selector:"dt"})`); the only handler is `GET /api/v1/sync/status` (`ST:43`), so a different path would not render | PASS |
| SYNC-02 set timestamp: relative + absolute in `<time dateTime>` | "2 minutes ago", "Oct 6, 2026, 2:05:09 PM", `dateTime` = ISO | `ST:105` `expect(time.tagName).toBe("TIME")`; `ST:106` `toHaveAttribute("dateTime", lastSuccessfulSyncAt)`; `ST:107` `toHaveTextContent("2 minutes ago")`; `ST:104` finds the absolute text; `FT:17-19` `toBe("Oct 6, 2026, 2:05:09 PM")` | PASS |
| SYNC-03 null: "Never" | "Never" | `ST:115` `toHaveTextContent(/^Never$/)`; `ST:116` no `<time>` | PASS |
| SYNC-04 poll every 5 s, show new values | no 2nd request at 4 s, one at 5 s, new counts | `ST:132-133` after 4 000 ms `expect(attempts()).toBe(1)`; `ST:135-138` after +1 000 ms Pending `"0"`, Sent `"45"`, `attempts()` `toBe(2)` | PASS (kills 3 s, 10 s, none) |
| SYNC-05 table "Failed updates", 5 columns, API order | exact header and rows | `ST:166` `findByRole("table",{name:"Failed updates"})`; `ST:174-184` `expect(rows).toEqual([[SKU,Trigger,Attempts,Last error,Updated at],["CAM-P","Stock changed","5","Ads service answered 500","Oct 6, 2026, 2:05:09 PM"],["BON-01","Price changed","3","—","Oct 6, 2026, 1:00:00 PM"]])` (first row has the later timestamp, so reversal and sorting are detected) | PASS |
| SYNC-06 readable trigger labels (L-001: every variant) | the four labels | `ST:187-200` `it.each` over all 4 enum values, `within(table).getByText(label)` `toBeVisible()` | PASS (all four variants, each killed individually) |
| SYNC-07 empty: "No failed updates" | text; no table | `ST:206` `findByText("No failed updates")` `toBeVisible()`; `ST:207-209` no `table` | PASS |
| SYNC-08 loading: skeletons + status "Loading sync status…" | status text, skeletons, both gone after load | `ST:227-229` `findByRole("status")` `toHaveTextContent("Loading sync status…")`; `ST:230-232` skeleton count `toBeGreaterThan(0)`; `ST:237-238` gone and 0 skeletons after load | PASS (skeleton check is "any", see S2) |
| SYNC-09 first failure: message + Retry refetches | alert with API message; click triggers a 2nd request and the data | `ST:250-251` alert contains "Could not load sync status" and "Internal server error"; `ST:252` click `Retry`; `ST:255` `expect(attempts()).toBe(2)` after the data appears | PASS |
| SYNC-10 refetch fails: keep data + warning | last data kept; exact warning text with the time of the last data; not blocking | `ST:274` `toHaveTextContent("Could not refresh. Showing data from Oct 6, 2026, 2:05:09 PM; retrying every 5 seconds.")`; `ST:276` inside `[aria-live=polite]`; `ST:277` Pending still `"1"`; `ST:278` no `role="alert"` | PASS |
| SYNC-11 later success removes the warning | warning gone, new data | `ST:282` Pending `"3"`; `ST:283` `queryByText(/^Could not refresh\./)` `not.toBeInTheDocument()` | PASS |
| Edge: `lastError` null shows "—" | "—" | `ST:158` fixture `lastError: null`; `ST:183` row `["BON-01","Price changed","3","—",...]` | PASS |
| Edge: failed 0 not in failure color | no `text-destructive` | `ST:81-86` `expect(figure("Failed").className).not.toContain("text-destructive")`; `ST:89-95` non-zero contains it | PASS |

**Status**: 11/11 ACs and 2/2 edge cases matched the spec outcome on exact values; 0 spec-precision gaps. The warning text and the Assumption "word Failed plus red" are asserted verbatim (the "Failed" word is the always-present `dt` label, which is the spec's reading: `ST:76`).

---

## Discrimination Sensor

Isolation: `apps/frontend` (without `node_modules`, `dist`) copied to the scratchpad `fe` with `node_modules` symlinked; the unmutated copy was 143/143 three times first. Each mutant is one exact-occurrence replacement (the script skips unless the pattern occurs once), run with `vitest run src/routes/_auth/sync.test.tsx src/lib/format.test.ts`, then the original is re-copied. After the run `diff -r` of the real `src` vs scratch `src` was empty.

| # | File | Mutant | Result |
| - | ---- | ------ | ------ |
| M01 | `API` | `refetchInterval` removed | killed (`ST:119`, `ST:258`) |
| M02 | `API` | interval 10 000 | killed (`ST:119`, `ST:258`) |
| M03 | `API` | interval 3 000 | killed (`ST:119`, `ST:258`) |
| M04 | `SUM` | pending/sent values swapped | killed (3 tests) |
| M05 | `SUM` | failed/superseded values swapped | killed (2 tests) |
| M06 | `SUM` | failed color at 0 (`> 0` -> `>= 0`) | killed (`ST:80`) |
| M07 | `SUM` | failed color never applied | killed (`ST:89`) |
| M08 | `SUM` | "Never" for a set timestamp | killed (`ST:97`) |
| M09 | `SUM` | `<time dateTime>` removed | killed (`ST:97`) |
| M10 | `SUM` | relative text replaced by absolute | killed (`ST:97`) |
| M11-M14 | `TBL` | each of the four trigger labels wrong (one mutant per label) | 4/4 killed (`ST:187` row for each; `ST:142` also for stock/price) |
| M15 | `TBL` | `lastError` null -> "" | killed (`ST:142`) |
| M16 | `TBL` | rows reversed | killed (`ST:142`) |
| M17 | `TBL` | empty state never shown | killed (`ST:202`) |
| M18 | `R` | loading `role="status"` paragraph removed | killed (`ST:213`) |
| M19b/c/d | `R` | one skeleton group removed at a time | survived (each); removing all three kinds: killed (`ST:213`). See S2 |
| M20 | `R` | Retry does not refetch | killed (`ST:241`) |
| M21 | `R` | warning never shown | killed (`ST:258`) |
| M22 | `R` | warning has `role="alert"` | killed (`ST:258`) |
| M23b | `R` | warning latched after a later success | killed (`ST:258`) |
| M23, M41 | `R` | `dataUpdateCount` / `failureCount` variants | survived: equivalent mutants (those counters do not make the warning reappear after a success); M23b is the real "not cleared" mutant |
| M24 | `R` | refetch failure replaces data by the error block | killed (`ST:258`) |
| M25 | `R` | warning outside the polite live region | killed (`ST:258`) |
| M26 | `R` | warning time = now, not last data time | killed (`ST:258`) |
| M42 | `R` | warning time = epoch | killed (`ST:258`) |
| M43 | `R` | summary hidden while the warning shows | killed (`ST:258`) |
| M36 | `R` | error message hidden in first-load error | killed (`ST:241`) |
| M27-M29 | `FMT` | minute/hour/day thresholds +1 s | 3/3 killed (`FT:26`) |
| M30 | `FMT` | `>=` -> `>` | killed (3 rows) |
| M31 | `FMT` | hour unit -> minute | killed (`FT:26`) |
| M32 | `FMT` | sign flipped | killed (8 rows) |
| M33 | `FMT` | `Math.round` -> `Math.floor` on the unit value | **survived** (S1) |
| M34 | `FMT` | `numeric: "always"` | killed ("now", "yesterday") |
| M35 | `FMT` | `dateStyle: "short"` | killed (`FT:15`, `ST:97`, `ST:142`) |
| M39 | `TBL` | attempts + 1 | killed (`ST:142`) |
| M40 | `TBL` | SKU column shows the id | killed (`ST:142`) |
| M37 | `useNow` | interval never updates `now` | **survived** (S3) |
| M38 | `API` | `retry: false` removed | **survived** (S4) |

**Sensor depth**: expanded (>= 10 required): 45 mutants run. 40 killed. 5 survived: M33 (S1), M19b/c/d counted as one (S2), M37 (S3), M38 (S4); M23 and M41 are equivalent mutants. 0 survivors on a spec AC outcome.
**Result**: PASS (every survivor is outside a stated AC value or is a non-discriminating "presence" check)

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (`SyncSummary`, `FailedEventsTable`, `useNow` each used once; `SYNC_POLL_INTERVAL_MS` exported but only used in `API`) | PASS |
| Surgical changes (`format.ts` appended; `handlers.ts` helper; the two existing suites got only a `beforeEach`) | PASS |
| No scope creep (no retry endpoint, no SSE, no history) | PASS; `useNow(10_000)` keeps the relative time current between polls, small and not in the spec (S3) |
| Matches patterns (co-located tests, MSW through `renderApp`, `it.each` tables, tabs via biome) | PASS |
| Comments only for the why (`API` retry note, `handlers.ts` backdrop note, `vite.config.ts` TZ note) | PASS |
| Spec-anchored outcome check (warning text, labels, row values, `dateTime` asserted verbatim) | PASS |
| Per-layer coverage (formatting: every unit and boundary; route: every AC and edge, every trigger) | PASS; rounding between units is not covered (S1) |
| Every test maps to a spec requirement (`ST:69` SYNC-01, `:80`/`:89` edge, `:97` -02, `:110` -03, `:119` -04, `:143` -05, `:187` -06, `:202` -07, `:214` -08, `:241` -09, `:258` -10/-11; `FT` -02) | PASS, no unclaimed tests |
| Lesson L-001 (every enum variant table-tested) | PASS: all four triggers in `ST:187`, each killed |
| Documented guidelines followed: `CLAUDE.md` (comments rule; backend/DB rules n/a), `docs/prompts/06-frontend.md` Tests > Sync status | PASS |

Observations (not gaps):

- O1: `pnpm --filter frontend build` prints TanStack Router warnings that `routes/_auth.test.tsx` and `routes/login.test.tsx` do not export a Route. Pre-existing for those files (this feature adds `routes/_auth/sync.test.tsx`, which is covered by the same pattern); build still exits 0.
- O2: `.specs/STATE.md` became modified in the working tree after the baseline was captured; the Verifier did not touch it (same as in frontend-sales).

---

## Edge Cases

- [x] `lastError` null shows "—": `ST:183`
- [x] Failed count 0 does not use the failure color: `ST:86`

---

## Gate Check

- **Gate command**: `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` (repo root)
- **Result**: exit 0. Typecheck clean; frontend tests 11 files, **143 passed**, 0 failed, 0 skipped; biome clean; vite build succeeded ("built in 199ms")
- **Test count before feature**: 119 (frontend-sales final)
- **Test count after feature**: 143
- **Delta**: +24 (`ST` 15, `FT` +9: 1 absolute + 8 relative rows); no test removed, no assertion weakened (diffs of `_auth.test.tsx` and `session.test.tsx` are `beforeEach` only)
- **Skipped tests**: none
- **Stability**: 1 real-tree gate run, 1 further real-tree run, 3 unmutated scratch runs: 5/5 green at 143 tests (fake-timer polling tests did not flake)

---

## Fix Plans (non-blocking, optional)

### S1 (Minor, test-only): relative-time rounding between units (SYNC-02; M33)

- **Root cause**: `FT:26-34` rows are exact multiples of a unit, so `Math.round` vs `Math.floor` is not observable.
- **Fix task**: add rows such as 90 minutes ago (rounds to "2 hours ago") and 36 hours ago ("2 days ago"). Done when M33 fails.

### S2 (Minor, test-only): skeleton presence is an "any" check (SYNC-08; M19b/c/d)

- **Root cause**: `ST:230-232` only asserts at least one `[data-slot=skeleton]`; removing any one group still passes.
- **Fix task**: assert the count (for example 9 skeletons: 4 x 2 + 1) or each group. Done when each removal fails.

### S3 (Minor, test-only): `useNow` ticking (not in an AC; M37)

- **Root cause**: no test advances time beyond the poll with unchanged data to see the relative text age ("2 minutes ago" -> "3 minutes ago").
- **Fix task**: with fake timers and a constant timestamp, advance 60 s and assert the text changed. Done when M37 fails. Alternatively drop `useNow` if the poll refetch is considered enough (it re-renders every 5 s only when data changes, so the text would otherwise freeze).

### S4 (Minor, test-only): `retry: false` on the status query (SYNC-10 "retrying every 5 seconds"; M38)

- **Root cause**: the test `QueryClient` (via `renderApp`) already disables retries, so the per-query option is not observable; in production without it a failed poll would retry with backoff before the warning shows.
- **Fix task**: assert `syncStatusQuery.retry === false` or render with a client that keeps default retries. Done when M38 fails.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SYNC-01..SYNC-11 | Implemented | Verified |

---

## Isolation

`git status --porcelain` captured before any gate or sensor work (`scratchpad/baseline.txt`). After the gate, stability runs and sensor it differs only by ` M .specs/STATE.md`, which appeared during the run and was not touched by the Verifier (O2); every file under `apps/frontend` is unchanged and `diff -r` of the real `src` vs the scratch `src` is empty. The gate's `vite build` writes only to the git-ignored `apps/frontend/dist`. No `git stash`; all mutations ran in the scratch copy. Only this `validation.md` was written by the Verifier.

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 11/11 ACs and 2/2 edge cases matched the spec outcome; 0 spec-precision gaps
**Sensor**: 45 mutants; 40 killed, 5 survived (4 minor gaps S1-S4, plus 2 equivalent mutants counted separately above), 0 on a spec-defined outcome
**Gate**: 143 frontend tests passed, 5/5 stable runs; typecheck, biome and build clean

**What works**: counts and labels, failed color only above 0, last sync as relative + `<time dateTime>` + absolute, "Never", 5 s polling (3 s / 10 s / none all killed), failed table in API order with all four trigger labels and "—", empty state, loading status and skeletons, error + Retry, refresh warning (exact text, polite live region, not an alert, data kept, cleared on success).

**Issues found**: S1..S4, all minor and test-only.

**Next steps**: optionally add S1-S4 assertions; otherwise ready to commit.
