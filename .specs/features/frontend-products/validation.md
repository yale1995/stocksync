# Frontend Products Validation

## Validation: frontend-products - PASS (iteration 2)

**Date**: 2026-10-06. **Verdict**: PASS. Iteration 0 failed on G1-G3 (4 surviving mutants), closed by test-only changes in `apps/frontend/src/routes/_auth/products.test.tsx` plus `src/test/setup.ts`.

## Iteration 2 (re-verification, flake fix)

Test-only changes after the iteration-1 PASS: the timing-window debounce test in `products.test.tsx` was replaced by `components/products/product-filters.test.tsx` (fake timers); the skeleton test (`PT:109` `await waitFor(() => expect(requests).toHaveLength(1))` before `respond()` at `PT:110`) and the keep-previous-rows test now wait for the request before releasing it; the `asyncUtilTimeout` change in `test/setup.ts` was reverted (`setup.ts` diff is again only the Radix jsdom shims).

- **PROD-09 now**: `PFT` = `components/products/product-filters.test.tsx`: `PFT:17-18` `fireEvent.change` "ca", `PFT:19` advance 200 ms, `PFT:20` change "cam", `PFT:21-22` advance 299 ms then `expect(onChange).not.toHaveBeenCalled()`, `PFT:24-26` advance 1 ms then `toHaveBeenCalledTimes(1)` and `toHaveBeenCalledWith({ search: "cam" })`. Deterministic (fake timers, no real waiting). URL wiring and page reset remain at `PT:220-240` (`searchStr` `"?search=cam"`, last request `page` `"1"`).
- **Gate** (repo root, exit 0): typecheck clean; frontend tests 7 files, **70 passed**, 0 failed, 0 skipped (unchanged vs iteration 1: one timing test removed, one fake-timer unit test added); biome "Checked 140 files. No fixes applied."; vite build succeeded.
- **Stability**: gate run plus 6 further full unmutated runs in the scratch copy: 7/7 green, 70 tests each (no flake).
- **Sensor** (fresh scratch copy, `node_modules` symlinked, deleted afterwards):

| # | Mutant | Iteration 2 |
| - | ------ | ----------- |
| M04 | debounce 0 | killed (`PFT:13`, `PT:220`) |
| M04c | debounce 100 | killed (`PFT:13`) |
| M04e | debounce 299 | killed (`PFT:13`, fires before +300) |
| M04f | debounce 301 | killed (`PFT:13`, not called at +300) |
| M04d | debounce 500 | killed (`PFT:13`) |
| M04b | debounce 1000 | killed (`PFT:13`) |
| M22b, M22c, M22 | 4, 6, 0 skeleton rows | killed (`PT:91`) |
| M16 | input syncs from URL while typing | killed (`PT:259`) |
| M08a, M08b | Next +2, Previous -2 | killed (`PT:361`, `PT:409`) |
| M01, M03, M05b, M07, M10b, M11, M13, M14, M15 | earlier kills, spot-checked | killed |

**Sensor (iteration 2)**: 25/25 re-run mutants killed, including the debounce boundary at 299 and 301 ms. Overall: 0 survivors, 1 equivalent (M09).
**Isolation**: `git status --porcelain` identical before and after the iteration-2 gate and sensor; only this `validation.md` was written.

---

## Iteration 1 (history)

- **G1 closed**: `PT:243-257` "waits about 300 ms before updating the URL": `PT:250` `setTimeout` 150 ms then `PT:251` `expect(router.state.location.searchStr).toBe("")`; `PT:254-255` `waitFor(() => expect(searchStr).toBe("?search=b"), { timeout: 300, interval: 10 })`, so the update must land within about 450 ms. M04b (1000) and M04d (500) now fail this test.
- **G2 closed**: `PT:409` "goes from page 3 to page 2 with Previous". M08b now fails it.
- **G3 closed**: `PT:259-277` "keeps what the user is typing when the URL changes mid-typing": types "cam", `act(router.navigate({to:"/products",search:{search:"old"}}))`, `PT:272` `expect(input).toHaveValue("cam")`, `PT:273-275` `searchStr` ends `"?search=cam"`, `PT:276` value still `"cam"`. M16 now fails it.
- **O1 closed**: `PT:107` `expect(skeletonRows).toHaveLength(5)`; 4 and 6 rows are killed (M22b, M22c).
- **O3**: `index.css:60` rewords an inaccurate comment from frontend-setup; intentional, left as is.
- **Gate** (repo root, exit 0): typecheck clean; frontend tests 6 files, **70 passed**, 0 failed, 0 skipped (68 + 2 new); biome "Checked 139 files. No fixes applied."; vite build succeeded.
- **Flake note**: `test/setup.ts:14` now sets `configure({ asyncUtilTimeout: 3000 })`. In the first run on a cold fresh scratch copy 1 of 70 tests failed once (unmutated); 3 re-runs of the same copy, the real-tree gate and all later runs were green. The 450 ms window in `PT:254` is timing-sensitive on a loaded machine; watch for flakiness (not a spec gap).
- **Sensor** (fresh scratch copy, `node_modules` symlinked, deleted afterwards):

| # | Mutant | Iteration 1 |
| - | ------ | ----------- |
| M16 | `PF:82` guard removed (input syncs from URL while typing) | **killed** (`PT:259`) |
| M04b | debounce 1000 | **killed** (`PT:243`) |
| M04d | debounce 500 | **killed** (`PT:243`) |
| M08b | Previous `page - 2` | **killed** (`PT:409`) |
| M04a, M04c | debounce 0, 100 | killed |
| M22b, M22c | 4 and 6 skeleton rows | killed (`PT:91`) |
| M01, M03, M05a, M06a, M07, M08a, M11, M13, M14, M15 | earlier kills, spot-checked | killed |

**Sensor (iteration 1)**: 18/18 re-run mutants killed. Overall: 31 distinct iteration-0 mutants plus M22b/M22c = 33; 32 killed, 1 equivalent (M09), 0 survivors.
**Isolation**: `git status --porcelain` identical before and after the iteration-1 gate and sensor (baseline includes ` M .specs/STATE.md`); only this `validation.md` was written.

---

## Iteration 0 (history, verdict FAIL at the time)

**Date**: 2026-10-06
**Spec**: `.specs/features/frontend-products/spec.md` (PROD-01..PROD-16, 2 edge cases, Assumptions); source of truth `docs/prompts/06-frontend.md` (Screens > Products, Tests > Products list); rules `CLAUDE.md`
**Diff range**: uncommitted working tree on `feat/frontend-products` vs `HEAD` (`37fa6e0`, frontend-auth committed). Modified: `index.css` (comment text only), `routes/_auth/products.tsx`, `test/fixtures.ts`, `test/setup.ts`. Untracked: `api/products.ts`, `components/pagination.tsx`, `components/products/*`, `lib/format.ts`, `lib/format.test.ts`, `routes/_auth/products.test.tsx`. `components/ui/{select,skeleton,table}.tsx` are vendored shadcn (build gate only); `docs/` ignored.
**Verifier**: independent sub-agent (author != verifier)

All 16 ACs and both edge cases are implemented and asserted on the spec's exact values, and the gate is green. The verdict is FAIL because the sensor found 4 surviving behavior mutants (G1..G4) in 4 distinct behaviors; the product code itself shows no defect. 31 mutants injected: 26 killed, 4 survived as real gaps, 1 survived as equivalent (M09).

Paths (under `apps/frontend/src/`): `PT` = `routes/_auth/products.test.tsx`, `FT` = `lib/format.test.ts`, `R` = `routes/_auth/products.tsx`, `API` = `api/products.ts`, `PF` = `components/products/product-filters.tsx`, `TB` = `components/products/products-table.tsx`, `PG` = `components/pagination.tsx`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 shadcn primitives | Done | `components/ui/{table,select,skeleton}.tsx` compile in the build gate |
| T2 Price formatting | Done | `lib/format.ts:6-8`, `FT` |
| T3 Products query and table | Done | `API:1-33`, `R:1-77`, `TB:27-208`, `PT:54-204` |
| T4 Search and stock filter | Done | `PF:31-120`, `PT:207-331` |
| T5 Pagination | Done | `PG:12-61`, `PT:333-441` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| PROD-01 table name, columns, API order | name "Products"; SKU, Name, Price, Stock; rows in API order | `PT:50` `findByRole("table",{name:"Products"})`; `PT:62` `expect(headers).toEqual(["SKU","Name","Price","Stock"])`; `PT:65-74` rows `toEqual([["CAM-P","Camiseta P","$49.90","25"],["BON-01","Boné","$29.90","Out of stock0"]])` | PASS |
| PROD-02 USD via Intl | `4990` -> `$49.90` | `PT:72` `"$49.90"`; `FT:6-9` `expect(formatCents(cents)).toBe(expected)` for 4990, 0, 5, 123456789 (`$1,234,567.89`) | PASS |
| PROD-03 badge when stock 0 | "Out of stock" badge next to the stock | `PT:83-88` `getByText("Out of stock")` `toBeVisible()` in the stock-0 row, `queryByText("Out of stock")` `not.toBeInTheDocument()` in the stock-25 row; `PT:73` cell text `"Out of stock0"` | PASS |
| PROD-04 loading | skeleton rows and status "Loading products…" | `PT:101-103` `findByRole("status")` `toHaveTextContent("Loading products…")`; `PT:104-106` `querySelectorAll("[data-slot=skeleton]").length` `toBeGreaterThan(0)`; `PT:110` status gone after load | PASS (spec says "skeleton rows"; test asserts >0 skeleton nodes, not 5 rows; the 5 is a spec assumption row, see observation O1) |
| PROD-05 error + Retry | error message, "Retry" button; Retry requests the same page again | `PT:130-132` `findByRole("alert")` `toHaveTextContent("Internal server error")`; `PT:134` click "Retry"; `PT:137` `expect(requests).toHaveLength(2)`; `PT:138-139` `queryOf(requests[1])` `toEqual(queryOf(requests[0]))`, `page` `"2"` | PASS |
| PROD-06 empty, no filter | "No products yet" | `PT:146` `findByText("No products yet")` `toBeVisible()`; `PT:147-149` no "Clear filters" button | PASS |
| PROD-07 empty with filter | "No products match your filters" + "Clear filters" removing `search`, `outOfStock`, `page` | `PT:162-163` text visible; `PT:164` click; `PT:167` `expect(router.state.location.searchStr).toBe("")`; `PT:168` `expect(queryOf(requests.at(-1))).toEqual({page:"1",limit:"20"})`; both `search` and `outOfStock` paths (`PT:153-154`) | PASS |
| PROD-08 request with URL values and limit 20 | `search`, `outOfStock`, `page`, `limit=20` | `PT:176-181` `expect(queryOf(requests[0])).toEqual({search:"bon",outOfStock:"true",page:"2",limit:"20"})` | PASS |
| PROD-09 search debounce 300 ms, reset page | URL `search` updated 300 ms after last keystroke; `page` -> 1 | `PT:228` `searchStr` `toBe("?search=cam")` from `?page=3`; `PT:231-235` last request `toEqual({search:"cam",page:"1",limit:"20"})`; `PT:238-239` no "c"/"ca" requests; `PT:249` `searchStr` `toBe("")` after 150 ms; `PT:252` `toBe("?search=b")` eventually | PASS lower bound only; upper bound of 300 ms not discriminated (G1, M04b/M04d) |
| PROD-10 stock filter, reset page | absent / `false` / `true`; page -> 1 | `PT:288` `searchStr` `toBe(searchStr)` (`""`, `"?outOfStock=false"`, `"?outOfStock=true"`, from `page=2`); `PT:291` last request `page` `toBe("1")`; `PT:293` `outOfStock` `toBe(param)` (`null` for All) | PASS |
| PROD-11 invalid param -> default | `page` 1, no stock filter | `PT:194` `expect(queryOf(requests[0])).toEqual({page:"1",limit:"20"})` for `page=abc`, `page=0`, `page=1.5`, `outOfStock=maybe`; `PT:202` numeric `search=123` -> `"123"` | PASS |
| PROD-12 labels | search input and stock filter labelled | `PT:211` `findByLabelText("Search products")` with `maxLength` `"100"`; `PT:215` `getByRole("combobox",{name:"Stock"})` `toHaveTextContent("All")` | PASS |
| PROD-13 "Page X of Y" | Y = max(1, ceil(total/20)) | `PT:339-343` + `PT:351` `getByText(label)` for 45/1, 45/2, 45/3 ("Page 1 of 3".."Page 3 of 3"), 20/1 ("Page 1 of 1"), 21/2 ("Page 2 of 2") | PASS for ceil; the `max(1, ...)` branch is unreachable through the UI (equivalent M09, O2) |
| PROD-14 Next / Previous | page set to next / previous number | `PT:372-381` after Next: `search` `toMatchObject({search:"item",page:2})`, last request `toEqual({search:"item",page:"2",limit:"20"})`; `PT:385` after Previous `searchStr` `toBe("?search=item")` | PASS for Next; Previous is only checked on 2 -> 1, where `page - 2` collapses to 1 through the schema fallback (G2, M08b) |
| PROD-15 disabled ends | Previous off on page 1, Next off on last | `PT:356` `expect(previousButton).toHaveProperty("disabled", !previous)`; `PT:357` same for next, over 5 total/page combinations | PASS |
| PROD-16 keep previous rows | previous rows visible while next page loads | `PT:408` `getByText("Item 1")` `toBeVisible()`; `PT:409-412` table `aria-busy` `"true"`; `PT:413` no status; `PT:416-417` page 2 replaces page 1 | PASS |

**Edge cases**

- [x] Page past the end: `PT:430` `findByText("This page is empty")` `toBeVisible()`; `PT:431` no "No products yet"; `PT:432` click "Go to first page"; `PT:435` `searchStr` `toBe("?outOfStock=false")`; `PT:436-440` request `toEqual({outOfStock:"false",page:"1",limit:"20"})`
- [x] Back navigation restores URL values: `PT:301` search value `"cam"`; `PT:317-322` after back: value `"cam"` and combobox `"Out of stock"`; `PT:325-329` after second back: combobox `"All"`, value `"cam"`
- [~] Assumption "typing while a previous search is in flight: the input keeps what the user typed" (spec Assumptions row): no test (G3, M16)

**Status**: 16/16 ACs and 2/2 edge cases covered on spec values; 0 spec-precision gaps (each AC names an exact string, value or state). Discrimination gaps: PROD-09 upper bound (G1), PROD-14 Previous (G2), Assumptions row "typing while in flight" (G3).

---

## Discrimination Sensor

Isolation: `src`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `components.json` of `apps/frontend` copied to the session scratchpad (`.../scratchpad/fe`) with `node_modules` symlinked. Unmutated copy passed 68/68 first. Each mutant is one exact-occurrence replacement (the script rejects a replacement unless the pattern occurs exactly once), run with `vitest run` (all 6 files), and the original file re-copied before the next mutant. Scratch deleted afterwards.

| # | File:line | Mutant | Result |
| - | --------- | ------ | ------ |
| M01 | `API:16` | `limit` not sent | killed (10 failed; `PT:171`, `PT:184`, `PT:152`) |
| M02 | `API:6` | `PAGE_SIZE` 20 -> 25 | killed (14 failed) |
| M03 | `R` (`setFilters`) | filter change does not reset `page` | killed (4 failed; `PT:220`, `PT:256`) |
| M04a | `PF:13` | debounce 300 -> 0 | killed (`PT:220`, `PT:242`) |
| M04c | `PF:13` | debounce 300 -> 100 | killed (`PT:242`) |
| **M04b** | `PF:13` | debounce 300 -> 1000 | **survived** (G1) |
| **M04d** | `PF:13` | debounce 300 -> 500 | **survived** (G1) |
| M05a | `PF:17` | "In stock" -> `outOfStock: true` | killed (`PT:256`, `PT:297`) |
| M05b | `PF:18` | "Out of stock" -> `outOfStock: false` | killed (`PT:256`, `PT:297`) |
| M06a | `R:22` | invalid page falls back to 2 | killed (4 failed) |
| M06b | `R:22` | `.min(1)` dropped (page 0 allowed) | killed (`PT:184` page=0) |
| M06c | `R:22` | `.int()` dropped (1.5 allowed) | killed (`PT:184` page=1.5) |
| M06d | `R:21` | invalid `outOfStock` not caught | killed (`PT:184` outOfStock=maybe) |
| M07 | `API:32` | `keepPreviousData` removed | killed (`PT:388`) |
| M08a | `PG:49` | Next -> `page + 2` | killed (`PT:361`, `PT:388`) |
| **M08b** | `PG:39` | Previous -> `page - 2` | **survived** (G2) |
| M09 | `PG:19` | `Math.max(1, ...)` removed | survived, equivalent: the pagination renders only when `data.length > 0`, so `total >= 1` and `ceil(total/20) >= 1` already; see O2 |
| M09b | `PG:19` | `ceil` -> `floor` | killed (4 failed) |
| M10a | `PG:38` | Previous disabled `page <= 1` -> `page < 1` | killed (`PT:338`) |
| M10b | `PG:48` | Next disabled `>=` -> `>` | killed (`PT:338`) |
| M11 | `TB:70` | empty-state branches swapped (filters vs none) | killed (`PT:142`, `PT:152`) |
| M12 | `TB:56` | page-past-end branch removed | killed (`PT:420`) |
| M13 | `TB:46` | Retry does not refetch | killed (`PT:113`) |
| M14 | `TB:111` | badge for stock > 0 | killed (`PT:54`, `PT:77`) |
| M15 | `format.ts:7` | `cents / 10` | killed (`FT`, 3 cases) |
| **M16** | `PF:82` | search input syncs from URL while typing (guard removed) | **survived** (G3) |
| M17 | `TB:41` | error message not shown | killed (`PT:113`) |
| M18 | `R` (`onClearFilters`) | Clear filters keeps `search`/`outOfStock` | killed (`PT:152`) |
| M19 | `API:18` | `outOfStock` not sent | killed (5 failed) |
| M20 | `API:17` | `search` not sent | killed (5 failed) |
| M21 | `TB:141` | `aria-busy` removed | killed (`PT:388`) |
| M22 | `TB:169` | zero skeleton rows | killed (`PT:91`, `PT:113`) |
| M23 | `R` (`setPage`) | `setPage` always 1 | killed (`PT:361`, `PT:388`) |
| M24 | `R` (`onFirstPage`) | "Go to first page" goes to 2 | killed (`PT:420`) |

**Sensor depth**: expanded (31 mutants across route, query, filters, table, pagination, formatting)
**Outcome (iteration 0)**: 26/31 killed, 4 survived as real gaps (M04b, M04d, M08b, M16), 1 equivalent (M09); not ready.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (small components, each used once or twice; no unused abstraction) | PASS |
| Surgical changes (`setup.ts` jsdom shims are required by Radix Select; `fixtures.ts` adds `makeProduct`/`page`; `index.css` is a comment-text edit only, unrelated to the feature) | PASS (O3) |
| No scope creep (read-only table; no sort, no page size, no CRUD) | PASS |
| Matches patterns (co-located `*.test.tsx`, MSW via `renderApp`, `signedIn`, tabs/double quotes via biome) | PASS |
| Comments only for the why (`R:12-13`, `PF:79-80`) | PASS |
| Spec-anchored outcome check (asserted strings, values and URLs match the spec verbatim) | PASS |
| Per-layer coverage (formatter 1:1; route covers happy, edge, error paths) | PASS, minus G1..G3 |
| Every test maps to a spec requirement (`PT:54` PROD-01/02, `PT:77` PROD-03, `PT:91` PROD-04, `PT:113` PROD-05, `PT:142` PROD-06, `PT:152` PROD-07, `PT:171` PROD-08, `PT:184` PROD-11, `PT:197` PROD-11/assumption, `PT:207` PROD-12, `PT:220` and `PT:242` PROD-09, `PT:256` PROD-10, `PT:297` edge 2, `PT:338` PROD-13/15, `PT:361` PROD-14, `PT:388` PROD-16, `PT:420` edge 1, `FT` PROD-02) | PASS |
| Documented guidelines followed: `CLAUDE.md` (comments rule; backend/DB rules n/a); no frontend testing rules | PASS |
| Discrimination sensor | FAIL (M04b, M04d, M08b, M16) |

Observations (not gaps):

- O1: PROD-04 and the Assumptions row say "5 skeleton rows"; the test asserts only `> 0` skeleton nodes (`PT:104-106`). M22 (zero rows) is killed, but 4 or 6 rows would pass. The AC itself only says "skeleton rows"; left as a note.
- O2: `Math.max(1, ...)` at `PG:19` can never matter because `R:66` renders `Pagination` only when the page has rows (`total >= 1`). PROD-13's `max(1, ...)` is therefore satisfied vacuously; the page-past-end state shows "This page is empty" instead of "Page X of Y". Consistent with the spec's edge case, so not a defect.
- O3: `index.css:60` only rewords a comment; unrelated to this feature (trivial).

---

## Gate Check

- **Gate command**: `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` (repo root)
- **Result**: exit 0. Typecheck clean; frontend tests 6 files, **68 passed**, 0 failed, 0 skipped; biome "Checked 139 files. No fixes applied."; vite build succeeded ("built in 181ms")
- **Test count before feature**: 36 (frontend-auth final)
- **Test count after feature**: 68
- **Delta**: +32 (`PT` 28 with `it.each` expansions, `FT` 4); no test removed or weakened
- **Skipped tests**: none
- **Failures**: none
- Note: the router generator prints "does not export a Route" warnings for `*.test.tsx` files under `routes/` (also for the pre-existing `login.test.tsx`); harmless, not a gap.

---

## Fix Plans

### G1 (Minor, test-only): debounce upper bound not asserted (PROD-09; M04b, M04d)

- **Root cause**: `PT:242-254` asserts the URL is still empty at 150 ms and eventually updates (default `waitFor` timeout 1000 ms), so a 500 ms or 1000 ms debounce passes. The spec says "300 ms after the last keystroke".
- **Fix task**: in `PT`, use fake timers (or poll) to assert `searchStr` is still `""` at 299 ms and `"?search=b"` by about 350 ms; or assert the delay window with a tolerance. Done when M04b and M04d fail and M04a/M04c still fail.
- **Priority**: Minor

### G2 (Minor, test-only): Previous off by more than one (PROD-14; M08b)

- **Root cause**: `PT:383-385` only goes from page 2 to 1; `page - 2` is 0, which the schema turns into 1, so the mutant is invisible.
- **Fix task**: in `PT:361`, navigate to page 3 first (or start at `?search=item&page=3`), click Previous and assert `page` is 2 (`router.state.location.search` `toMatchObject({page:2})` and request `page` `"2"`). Done when M08b fails.
- **Priority**: Minor

### G3 (Minor, test-only): input must not follow the URL while typing (Assumptions row 32; M16)

- **Root cause**: no test types across a debounce commit and asserts the input keeps the typed text. Removing the `pending.current` guard at `PF:82` passes all 68 tests.
- **Fix task**: in `PT`, type "ca", wait for the URL to commit, keep typing "t" before the URL update re-renders (or pause the response and type more), and assert `getByLabelText("Search products")` `toHaveValue("cat")` while the URL still shows the older search. Done when M16 fails and the back/forward test (`PT:297`) still passes.
- **Priority**: Minor

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| PROD-01..PROD-08 | Implemented | Verified |
| PROD-09 | Implemented | Verified (iteration 1, G1 closed) |
| PROD-10..PROD-13 | Implemented | Verified |
| PROD-14 | Implemented | Verified (iteration 1, G2 closed) |
| PROD-15, PROD-16 | Implemented | Verified |
| Assumption "typing while in flight" | - | Verified (iteration 1, G3 closed) |

---

## Isolation

`git status --porcelain` captured before any gate or sensor work (baseline includes ` M .specs/STATE.md`). After the gate, the sensor and scratch cleanup it is identical to the baseline (`diff` empty). The gate's `vite build` writes only to the git-ignored `apps/frontend/dist`. No `git stash`; all mutations ran in the scratch copy, which was deleted. Only this `validation.md` was written by the Verifier.

---

## Summary

**Overall**: Not Ready (iteration 0: FAIL on sensor survivors; product code correct, all fixes are test-only)

**Spec-anchored check**: 16/16 ACs and 2/2 edge cases matched the spec outcome; 0 spec-precision gaps; 3 discrimination gaps (G1 PROD-09 upper bound, G2 PROD-14 Previous, G3 input-follows-URL assumption)
**Sensor**: 26/31 killed, 4 survived (M04b, M04d, M08b, M16), 1 equivalent (M09)
**Gate**: 68 frontend tests passed; typecheck, biome and build clean

**What works**: table columns and API order, USD formatting, stock-0 badge, skeleton and status, error with Retry refetch, three empty states, URL params to request with `limit=20`, invalid-param fallbacks, page reset on filter and search, stock filter mapping, Page X of Y, disabled ends, previous rows kept while loading, back/forward restore.

**Issues found**: G1, G2, G3 (add three assertions in `routes/_auth/products.test.tsx`).

**Next steps**: route G1..G3 to an implementer as test-only fix tasks, then re-verify.
