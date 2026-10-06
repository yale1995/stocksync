# Frontend Auth Validation

## Validation: frontend-auth - PASS (iteration 1)

**Date**: 2026-10-06. **Verdict**: PASS. Iteration 0 failed on G1 (AUTH-17 "different path" not discriminated), closed by a test-only change in `apps/frontend/src/routes/_auth.test.tsx`.

## Iteration 1 (re-verification)

- **G1 closed**: `AT:110-120` "keeps focus where it is when only the search changes": focuses "Log out" (`AT:114`), navigates `/sync` to `/sync?tab=failed` inside `act` (`AT:116`), asserts `AT:118` `expect(router.state.location.searchStr).toBe("?tab=failed")` and `AT:119` `expect(logOut).toHaveFocus()`. AUTH-17 is now discriminated on both the positive case (`AT:96-108`) and the "different path" condition.
- **Gate** (repo root, exit 0): typecheck 3/3 tasks; frontend tests 4 files, **36 passed**, 0 failed, 0 skipped (35 + 1 new); biome "Checked 129 files. No fixes applied."; vite build succeeded.
- **Sensor** (fresh scratch copy, `node_modules` symlinked, unmutated copy 36/36, scratch deleted afterwards):

| # | File | Mutant | Iteration 1 |
| - | ---- | ------ | ----------- |
| M12b | `RF:12` | `!event.pathChanged` -> `false` | **killed** (new test `AT:110`) |
| M12 | `RF:13` | no focus call | killed (`AT:96`) |
| M1 | `L:50` | `internalPath` accepts `//` | killed (`LT:86`) |
| M3 | `L:147` | button not disabled while pending | killed (`LT:51`) |
| M4 | `L:52` | default target `/sync` | killed (`LT:86`) |
| M5 | `A:12` | guard without `redirect` search | killed (`AT:10`) |
| M8 | `S:17` | expiry does not clear cache | killed (`ST:36`) |
| M9 | `S:20` | `reason: "expired"` omitted | killed (`ST:36`) |
| M10 | `AL:73` | logout does not clear cache | killed (`AT:62`) |
| M11 | `AL:72` | logout navigates on failure | killed (`AT:82`) |

**Sensor (iteration 1)**: 10/10 re-run mutants killed, including M12b. Overall with iteration 0: 24/25 killed, 1 equivalent (M13), 0 survivors.
**Isolation**: `git status --porcelain` identical before and after the iteration-1 sensor (baseline captured after the coordinator's ` M .specs/STATE.md` edit); only this `validation.md` was written.

---

## Iteration 0 (history)



**Date**: 2026-10-06
**Spec**: `.specs/features/frontend-auth/spec.md` (AUTH-01..AUTH-17 + 3 edge cases + Assumptions); source of truth `docs/prompts/06-frontend.md`; rules `CLAUDE.md`
**Diff range**: uncommitted working tree on `feat/frontend-auth` vs `HEAD` (`5bdc33c`, frontend-setup committed). Modified: `.gitignore`, `package.json`, `index.css`, `main.tsx`, `routeTree.gen.ts`, `router.tsx`, `routes/__root.tsx`, `test/render.tsx`, `pnpm-lock.yaml`. Untracked: `api/auth.ts`, `auth/*`, `components/*`, `routes/login.tsx`, `routes/_auth*`, `test/fixtures.ts`, `test/handlers.ts`. `components/ui/*` (vendored shadcn) is build-gate only; `docs/` ignored.
**Verifier**: independent sub-agent (author != verifier)

All 17 ACs and the 3 edge cases are implemented and asserted on the spec's exact values; the gate is green. The verdict is FAIL for one reason: the sensor found a surviving mutant on AUTH-17's "different path" condition (G1, test-only, P2 behavior). 25 mutants were injected: 23 killed, 1 survived (G1), 1 equivalent.

Paths: `L` = `apps/frontend/src/routes/login.tsx`, `A` = `routes/_auth.tsx`, `S` = `auth/session.ts`, `AL` = `components/app-layout.tsx`, `RF` = `components/route-focus.tsx`, `LT` = `routes/login.test.tsx`, `AT` = `routes/_auth.test.tsx`, `ST` = `auth/session.test.tsx` (all under `apps/frontend/src/`).

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 shadcn primitives | Done | `components/ui/*` compile in the build gate |
| T2 Auth API and login route | Done | `api/auth.ts:1-31`, `L:1-187`, `LT` |
| T3 Guard, layout, placeholders | Done | `A:1-23`, `AL:20-65`, `routes/_auth/*`, `AT` |
| T4 Logout | Done | `AL:67-112`, `AT:62-94` |
| T5 Session expiry | Done | `S:6-23`, wired in `test/render.tsx:14`, `ST` |
| T6 Focus on route change | Done | `RF:6-19`, `AT:96-108` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| AUTH-01 labelled inputs + "Log in" button | labels "Email", "Password", button "Log in" | `LT:40-43` `findByLabelText("Email")` `toHaveAttribute("type","email")`; `LT:44-47` Password `type` `password`; `LT:48` `getByRole("button",{name:"Log in"})` `toBeEnabled()` | PASS |
| AUTH-02 button disabled while pending | submit disabled | `LT:67-69` `expect(screen.getByRole("button",{name:/log/i})).toBeDisabled()` with a never-resolving login handler (`LT:54-62`) | PASS |
| AUTH-03 internal redirect honoured | navigate to `redirect` | `LT:80` `expect(router.state.location.pathname).toBe("/sync")`; `LT:81-83` request body `toEqual({email,password})` | PASS |
| AUTH-04 absent / non-internal redirect | navigate to `/products` | `LT:103-106` `pathname` `toBe("/products")` and `href` `toBe("/products")` for no redirect, `//evil.example`, `https://evil.example/` (`LT:86-96`) | PASS |
| AUTH-05 401 message in alert | "Invalid email or password" in `role="alert"` | `LT:120-122` `findByRole("alert")` `toHaveTextContent("Invalid email or password")`; `LT:123` stays on `/login` | PASS |
| AUTH-06 field errors, aria, no API call | message next to field, `aria-invalid`, `aria-describedby`, API not called | `LT:164` `toHaveAttribute("aria-invalid","true")`; `LT:165` `toHaveAccessibleDescription(message)` ("Enter your email", "Enter your password", "Enter a valid email address", `LT:143,149`); `LT:167` `not.toHaveAttribute("aria-invalid","true")` on the valid field; `LT:170` `expect(requests).toHaveLength(0)` | PASS |
| AUTH-07 signed-in `/login` | redirect to `/products` | `LT:178-180` `pathname` `toBe("/products")` | PASS |
| AUTH-08 guard redirect without message | `/login?redirect=<location>`, no expired message | `AT:14` `pathname` `toBe("/login")`; `AT:15` `search` `toEqual({ redirect: "/sync" })` (no `reason`); `AT:17` `queryByRole("alert")` `not.toBeInTheDocument()`; `ST:103` `queryByText(expiredMessage)` absent | PASS |
| AUTH-09 `/` redirects | `/products` | `AT:24-26` `pathname` `toBe("/products")`; `AT:27-29` heading "Products" visible | PASS |
| AUTH-10 email, tenant, role shown | email, tenant name, role | `AT:36` `findByText("operator@acme.test")`; `AT:37` `getByText("Acme")`; `AT:38` `getByText("Operator")` | PASS |
| AUTH-11 nav landmark + `aria-current` | links Products, New sale, Sync status; current has `aria-current="page"` | `AT:45` `navigation` name "Main"; `AT:47-51` link texts `toEqual(["Products","New sale","Sync status"])`; `AT:52-54` Sync `toHaveAttribute("aria-current","page")`; `AT:56-58` others `not.toHaveAttribute("aria-current")` | PASS |
| AUTH-12 logout success | POST `/auth/logout`, cache cleared, navigate `/login` | `AT:77` `logoutCalls` `toBe(1)`; `AT:76` `pathname` `toBe("/login")`; `AT:78` `getQueryData(meQuery.queryKey)` `toBeUndefined()`; `AT:79` `search` `toEqual({})` | PASS |
| AUTH-13 logout failure | stay on page, alert "Could not log out. Try again." | `AT:89-91` `findByRole("alert")` `toHaveTextContent("Could not log out. Try again.")`; `AT:92` `pathname` `toBe("/sync")`; `AT:93` user email still visible | PASS |
| AUTH-14 401 while signed in | clear cache, navigate `/login?redirect=<current>` | `ST:43` `pathname` `toBe("/login")`; `ST:45-48` `search` `toEqual({ redirect: "/sync", reason: "expired" })`; `ST:49` `getQueryData(meQuery.queryKey)` `toBeUndefined()` | PASS |
| AUTH-15 expired message | "Your session has expired. Please log in again." in `role="alert"` | `ST:50` `findByRole("alert")` `toHaveTextContent(expiredMessage)` (`ST:11` holds the exact string) | PASS |
| AUTH-16 return after re-login | back to the location they were on | `ST:67` `pathname` `toBe("/sync")`; `ST:69-71` heading "Sync status" visible | PASS |
| AUTH-17 focus on `h1` after path change | the new page's `h1` has focus | `AT:103-107` `getByRole("heading",{level:1,name:"Sync status"})` `toHaveFocus()` | PASS on the positive case; the "different path" condition is not discriminated (G1, M12b) |

**Edge cases**

- [x] `redirect` is `//evil.example` or `https://evil.example` goes to `/products`: `LT:90-96,103-106` (M1, M1b killed)
- [x] Parallel 401s navigate once, with the message: `ST:88-91` `expect(toLogin).toHaveLength(1)` on a `router.navigate` spy; `ST:92` `findAllByText(expiredMessage)` `toHaveLength(1)`
- [x] API unreachable during login shows the network message: `LT:133-135` `toHaveTextContent("Could not reach the server. Check your connection and try again.")`

**Status**: all 17 ACs and 3 edge cases covered on exact spec values; 0 spec-precision gaps (each AC names an exact string, path or state). One discrimination gap on AUTH-17 (G1).

---

## Discrimination Sensor

Isolation: `src`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `components.json` of `apps/frontend` copied to the session scratchpad (`.../scratchpad/fe`) with `node_modules` symlinked. The unmutated copy passed 35/35 first. Each mutant is a single exact-occurrence replacement (the script rejects a replacement unless the pattern occurs exactly once), run with `vitest run` (all 4 files), and the original file was re-copied before the next mutant. The scratch was deleted afterwards. The real tree was never edited.

| # | File | Mutant | Result |
| - | ---- | ------ | ------ |
| M1 | `L:50` | `internalPath` accepts `//` (drop `!startsWith("//")`) | killed (`LT:96` protocol-relative case) |
| M1b | `L:50` | `internalPath` accepts any string (drop `startsWith("/")`) | killed (`LT:96` absolute-URL case) |
| M2 | `L:78` | field-validation gate removed (API called with invalid fields) | killed (`LT:153`, both cases) |
| M2b | `L:40` | email-required check dropped | killed (`LT:153` empty fields) |
| M2c | `L:41` | email-shape check dropped | killed (`LT:153` email without @) |
| M3 | `L:147` | button not disabled while pending | killed (`LT:51`) |
| M4 | `L:52` | default target `/products` -> `/sync` | killed (`LT:96`, 3 cases) |
| M4b | `L:31` | signed-in `/login` not redirected | killed (`LT:174`) |
| M4c | `L:112` | expired alert never rendered | killed (`ST:36`, `ST:53`, `ST:74`) |
| M4d | `L:178` | `aria-describedby` dropped | killed (`LT:153`) |
| M5 | `A:12` | guard redirect without `redirect` search | killed (`AT:10`) |
| M6 | `A:11` | guard does not translate 401 into a redirect (error swallowed/propagated) | killed (`AT:10`, `ST:95`) |
| M6b | `A:12` | guard adds `reason: "expired"` | killed (`AT:10`, `ST:95`) |
| M7 | `S:14` | signed-in check dropped | killed, but by an out-of-memory worker crash (`/auth/me` 401 re-enters the handler and loops), not by an assertion; see note |
| M8 | `S:17` | expiry does not clear the cache | killed (`ST:36`, `ST:53`, `ST:74`) |
| M9 | `S:20` | `reason: "expired"` omitted | killed (`ST:36`, `ST:53`, `ST:74`) |
| M9b | `S:16` | expiry redirect fixed to `/products` instead of the current location | killed (`ST:36`, `ST:53`) |
| M10 | `AL:73` | logout does not clear the cache | killed (`AT:62`) |
| M11 | `AL:72` | logout navigates on any outcome (`onSettled`) | killed (`AT:82`) |
| M11b | `AL:105` | logout error alert hidden | killed (`AT:82`) |
| M11c | `AL:71` | logout API not called | killed (`AT:62`, `AT:82`) |
| M12 | `RF:13` | no focus call | killed (`AT:96`) |
| **M12b** | `RF:12` | focus even when the path did not change (`!event.pathChanged` -> `false`) | **survived** (G1) |
| M13 | `AL:43` | `activeProps` neutralised | survived, equivalent: TanStack `Link` sets `aria-current="page"` itself; verified separately with `aria-current={undefined}` passed to `Link`, which also passes 35/35 |
| M14 | `L:64` | login does not seed the `me` cache | killed (`ST:53`, `LT:73`, `LT:86`) |

**Sensor depth**: expanded (security-relevant: open redirect, session handling), 25 mutants across all five requested files plus the layout and guard
**Result**: 23/25 killed, 1 survived (M12b = G1), 1 equivalent (M13)

Note on M7: the mutant is detected only because the process dies. `ST` never asserts "no navigation when no user is signed in" in isolation. The behavior is protected by the crash, which is a crude but real signal; a sharper test would be the spec's assumption row 1 ("a 401 with no known user redirects without the message"), which `AT:10` and `ST:95` cover through the guard path, not through the handler. Not raised as a gap.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (no abstractions beyond `internalPath`, `validate`, `Field`, `UserBlock`; each used) | PASS |
| Surgical changes (modified files all required: `main.tsx` and `render.tsx` wire the session handler, `__root.tsx` mounts `RouteFocus`, `index.css`/`package.json` for shadcn tokens/deps) | PASS |
| No scope creep (placeholder pages heading-only as the spec allows; no role-based screens, no remember-me) | PASS |
| Matches patterns (co-located `*.test.tsx`, `describe`/`it`, MSW handlers via `renderApp`, double quotes via biome) | PASS |
| Comments only for the why (`api/auth.ts:28`, `L:48`, `S:11-13`, `RF:4-5`) | PASS |
| Spec-anchored outcome check (asserted strings and paths match the spec verbatim) | PASS |
| Per-layer coverage (every AC and edge case has a test; routes cover happy, edge and error paths) | PASS |
| Every test maps to a spec requirement (`LT:36` AUTH-01, `LT:51` AUTH-02, `LT:73` AUTH-03, `LT:86` AUTH-04 + edge 1, `LT:109` AUTH-05, `LT:126` edge 3, `LT:138` AUTH-06, `LT:174` AUTH-07, `AT:10` AUTH-08, `AT:20` AUTH-09, `AT:32` AUTH-10, `AT:41` AUTH-11, `AT:62` AUTH-12, `AT:82` AUTH-13, `AT:96` AUTH-17, `ST:36` AUTH-14/15, `ST:53` AUTH-16, `ST:74` edge 2, `ST:95` AUTH-08) | PASS |
| Documented guidelines followed: `CLAUDE.md` (comments rule); no frontend testing rules exist | PASS |
| Discrimination sensor | FAIL (M12b survived) |

Observation (not a gap): `routes/login.tsx` AUTH-02 test asserts `toBeDisabled()` but does not assert the button is re-enabled afterwards; no spec criterion requires it.

---

## Gate Check

- **Gate command**: `pnpm typecheck && pnpm --filter frontend test && pnpm lint:check && pnpm --filter frontend build` (repo root)
- **Result**: exit 0. Typecheck 3/3 tasks; frontend tests 4 files, **35 passed**, 0 failed, 0 skipped; biome "Checked 129 files. No fixes applied."; vite build succeeded ("built in 180ms")
- **Test count before feature**: 13 (frontend-setup, `api/client.test.ts` only, per its validation)
- **Test count after feature**: 35
- **Delta**: +22 (`LT` 11 with `it.each` expansions, `AT` 7, `ST` 4); no test removed or weakened
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

### G1 (Minor, test-only): focus fires on non-path changes (AUTH-17; M12b)

- **Root cause**: `AT:96-108` only exercises a path change, so a `RouteFocus` that ignores `event.pathChanged` (focusing the `h1` on a search-only or hash-only navigation, stealing focus from the field the user is typing in) passes. The spec says "WHEN the route changes to a different path".
- **Fix task**: in `AT`, add a test that renders a signed-in page, places focus elsewhere (for example the "Log out" button or the nav link), runs `router.navigate({ to: ".", search: { x: 1 } })` or equivalent same-path change, and asserts `expect(heading).not.toHaveFocus()` / `expect(previouslyFocused).toHaveFocus()`. Done when M12b fails and M12 still fails.
- **Priority**: Minor

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| AUTH-01..AUTH-16 | Implemented | Verified |
| AUTH-17 | Implemented | Verified (iteration 1, G1 closed) |

---

## Isolation

`git status --porcelain` was captured before the gate. After the sensor, the only difference is that ` M .specs/STATE.md` (present in the baseline) is no longer listed; that is the orchestrator's file, not touched by this Verifier (all mutation work was in the scratchpad copy, which was deleted). All `apps/frontend`, `.specs/features/frontend-auth/` and other entries are identical. Only this `validation.md` was written by the Verifier.

---

## Summary

**Overall**: Ready (iteration 1; iteration 0 was FAIL on G1)

**Spec-anchored check**: 17/17 ACs and 3/3 edge cases matched the spec outcome; 0 spec-precision gaps; AUTH-17's "different path" condition not discriminated
**Sensor**: 23/25 killed, 1 survived (G1), 1 equivalent
**Gate**: 35 frontend tests passed; typecheck, biome and build clean

**What works**: open-redirect protection (`//` and absolute URLs), client-side validation with aria wiring, pending-disabled button, signed-in `/login` redirect, silent guard redirect, expiry with cache clear, message and return location, single navigation on parallel 401s, logout success and failure, user block, nav landmark, focus on path change.

**Issues found**: G1 (add one same-path-navigation focus test).

**Next steps**: none for verification.
