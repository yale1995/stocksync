# Frontend Sales Validation

## Validation: frontend-sales - PASS (iteration 1)

**Verdict**: PASS. Iteration 0 failed on G1-G4 (5 surviving mutants); closed by test-only changes in `apps/frontend/src/routes/_auth/sales.new.test.tsx` and the new `apps/frontend/src/components/sales/product-picker.test.tsx` (`PPT`).

## Iteration 1 (re-verification)

- **Full-path evidence**: `apps/frontend/src/routes/_auth/sales.new.test.tsx:453` (G1), `apps/frontend/src/routes/_auth/sales.new.test.tsx:406` (G3), `apps/frontend/src/components/sales/product-picker.test.tsx:48` (G4: `act(() => vi.advanceTimersByTime(299))`), `apps/frontend/src/routes/_auth/sales.new.tsx:81` (guard under test).
- **G1 closed**: `ST:453` "sends one request when the form is submitted twice before React re-renders" (two synchronous `fireEvent.submit` against a pending POST, asserts 1 request). M08 now fails it.
- **G2 closed**: the summary test (`ST:470`) waits for `catalog.detailRequests` to grow past the count captured after the picks settle, without re-picking. M15 now fails it.
- **G3 closed**: the it.each at `ST:378` asserts for both network and 500 rows the alert contains "Submitting again will not register it twice." (`ST:406`). M20c now fails the 500 row.
- **G4 closed**: `PPT` "searches 300 ms after the last keystroke, not before" (fake timers; no `["products","list",{search:"ca",page:1}]` query at +299 ms, present at +300 ms, never one for "c"). M13b/M13d/M13e now fail it.
- **Gate** (repo root, exit 0): typecheck clean; frontend tests 10 files, **119 passed**, 0 failed, 0 skipped (117 + 2); biome "Checked 153 files in 51ms. No fixes applied."; vite build succeeded.
- **Stability**: gate run plus 3 unmutated runs in a fresh scratch copy: 4/4 green at 119 tests.
- **Sensor** (fresh scratch copy, `node_modules` symlinked, deleted afterwards):

| # | Mutant | Iteration 1 |
| - | ------ | ----------- |
| M08 | double-submit ref guard removed | killed (`ST:453`) |
| M15 | no invalidation on 201 | killed (`ST:470`) |
| M20c | 5xx excluded from "outcome unknown" | killed (`ST:378` 500 row) |
| M13b, M13d, M13e | debounce 600, 200, 400 | killed (`PPT`) |
| M13, M13c | debounce 0, 1500 | killed (`PPT`, `ST:102`) |
| M01, M07, M09, M12, M16, M17, M18, M19, M20, M28, M30, M39 | earlier kills, spot-checked | killed |

**Sensor (iteration 1)**: 21/21 re-run mutants killed, including debounce at 200, 299-equivalent (200), 400, 600. Overall: 0 real survivors; M38, M43, M44 remain outside the spec (O1, O2).
**Isolation**: `git status --porcelain` identical before and after the iteration-1 gate and sensor (baseline includes ` M .specs/STATE.md`, the coordinator's edit); only this `validation.md` was written; scratch deleted.

---

## Iteration 0 (history, verdict FAIL at the time)

**Date**: 2026-10-06
**Spec**: `.specs/features/frontend-sales/spec.md` (SALE-01..SALE-22, 3 edge cases, Assumptions); source `docs/prompts/06-frontend.md` (Screens > New sale, Tests > New sale)
**Diff range**: uncommitted working tree on `feat/frontend-sales` (stacked on committed `feat/frontend-products`). Modified: `api/client.ts`, `api/products.ts`, `components/products/products-table.tsx`, `routes/_auth/sales.new.tsx`, `test/setup.ts`, `package.json`, lockfile. Untracked: `api/sales.ts`, `components/sales/*`, `components/out-of-stock-badge.tsx`, `hooks/use-debounced-value.ts`, `test/catalog.ts`, `routes/_auth/sales.new.test.tsx`. `components/ui/{popover,command}.tsx` vendored (build gate only); `docs/` ignored.
**Verifier**: independent sub-agent (author != verifier)

All 22 ACs and the 3 edge cases are implemented and the gate is green, but the critical-path sensor left 3 behavior gaps that matter (G1 double-submit guard, G2 invalidation on 201, G3 5xx outcome text) plus a debounce window gap (G4). The product code itself shows no defect; every fix is test-only.

Paths (under `apps/frontend/src/`): `ST` = `routes/_auth/sales.new.test.tsx`, `UT` = `components/sales/use-sale-form.test.ts`, `R` = `routes/_auth/sales.new.tsx`, `F` = `components/sales/use-sale-form.ts`, `P` = `components/sales/product-picker.tsx`, `C` = `components/sales/sale-lines-card.tsx`, `O` = `components/sales/sale-outcome.tsx`, `API` = `api/sales.ts`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 shadcn primitives | Done | `ui/popover.tsx`, `ui/command.tsx` compile in the build; `ResizeObserver` shim in `test/setup.ts` |
| T2 Form state and validation | Done | `F:36-66` reducer, `F:76-97` `validateLine`, `UT` |
| T3 Lines card with picker | Done | `C`, `P`, `ST:63-207` |
| T4 Inline stock check | Done | `R:58-76`, `C:91-99,126-128`, `ST:209-291` |
| T5 Submit with Idempotency-Key + T6 Outcomes | Done | implemented together (disclosed): `R:28-95`, `O`, `API:9-15`, `ST:349-648` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| SALE-01 page opens | one empty line + "Add product" | `ST:67` `expect(picker(1)).toHaveTextContent("Choose a product")`; `ST:68-70` no line 2; `ST:71` `getByRole("button",{name:"Add product"})` `toBeEnabled()`; `UT:27-28` one line `{product:undefined,quantity:""}` | PASS |
| SALE-02 Add product | adds an empty line | `ST:77-79` click then `expect(picker(2)).toHaveTextContent("Choose a product")` | PASS |
| SALE-03 Remove line N; disabled with one line | removes that line; last remove disabled | `ST:84-86` "Remove line 1" `toBeDisabled()`; `ST:91-99` after removing line 1, `picker(1)` name `"Product, line 1: Caneca"`, no line 2, remove disabled again; `UT:96-106` reducer returns same state | PASS |
| SALE-04 picker search after 300 ms, lists name/SKU/stock | `GET /products?search=<text>`, 300 ms after last keystroke; name, SKU, stock | `ST:112-116` option text contains `CAM-P`, `25 in stock`, `2 in stock`; `ST:117-121` last request `search` `toBe("ca")`; `ST:122-124` requests never contain `"c"`; `ST:125` `page` `"1"` | PASS for list, page and "no request per keystroke"; debounce window not discriminated (G4: 200 ms and 600 ms survive) |
| SALE-05 picker excludes products chosen elsewhere | not offered | `ST:153-158` `findByRole("option",{name:/^Caneca/})` visible, `queryByRole("option",{name:/^Camiseta P/})` `not.toBeInTheDocument()` | PASS |
| SALE-06 pick shows name, SKU, stock, price; qty 1; loads `GET /products/:id` | as stated | `ST:168-169` picker text `Camiseta P`/`CAM-P`; `ST:170-172` `spinbutton` `toHaveValue(1)`; `ST:173` `line-price` `"$49.90"`; `ST:174-176` `line-stock` `"24"` (detail stock 24 vs list 25); `ST:177` `detailRequests` `toContain(camiseta.id)`; `UT:37` quantity `"1"` | PASS |
| SALE-07 subtotals and total in USD | unit price x qty; sum | `ST:199-204` `line-subtotal` `"$149.70"` (49.90 x 3) and `"$29.90"`; `ST:205` `sale-total` `"$179.60"` | PASS |
| SALE-08 above stock: "Only N available", aria-invalid, aria-describedby | exact message and a11y link | `ST:229` `aria-invalid` `"true"`; `ST:230` `toHaveAccessibleDescription("Only 2 available")`; `ST:235-236` cleared at 2; `UT:132` `{valid:false,message:"Only 2 available"}` | PASS |
| SALE-09 below 1 / not whole | "Enter at least 1" / "Enter a whole number" | `ST:249-262` it.each `"0"` -> "Enter at least 1", `""` and `"1.5"` -> "Enter a whole number", each with `aria-invalid` and `toHaveAccessibleDescription(message)`; `UT:139-162` incl. `"-1"`, `"abc"` | PASS |
| SALE-10 submit disabled while a line is incomplete/invalid/unavailable | `Register sale` disabled | `ST:232`, `ST:246`, `ST:261` `toBeDisabled()`; `ST:266-272` disabled with no product, enabled after pick, disabled after Add product; `ST:289` disabled for unavailable | PASS |
| SALE-11 detail 404 | "This product is no longer available" | `ST:283-285` `findByText(...)` `toBeVisible()`; `ST:286-288` accessible description; `UT:181-184` | PASS |
| SALE-12 key `crypto.randomUUID()` sent with `{items:[{productId,quantity}]}` | UUID v4 header, exact body | `ST:369` `requests[0]?.key` `toMatch(uuid)`; `ST:370-375` body `toEqual({items:[{productId:camiseta.id,quantity:3},{productId:caneca.id,quantity:1}]})`; `UT:29-31` | PASS |
| SALE-13 same lines resubmitted reuse the key | same key after network error / timeout / failure | `ST:378-408` it.each network error and 500: `expect(requests[1]?.key).toBe(requests[0]?.key)` | PASS (timeout not separately simulated; same code path as network error) |
| SALE-14 any change -> new key | new key on product, quantity, add, remove | `ST:418-419` third key `toMatch(uuid)` and `not.toBe(requests[0]?.key)`; `UT:46-80` it.each add/pick/setQuantity/remove/reset `expect(state.idempotencyKey).not.toBe(before)`; `UT:83-93` unchanged -> same state | PASS |
| SALE-15 submit disabled while pending | button disabled | `ST:442-444` `getByRole("button",{name:/^Register/})` `toBeDisabled()` | PASS for the disabled attribute (the pending label is "Registering…") |
| SALE-16 201 summary, reset, new key | "Sale registered", per-item SKU/name/qty/unit price/line total, total from response, one empty line, new key | `ST:488` "Sale registered"; `ST:499-502` rows `toEqual([["CAM-P","Camiseta P","3","$49.90","$149.70"],["CAN-01","Caneca","1","$15.00","$15.00"]])`; `ST:506` total `["$164.70"]`; `ST:509-513` picker reset, no line 2, total `$0.00`; `ST:518-519` next key `toMatch(uuid)` and `not.toBe(requests[0]?.key)` | PASS (summary built from the response `unitPriceCents`: killed M21-M23) |
| SALE-17 201 invalidates `products` | refetch | `ST:520` `detailRequests.length` `toBeGreaterThan(detailsBefore)` | GAP: M15 (invalidation removed) survives; the extra detail request comes from re-picking the product (G2) |
| SALE-18 409 | "Sale not registered" + API message + "Nothing was changed.", lines kept, products invalidated, stock refreshed | `ST:558-560` alert text; `ST:562-569` detail refetch and `line-stock` `"1"`; `ST:570-571` picker name and quantity `toHaveValue(2)`; `ST:572` `"Only 1 available"`; `ST:574-575` submit disabled | PASS |
| SALE-19 404 | title + "One or more products were not found", lines kept, invalidate | `ST:590-591` alert text; `ST:592-594` `findByText("This product is no longer available")` (only possible after invalidation); `ST:595` picker name kept | PASS |
| SALE-20 400 | title + API message, lines kept | `ST:608-610` alert contains "Each productId can appear only once"; picker name kept | PASS |
| SALE-21 network / 5xx | title + error message + "Submitting again will not register it twice.", lines kept | network: `ST:621-628` message `"Could not reach the server. Check your connection and try again."`, retry sentence, not "Nothing was changed."; 5xx: `ST:405` only `findByRole("alert")` | PASS for network; 5xx text not asserted (G3, M20c survives) |
| SALE-22 alert above items card, `role="alert"`, replaced | position and replacement | `ST:507` and `ST:561` `isAbove(alert, itemsCard())` `toBe(true)`; `ST:646-647` `getAllByRole("alert")` `toHaveLength(1)` and no "Sale not registered" | PASS |

**Edge cases**

- [x] `Idempotent-Replayed: true` shows the same summary: `ST:526-540` response header set, `ST:539` `findByText("Sale registered")`
- [~] Double-click sends one request: `ST:440-448` asserts `requests` length 1 and the button disabled, but the ref guard is untested: with it removed (M08) the test still passes, while two synchronous submits send 2 requests (probe in scratch, see G1)
- [x] 409 lowering stock below quantity: `ST:572` "Only 1 available", `ST:574-575` submit disabled

**Status**: 21/22 ACs and 2/3 edge cases matched the spec outcome on exact values; 0 spec-precision gaps (each AC names a string, key behavior or state). Gaps: SALE-17 (G2), SALE-21 5xx text (G3), double-click guard (G1), SALE-04 window (G4).

---

## Discrimination Sensor

Isolation: `apps/frontend` `src`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `components.json` copied to the session scratchpad (`.../scratchpad/fe`) with `node_modules` symlinked. Unmutated copy 117/117 first. Each mutant is one exact-occurrence replacement (the script skips a mutant unless the pattern occurs exactly once), run with `vitest run` over all 9 files, original re-copied before the next. After the run `diff -r` of scratch `src` vs the real `src` was empty.

| # | File:line | Mutant | Result |
| - | --------- | ------ | ------ |
| M01 | `F:57-61` | key not regenerated on setQuantity | killed (`UT:46`, `ST:378` x2) |
| M02 | `F:42` | key not regenerated on add | killed (`UT:46`) |
| M03 | `F:45` | key not regenerated on remove | killed (`UT:46`) |
| M04 | `F:47-53` | key not regenerated on pick | killed (`UT:46`) |
| M05 | `F:64` | reset keeps the old key | killed (`UT:46`) |
| M06 | `R:88` | key regenerated on every submit | killed (`ST:378` x2) |
| M07 | `API:13` | Idempotency-Key header not sent | killed (4 tests) |
| M07b | `F:29` | constant key | killed (8 tests) |
| **M08** | `R:81` | double-submit ref guard removed | **survived** (G1; real: sync double submit sends 2 requests) |
| M09 | `F:93` | `quantity > stock` -> `>=` | killed (`UT:127`, `ST:223`, `ST:542`) |
| M10 | `F:90` | `< 1` -> `< 0` | killed (`UT:139`, `ST:249`) |
| M10b | `F:90` | `< 1` -> `<= 1` | killed (14 tests) |
| M11 | `F:87` | integer check dropped | killed (`UT:149`, `ST:249`) |
| M11b | `R:68` | stock from the stale product, detail ignored | killed (`ST:542`) |
| M12 | `P:45` | picker does not exclude chosen products | killed (`ST:142`) |
| M13 | `P:22` | debounce 300 -> 0 | killed (`ST:102`) |
| **M13b** | `P:22` | debounce 300 -> 600 | **survived** (G4) |
| **M13d** | `P:22` | debounce 300 -> 200 | **survived** (G4) |
| M13c | `P:22` | debounce 300 -> 1500 | killed (`ST:102`, waitFor timeout) |
| M14 | `P:41` | picker `page` 1 -> 2 | killed (`ST:102`) |
| **M15** | `R:37` | no invalidation on 201 | **survived** (G2) |
| M16 | `R:41` | no invalidation on 409 | killed (`ST:542`) |
| M17 | `R:41` | no invalidation on 404 | killed (`ST:578`) |
| M18 | `R:36` | form not reset on 201 | killed (`ST:470`) |
| M19 | `R:39` | lines cleared on any error | killed (7 tests) |
| M20 | `O:10` | "Nothing was changed." for network errors | killed (`ST:613`) |
| M20b | `O:10` | status 0 excluded from "outcome unknown" | killed (`ST:613`) |
| **M20c** | `O:10` | 5xx excluded from "outcome unknown" | **survived** (G3) |
| M21 | `O:53` | summary unit price off | killed (`ST:470`) |
| M22 | `O:56` | summary line total wrong | killed (`ST:470`) |
| M23 | `O:71` | summary total not from response | killed (`ST:470`) |
| M24 | `R:93` | total ignores quantity | killed (`ST:180`) |
| M25 | `C:97` | subtotal ignores quantity | killed (`ST:180`) |
| M26 | `F:44` | remove allowed on the last line (reducer) | killed (`UT:96`) |
| M27 | `C:157` | remove button never disabled | killed (`ST:82`) |
| M28 | `R:68` | unavailable (404) line not blocking | killed (`ST:275`, `ST:578`) |
| M29 | `R:76` | `every` -> `some` | killed (`ST:264`) |
| M30 | `R:117` | submit not disabled while pending | killed (`ST:426`) |
| M31 | `C:128` | `aria-describedby` dropped | killed (7 tests) |
| M32 | `C:127` | `aria-invalid` dropped | killed (4 tests) |
| M33 | `R:84` | quantity sent as a string | killed (3 tests) |
| M34 | `R:103` | summary only shown if also errored | killed (4 tests) |
| M35 | `F:50` | pick sets quantity 2 | killed (`UT:34`, `ST:180`) |
| M36 | `R:53` | detail query never fetched (seed only) | killed (5 tests) |
| M39 | `R:46` | submitting ref never reset | killed (4 tests) |
| M40 | `R:41` | 400 resets the form | killed (4 tests) |
| M41 | `O:14` | failure title changed | killed (5 tests) |
| M42 | `R:62` | stock from the picked line, not the detail | killed (`ST:161`) |
| M38 | `R:70` | picker's own product also excluded in its own picker | survived: spec SALE-05 says "another line"; not a spec gap (O1) |
| M43 | `P:42` | picker query enabled while closed | survived: behavior outside the spec (O2) |
| M44 | `P:41` | whitespace-only search sent untrimmed | survived: not in spec (O2) |

**Sensor depth**: expanded P0 (critical flow: idempotency and stock), 49 distinct mutants (>= 12 required). 41 killed, 4 survived as real gaps (M08, M15, M20c, M13b/M13d counted as one gap G4 = 5 mutants), 3 survived outside the spec (M38, M43, M44).
**Outcome (iteration 0)**: not ready, G1..G4.
**Probe for M08** (scratch only, temporary test file, discarded): two `fireEvent.submit(form)` back to back with a never-resolving POST: passes (1 request) on real code, fails with 2 requests when the `submitting.current` guard is removed. So the guard is load-bearing and the existing dblClick test does not exercise it (user-event lets React re-render between the two clicks, so `isPending` disables the button first).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (reducer, picker, card, outcome each used once; `useDebouncedValue` is a tiny hook) | PASS |
| Surgical changes (`OutOfStockBadge` extraction is required by reuse in the picker; `products-table.tsx` diff is the badge swap; `api/client.ts` `Register` augmentation types `error` as `ApiError`; `setup.ts` adds the cmdk `ResizeObserver` shim) | PASS |
| No scope creep (no history page, no price edit, no shortcuts) | PASS |
| Matches patterns (co-located tests, MSW through `renderApp`, `serveCatalog` helper like `serveSales`, tabs via biome) | PASS |
| Comments only for the why (`F:26-27`, `R:40,49,80`, `O:8-9`, `api/products.ts` seeded query) | PASS |
| Spec-anchored outcome check (strings, keys, bodies asserted verbatim) | PASS, minus SALE-17 and 5xx text |
| Per-layer coverage (reducer/validation 1:1 in `UT`; route covers happy, edge, error paths) | PASS, minus G1..G4 |
| Every test maps to a spec requirement (`ST:64` SALE-01, `:74` -02, `:82` -03, `:102` -04, `:128` Assumption (out-of-stock offered), `:142` -05, `:161` -06, `:180` -07, `:223` -08, `:240` -08/Assumption, `:249` -09, `:264` -10, `:275` -11, `:350` -12, `:378` -13/-14, `:426` -15/edge, `:470` -16/-17, `:523` edge replay, `:542` -18/edge, `:578` -19, `:598` -20, `:613` -21, `:632` -22; `UT` -09/-12/-13/-14) | PASS, no unclaimed tests |
| Products tests still green after the badge refactor | PASS (unchanged `products.test.tsx`, full suite green) |
| Documented guidelines followed: `CLAUDE.md` (comments rule; backend/DB rules n/a), `docs/prompts/06-frontend.md` | PASS |
| Discrimination sensor | FAIL (G1..G4) |

Observations (not gaps):

- O1: M38 survives; a user reopening line N's own picker does not see the currently chosen product. SALE-05 says "another line", so it is spec-conformant, but the behavior is untested.
- O2: M43 (query fires while the popover is closed) and M44 (whitespace-only search) are outside the spec.
- O3: the products suite is unchanged by this feature; the badge refactor is covered by the existing `PT` out-of-stock assertions.
- O4: `.specs/STATE.md` became modified in the working tree during this verification (it was not in the baseline); the Verifier did not touch it.

---

## Gate Check

- **Gate command**: `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` (repo root)
- **Result**: exit 0. Typecheck clean; frontend tests 9 files, **117 passed**, 0 failed, 0 skipped; biome "Checked 152 files in 50ms. No fixes applied."; vite build succeeded ("built in 226ms")
- **Test count before feature**: 70 (frontend-products final)
- **Test count after feature**: 117
- **Delta**: +47 (`ST` and `UT`); no test removed or weakened
- **Skipped tests**: none
- **Stability**: 1 real-tree gate run, 2 further real-tree runs, 5 unmutated scratch runs: 8/8 green at 117 tests (no flake)

---

## Fix Plans

### G1 (Major, test-only): double-submit guard not exercised (edge case 2, SALE-15; M08)

- **Root cause**: `ST:440-448` uses `user.dblClick`; user-event yields between clicks, `isPending` disables the button, so the `submitting` ref at `R:81` is never the deciding factor. Removing it passes all 117 tests.
- **Fix task**: in `ST`, fire two `fireEvent.submit(form)` calls back to back (or two synchronous clicks inside `act`) against a pending POST and assert `requests` length 1. Done when M08 fails.
- **Priority**: Major (critical path: duplicate sale)

### G2 (Major, test-only): invalidation on 201 not asserted (SALE-17; M15)

- **Root cause**: `ST:520` counts detail requests, but re-picking the product after the reset (`ST:515`) already triggers one. Nothing asserts the `products` queries are invalidated.
- **Fix task**: before submitting, seed the `queryClient` with an active `products` list or detail observer (or spy on `queryClient.invalidateQueries`) and assert it is called with `["products"]`/refetched after the 201, without re-picking. Done when M15 fails.
- **Priority**: Major

### G3 (Minor, test-only): 5xx outcome text (SALE-21; M20c)

- **Root cause**: `ST:405` only waits for `role="alert"` in the 500 case of the it.each; text is asserted only for the network error (`ST:613`).
- **Fix task**: add to the it.each `ST:378` an assertion that the alert contains "Internal server error" and "Submitting again will not register it twice." for the 500 row. Done when M20c fails.
- **Priority**: Minor

### G4 (Minor, test-only): picker debounce window (SALE-04; M13b, M13d)

- **Root cause**: `ST:102` asserts no request for `"c"` and eventually `"ca"` (default `waitFor`), so 200 ms and 600 ms pass; only 0 and 1500 ms fail.
- **Fix task**: add a fake-timer test (like `product-filters.test.tsx`) that types, advances 299 ms (no request), then 1 ms (one request with the search). Done when M13b and M13d fail.
- **Priority**: Minor

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SALE-01..SALE-03, SALE-05..SALE-16 | Implemented | Verified |
| SALE-04 | Implemented | Verified (window gap G4, minor) |
| SALE-15 and edge "double-click" | Implemented | Needs Fix (G1) |
| SALE-17 | Implemented | Needs Fix (G2) |
| SALE-18..SALE-20, SALE-22 | Implemented | Verified |
| SALE-21 | Implemented | Verified for network; 5xx text G3 (minor) |

---

## Isolation

`git status --porcelain` captured before any gate or sensor work (`scratchpad/baseline.txt`). After the gate, sensor and stability runs it is identical except ` M .specs/STATE.md`, which appeared during the run and was not touched by the Verifier (O4); every file under `apps/frontend` is unchanged. The gate's `vite build` writes only to the git-ignored `apps/frontend/dist`. No `git stash`; all mutations and the M08 probe ran in the scratch copy (`diff -r` of scratch vs real `src` empty after the run). Only this `validation.md` was written by the Verifier.

---

## Summary

**Overall**: Ready after iteration 1 (iteration 0 was FAIL on sensor survivors G1-G4; all closed by test-only changes)

**Spec-anchored check**: 21/22 ACs and 2/3 edge cases matched the spec outcome on exact values; 0 spec-precision gaps; gaps G1 (double-submit guard), G2 (SALE-17), G3 (SALE-21 5xx text), G4 (SALE-04 window)
**Sensor**: 49 mutants; 41 killed, 5 survived as real gaps (M08, M15, M20c, M13b, M13d), 3 survived outside the spec (M38, M43, M44)
**Gate**: 117 frontend tests passed, 8/8 stable runs; typecheck, biome and build clean

**What works**: idempotency key lifecycle (generated, sent, reused on retry, regenerated on every line change and after success), client stock and quantity validation with a11y wiring, picker search/exclusion/page 1, summary from the response, 409/404/400/network outcomes with lines kept and stock refreshed, alert placement and replacement.

**Issues found**: G1..G4 (add four test assertions in `routes/_auth/sales.new.test.tsx`).

**Next steps**: route G1..G4 to an implementer as test-only fix tasks, then re-verify.
