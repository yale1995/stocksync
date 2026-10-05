# API Docs Validation

## Validation: api-docs - PASS ✅ (iteration 2)

**Date**: 2026-10-05
**Spec**: `.specs/features/api-docs/spec.md` (DOCS-01..DOCS-30 + 4 edge cases); rules `CLAUDE.md`
**Diff range**: uncommitted working tree on `feat/api-docs` vs `main` c19b8be (`git diff main` + untracked `common.validation.ts`, `health.validation.ts`, `sync.validation.ts`, `docs.controller.ts`, `docs.test.ts`, `response-schemas.test.ts`, `openapi.ts`, `openapi.test.ts`, `openapi-description.ts`, `openapi-description.test.ts`)
**Verifier**: independent sub-agent (author ≠ verifier)

Iteration 1 found two gaps, and both are closed. For G1, the "in production" test loads `docs.controller` with a mocked `NODE_ENV=production`, and D1 (always show seed users) is now killed. For G2, the Sync status regex `[^|\s]` rejects an empty cell, and D11, D23 and the new D25 (whitespace-only cell) are now killed. The ACs added after iteration 1 (DOCS-27..30) are covered, and every mutant against them was killed. `apps/backend/src/infra/seed/*` is identical to `main`: `git diff main` and `git status --porcelain` on that path are both empty. The document contains no seeded product id.

`O` = `apps/backend/src/http/openapi.ts`, `OT` = `apps/backend/src/http/openapi.test.ts`, `OD` = `apps/backend/src/http/openapi-description.ts`, `ODT` = `apps/backend/src/http/openapi-description.test.ts`, `DC` = `apps/backend/src/http/controllers/docs.controller.ts`, `DT` = `apps/backend/src/http/controllers/docs.test.ts`, `RS` = `apps/backend/src/http/controllers/response-schemas.test.ts`, `PT` = `apps/backend/src/modules/products/products.test.ts`, `ST` = `apps/backend/src/modules/sync/sync-status.test.ts`.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1-T14 | ✅ Done | no unchecked item in `tasks.md` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| DOCS-01 `GET /openapi.json` | 200, JSON, `openapi: "3.1.0"` | `DT:40-46` `status toBe(200)`, content-type `^application/json`, `openapi toBe("3.1.0")`; `OT:88-90`. R1 killed | ✅ PASS |
| DOCS-02 every mounted route, `{id}`, docs routes excluded | documented ops == mounted ops | `DT:48-54` `toEqual(registeredOperations())`; `DT:56-61` `/docs`, `/openapi.json` absent. R4 killed | ✅ PASS |
| DOCS-03 request schemas from the controllers' Zod schemas | same schema objects | `O:10-35` imports the controllers' exports; `OT:198-250` constraints; `OT:263-272` uuid path id; `OT:350-355` header | ✅ PASS |
| DOCS-04 each status the route can return | exact status list per operation | `OT:54-72,125-132` `toEqual(statuses)` for 13 ops. R2 killed | ✅ PASS |
| DOCS-05 shared error envelope, AppError codes | `$ref ErrorResponse`; enum = 6 codes | `OT:134-143` `toBe("#/components/schemas/ErrorResponse")`; `OT:145-157` `enum toEqual([...6])` | ✅ PASS |
| DOCS-06 apiKey cookie `access_token` on `requireAuth` ops | exact scheme; security on 10 ops, absent on 3 | `OT:276-280` `toEqual({cookieAuth:{type:"apiKey",in:"cookie",name:"access_token"}})`; `OT:282-289`; `OT:291-294`. R6 killed | ✅ PASS |
| DOCS-07 `Idempotency-Key` required uuid; `Idempotent-Replayed` on 201 | required uuid; header declared | `OT:350-355` `required toBe(true)`, `format toBe("uuid")`; `OT:357-364` `schema.const toBe("true")` | ✅ PASS |
| DOCS-08 admin role in description | 4 admin ops; the others do not mention it | `OT:330-337` `toContain("Requires the \`admin\` role")`; `OT:339-346` `not.toContain("admin")`. R7 killed | ✅ PASS |
| DOCS-09 `Set-Cookie` on login 200 | header declared | `OT:324-328` `toHaveProperty("Set-Cookie")`. R5 killed | ✅ PASS |
| DOCS-10 `GET /docs` | 200 HTML, Scalar, `/openapi.json` | `DT:97-104` `status 200`, `^text/html`, `toContain("@scalar/api-reference")`, `toContain("/openapi.json")`. R3 killed | ✅ PASS |
| DOCS-11 docs routes public | no 401 without a cookie | `DT:40-46`, `DT:97-104` without a cookie `toBe(200)` | ✅ PASS |
| DOCS-12 strict schemas for the 9 shapes | `z.strictObject` at every level | 15 sites (`common.validation.ts:4,5,22,24`, `auth.validation.ts:10,14`, `products.validation.ts:56`, `stock-movements.validation.ts:29,38`, `sales.validation.ts:32,35,45`, `health.validation.ts:4`, `sync.validation.ts:8,15`); `RS:129-139` (killed S1-S15 in iteration 1; schema files unchanged since) | ✅ PASS |
| DOCS-13 document uses the same schema objects | `$ref` to the `.meta({id})` component | `OT:159-175` `toBe("#/components/schemas/<id>")` for 11 2xx responses | ✅ PASS |
| DOCS-14 main success test of every 2xx JSON response parses | 11 responses parsed | `health.test.ts:11`, `auth.test.ts:89,212`, `PT:128,380,454,618`, `stock-movements.test.ts:289,519`, `sales.test.ts:121,509`, `ST:152` | ✅ PASS |
| DOCS-15 missing / wrong type / extra field fails the parse | parse fails | `RS:136` `safeParse(withExtraKey(sample, path)).success toBe(false)` at every level; null branches `ST:125,168` | ✅ PASS |
| DOCS-16 envelope parse for 400/401/403/404/409 | one real response each | `PT:590` (400), `PT:835` (401), `PT:563` (403), `PT:444` (404), `PT:529` (409) | ✅ PASS |
| DOCS-17 mounted route not documented → fail naming it | `"METHOD /path"` in the diff | `DT:48-54` `toEqual` on `"METHOD /path"` strings. R4 killed | ✅ PASS |
| DOCS-18 documented op without a route → fail naming it | same | same test | ✅ PASS |
| DOCS-19 `info.description` with 4 sections | headings present, used as `info.description` | `ODT:16-23` `toContain("## Getting started" / ... / "## Conventions")`; `OT:92-96` `toBe(apiDescription({showSeedUsers:true}))` | ✅ PASS |
| DOCS-20 error status → code table | 6 exact rows | `ODT:25-36` `toContain("| ${status} | \`${code}\` |")` | ✅ PASS |
| DOCS-21 seed users with tenant, role, email, password | every `seedTenants` user | `ODT:38-47` `toHaveLength(4)` + exact row per user; `DT:63-67` served doc `toContain("admin@acme.test")` outside production | ✅ PASS |
| DOCS-22 `NODE_ENV=production` → no seeded email/password | served document has none | **New**: `DT:70-94` mocks `infra/env.js` with `NODE_ENV: "production"`, imports `docs.controller` fresh, `GET /openapi.json` → `status toBe(200)` and `JSON.stringify(body) not.toContain(email/password)` for every seed user. This also covers the login examples. The builder level is covered by `ODT:49-56` and `OT:98-107`. D1 and D3 killed | ✅ PASS (G1 closed) |
| DOCS-23 every used tag described, no undeclared tag | used set == declared set, non-empty | `OT:109-121` `toEqual` of sorted sets + `description.length > 0`; `ODT:60-72` | ✅ PASS |
| DOCS-24 Sales rules | 4 statements | `ODT:74-81` `toContain` of the 4 rules | ✅ PASS |
| DOCS-25 Sync explains each status | a row with a non-empty meaning per status | **New**: `ODT:83-88` `toMatch(new RegExp(\`\\| \\\`${status}\\\` \\| [^|\\s]\`))`. D11, D23 and D25 killed | ✅ PASS (G2 closed) |
| DOCS-26 HTTPie default client | `{ targetKey: "shell", clientKey: "httpie" }` | `DT:106-112` regex on `"defaultHttpClient"`. R8 killed | ✅ PASS |
| DOCS-27 seed users as login examples, Acme admin first, none when hidden | `{email,password}` for every seed user, in `seedTenants` order, the first being `admin@acme.test`; `examples` undefined when hidden | `OT:296-313` `values toEqual(seedTenants.flatMap(...))` + `values[0] toEqual({email:"admin@acme.test",password:"acme-admin-password"})`; `OT:315-322` hidden `examples toBeUndefined()`; production through the controller `DT:76-93`. E1-E5, E21 killed | ✅ PASS |
| DOCS-28 one body example for POST /products, PATCH /products/{id}, stock adjustment, in every environment | exactly 1 example each; same with `showSeedUsers` false | `OT:375-384` `Object.keys(...) toHaveLength(1)` + `bodyExamples(hidden) toEqual(bodyExamples(document))`. E8, E10, E13, E14, E19b killed | ✅ PASS |
| DOCS-29 fixed Idempotency-Key example + "new sale needs a new key" | fixed uuid; description says so | `OT:386-391` `header.example toBe("0196a000-0000-7000-8000-0000000c0001")`, `description toContain("Use a new UUID for each new sale")`. E15-E17 killed | ✅ PASS |
| DOCS-30 every body example passes its Zod schema | `safeParse(...).success === true` for each; no unchecked body example | `OT:400-410` `schema.safeParse(example.value).success toBe(true)` for login, create, update and adjustment; `OT:412-424` the set of operations with body examples `toEqual` the checked set. E4, E6, E7, E9, E11, E12, E18 killed | ✅ PASS |

**Status**: 30/30 ACs matched the spec outcome; 0 spec-precision gaps.

---

## Fact checks (examples vs seed)

| Claim | Source | Result |
| ----- | ------ | ------ |
| `apps/backend/src/infra/seed/*` identical to `main` | `git diff main -- apps/backend/src/infra/seed` empty; porcelain empty on that path | ✅ |
| `MUG-01` is not a seeded SKU | seed SKUs `CAM-P`, `BON-01` (Acme), `CAM-P`, `CAN-01` (Globex) at `seed.ts:39-40,58-59`. Product names are not unique (only `products_tenant_id_sku_unique`, `schemas/products.ts:28`), so the name "Caneca" does not conflict | ✅ |
| Create example passes `createProductSchema` | `O:84` sku matches `^[A-Z0-9._-]+$`, price 2490 and stock 50 are in bounds (`products.validation.ts:6-18`) | ✅ (also `OT:400`) |
| Update example is valid for CAM-P | `O:91` name of 15 chars ≤ 200, priceCents 5990 ≤ 100,000,000, so the refine is met | ✅ |
| Adjustment example is valid for CAM-P | `O:98` `in` +10: Acme 25→35, Globex 10→20, under `MAX_STOCK` 1,000,000 (`stock-movements.service.ts:89`); `in` can never short the stock | ✅ |
| Idempotency-Key example is a valid uuid | `z.uuid().safeParse("0196a000-0000-7000-8000-0000000c0001").success === true` (checked with node) | ✅ |
| No example references a seeded product id | generated document dump: the only uuids are the zod uuid-pattern bounds (`0000…`, `ffff…`) and the fixed Idempotency-Key. The sale body has no example (`O:259`). 5 example sites with seed users, 4 without | ✅ |
| Introduction step 1 without seed users | `OD:29` now says "with your credentials" when hidden (the iteration-1 cosmetic note is fixed) | ✅ |

---

## Edge Cases

- [x] Transform documents the client input: `OT:215-225`
- [x] Refine stated in the description: `OT:252-261`
- [x] 204 without content: `OT:189-194`
- [x] A non-uuid id gives 404, not 400: `OT:263-272`; `OT:61,63` declare no 400

---

## Discrimination Sensor

Scratch: a copy of `apps/backend` (`src`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env`) in the session scratchpad, with `node_modules` symlinked. A pristine `src` was restored before each mutant. Each mutant is a single-occurrence replacement, and the script refuses a replacement that does not match exactly once. Mutants ran one vitest process at a time on `src/http` (179 tests). The unmutated scratch passed first (184/184 on `src/http` + `src/infra/seed`). The scratch was deleted afterwards.

| # | File:line | Mutant | Killed by | Result |
| - | --------- | ------ | --------- | ------ |
| D1 | `DC:7` | `showSeedUsers: true` (always) | `DT:76` in production | ✅ Killed (survived in iteration 1) |
| D2 | `DC:7` | `showSeedUsers: false` (never) | `DT:63` | ✅ Killed |
| D3 | `DC:7` | `!==`→`===` | `DT:63`, `DT:76` | ✅ Killed |
| D11 | `OD:102` | `failed` row with an empty meaning | `ODT:86` | ✅ Killed (survived in iteration 1) |
| D23 | `OD:100` | `pending` row with an empty meaning | `ODT:86` | ✅ Killed (survived in iteration 1) |
| D25 | `OD:101` | `sent` row with a whitespace-only meaning | `ODT:86` | ✅ Killed |
| E1 | `O:72` | login examples in reversed tenant order (Globex first) | `OT:296` | ✅ Killed |
| E2 | `O:73` | drop the first user of each tenant | `OT:296` | ✅ Killed |
| E3 | `O:211` | login examples even when hidden | `OT:315`, `DT:76` | ✅ Killed |
| E4 | `O:75` | invalid email in a login example | `OT:296`, `OT:400` | ✅ Killed |
| E5 | `O:73` | operator before admin within each tenant | `OT:296` | ✅ Killed |
| E21 | `O:209-212` | `{}` instead of `undefined` when hidden | `OT:315` | ✅ Killed |
| E6 | `O:84` | `priceCents: 24.9` | `OT:400` | ✅ Killed |
| E7 | `O:84` | sku `"MUG 01"` | `OT:400` | ✅ Killed |
| E8 | `O:126` | drop the create example | `OT:375`, `OT:400`, `OT:412` | ✅ Killed |
| E9 | `O:91` | update example `{}` (fails the refine) | `OT:400` | ✅ Killed |
| E10 | `O:150` | drop the update example | `OT:375`, `OT:400`, `OT:412` | ✅ Killed |
| E11 | `O:98` | `quantity: 0` | `OT:400` | ✅ Killed |
| E12 | `O:98` | `direction: "up"` | `OT:400` | ✅ Killed |
| E13 | `O:175` | drop the adjustment example | `OT:375`, `OT:400`, `OT:412` | ✅ Killed |
| E14 | `O:82` | a second create example | `OT:375` | ✅ Killed |
| E19b | `O:244` | update example only when seed users are shown | `OT:375` | ✅ Killed |
| E15 | `O:254` | drop "Use a new UUID for each new sale." | `OT:386` | ✅ Killed |
| E16 | `O:102` | Idempotency-Key example `crypto.randomUUID()` | `OT:386` | ✅ Killed |
| E17 | `O:255` | drop the Idempotency-Key example | `OT:386` | ✅ Killed |
| E18 | `O:259` | add a sale body example with a product id (unchecked example) | `OT:412` | ✅ Killed |
| R1 | `O:294` | `openapi: "3.0.0"` | `OT:88`, `DT:40` | ✅ Killed |
| R2 | `O:129` | drop 409 from `POST /products` | `OT:125`, `OT:134` | ✅ Killed |
| R3 | `DC:19` | Scalar `url` `/openapi.yaml` | `DT:97` | ✅ Killed |
| R4 | `O:274` | `/sync/status`→`/sync/state` | `DT:48`, `OT` (7 tests) | ✅ Killed |
| R5 | `O:217` | `Set-Cookie`→`X-Cookie` | `OT:324` | ✅ Killed |
| R6 | `O:306` | cookie scheme name `"token"` | `OT:276` | ✅ Killed |
| R7 | `O:159` | drop `adminOnly` from `DELETE /products/{id}` | `OT:330` | ✅ Killed |
| R8 | `DC:20` | `clientKey: "curl"` | `DT:106` | ✅ Killed |

An E19 variant that referenced `showSeedUsers` outside its scope only failed at module load. It was discarded as a trivial kill and replaced with E19b.

**Sensor depth**: lightweight+ (34 mutants: the 3 iteration-1 survivors plus one more DOCS-25 variant, every new AC from DOCS-27 to DOCS-30, and 8 regression spot-checks on DOCS-01..26)
**Result**: 34/34 killed - PASS ✅

Isolation: after cleanup, the real tree's `git status --porcelain` is byte-identical to the pre-sensor baseline. `git worktree list` shows only the main tree.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ (the G1 and G2 fixes are test-only; the seed is untouched) |
| No scope creep | ✅ (no query parameter examples, as the spec decided) |
| Matches patterns | ✅ |
| Spec-anchored outcome check | ✅ |
| Per-layer Coverage Expectation met | ✅ (the controller is now exercised in both environments) |
| Every test maps to a spec requirement | ✅ (`OT:367-425` → DOCS-28..30; `OT:296-322` → DOCS-27; `DT:70-94` → DOCS-22/27) |
| Documented guidelines followed: `CLAUDE.md` | ✅ (one why-comment at `O:69`) |

---

## Gate Check

- **Gate command**: `pnpm typecheck && pnpm test && pnpm lint:check` (root, real tree, read-only)
- **Result**: exit 0. stocksync-api: 19 files, 500 passed, 0 failed, 0 skipped. ads-mock: 35 passed. biome: "Checked 90 files ... No fixes applied."
- **Test count before feature**: 338
- **Test count after feature**: 500 (488 at iteration 1, plus 12 tests for G1 and DOCS-27..30)
- **Delta**: +162. No test was removed and no assertion was weakened. The DOCS-25 regex was tightened.

---

## Fix Plans

None.

Optional, not a gap: `O:102` is not tested against `idempotencyKeySchema`. It is pinned to an exact string, and that string was verified by hand to be a valid uuid.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| DOCS-01..DOCS-30 | Implemented | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 30/30 ACs matched the spec outcome; 0 spec-precision gaps
**Sensor**: 34/34 killed (D1, D11 and D23 from iteration 1 are now killed)
**Gate**: 500 passed, 0 failed (build gate exit 0)

**What works**: The production wiring hides the seed credentials, both in the description and in the login examples. The Sync status table requires a meaning in every row. The login examples are pinned by content and order. The body examples are pinned by count, by being the same in both environments, by schema validity and by completeness. The Idempotency-Key example is fixed and its description pinned. The seed matches `main`, and no example uses a seeded product id.

**Issues found**: none.

**Next steps**: commit the feature.
