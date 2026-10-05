# Sync Worker Validation

## Validation: sync-worker - PASS (iteration 3)

**Date**: 2026-10-05
**Spec**: `.specs/features/sync-worker/spec.md` (WRK-01..WRK-16 + 2 edge cases)
**Diff range**: uncommitted working tree on `feat/sync-worker`. Since iteration 2: only `sync.worker.test.ts` (test "names the superseded and sent events with the service's counts" rewritten, unused helper `twoCamPEvents` removed). No production code changed.
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 3 of max 3

G8 is closed. The superseded log line is now discriminated across products, and both iteration-2 survivors are killed.

### Iteration 3: re-verification of G8

`WT` = `apps/backend/src/modules/sync/sync.worker.test.ts`, `W` = `apps/backend/src/modules/sync/sync.worker.ts`.

| Criterion | Spec outcome | Evidence (`file:line` - assertion) | Result |
| --- | --- | --- | --- |
| WRK-16 superseded | `SKU vN` with the version that replaced it | `WT:655-685` - one batch with BON-01, two CAM-P events and MEIA-01, recorded in that order so CAM-P's kept event sits between the other two by version; `toEqual([`tenant ${acme}: CAM-P v${older} superseded by v${newer}`, ...])` | ✅ |
| WRK-16 sent + counts | sent list with `applied`/`ignored` | `WT:683` - `sent BON-01 vB, CAM-P vN, MEIA-01 vM (applied 2, ignored 1)`: exact version order and asymmetric counts | ✅ |

**Sensor (iteration 3)**: same isolation as iteration 2. `apps/backend` (`src`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env`) copied to a scratch directory with `node_modules` symlinked; the real tree was never mutated while `tsx watch src/worker.ts` runs against `stocksync`. Tests ran against `stocksync_test`, one vitest at a time. The new test passed on the unmutated copy first. Each mutant was an exact single-occurrence replacement of `W:101`, restored from a backup with the hash checked. The scratch copy (including `.env`) and the iteration-2 scratch were deleted afterwards.

| # | Mutant (`W:101`) | Result |
| --- | --- | --- |
| LW8 | `const newer = kept[kept.length - 1];` | killed (`WT:655`, 1 failed / 27 passed) |
| LW16 | `const newer = kept[0];` | killed (`WT:655`, 1 failed / 27 passed) |

2 mutants: 2 killed. Cumulative over iterations 0-3: every non-equivalent survivor is closed except E1/E2 (env schema, accepted by plan as G7 in iteration 1).

**Gate (iteration 3)**: `vitest run src/modules/sync` (real tree) → 4 files, **74 passed**, 0 failed, 0 skipped (the test was rewritten in place, so the count is unchanged). `tsc --noEmit` clean; `biome check src/modules/sync src/worker.ts`: "Checked 10 files. No fixes applied."

**Isolation**: real-tree SHA-1 of every sync source and test, `src/worker.ts` and `src/infra/env.ts` are identical before and after the sensor (`sync.worker.ts` `f575c54d`, `sync.worker.test.ts` `e3acc40a`, `sync.repository.ts` `acbb3017`, `ads-client.ts` `ea928f20`, `ads-client.test.ts` `05d0b86b`, `token-bucket.ts` `abf153a1`, `token-bucket.test.ts` `0ada8f48`, `worker.ts` `6c57af51`, `env.ts` `bea5ecba`). Porcelain unchanged (17 entries); only `validation.md` was written.

**Traceability**: WRK-16 → ✅ Verified. All of WRK-01..WRK-16 are now ✅ Verified (WRK-01 by execution, WRK-02 by inspection, as in iteration 1).

**Summary**: ✅ Ready. G8 closed; no open gaps. Reminder from iteration 0: add `ADS_API_URL`/`ADS_API_KEY` to the local `apps/backend/.env` if not done yet.

---

## Iteration 2 report (superseded by iteration 3)

### Iteration 2 verdict: FAIL

**Date**: 2026-10-05
**Spec**: `.specs/features/sync-worker/spec.md` (WRK-01..WRK-16 + 2 edge cases)
**Diff range**: uncommitted working tree on `feat/sync-worker`. Since iteration 1: `ads-client.ts` (2xx body parsed into `outcome`), `sync.worker.ts` (per-event log lines, failure loop refactored to `failed`/`delayMs`), new tests in `ads-client.test.ts` and `sync.worker.test.ts` (describe "log"), spec WRK-16 and the "Items order in a batch" assumption confirmed.
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 2 of max 3

One gap: the superseded log line is not tested with more than one product in the batch, so a mutant that names another product's version survives (G8). Everything else in WRK-16 is pinned to exact strings, the client's `outcome` parsing is discriminating, and the failure-loop refactor keeps the iteration-1 DB semantics (every mutant on it is killed).

### Iteration 2: WRK-16 and regression of WRK-03..05, WRK-13

`WT` = `apps/backend/src/modules/sync/sync.worker.test.ts`, `CT` = `apps/backend/src/modules/sync/ads-client.test.ts`, `W` = `apps/backend/src/modules/sync/sync.worker.ts`, `C` = `apps/backend/src/modules/sync/ads-client.ts`.

| Criterion | Spec outcome | Evidence (`file:line` - assertion) | Result |
| --- | --- | --- | --- |
| WRK-16 superseded | `SKU vN` with the version that replaced it | `WT:663-675` - `toEqual([`...CAM-P v${older} superseded by v${newer}`, ...])` | ⚠️ single product only; G8 (mutants LW8, LW16 survive) |
| WRK-16 sent + counts | sent list with `applied`/`ignored` when present | `WT:663-675` - `sent CAM-P vN (applied 0, ignored 1)` (asymmetric counts catch a swap); `WT:677-684` - no suffix without `outcome` | ✅ |
| WRK-16 failure | error, `attempt N/MAX`, retry delay; `-> failed` at max | `WT:686-703` - `HTTP 500 (attempt 1/2, retry in 0.5 s)`, `HTTP 500 (attempt 2/2) -> failed`; 0.5 s equals the stored +500 ms asserted in `WT:309-346` | ✅ |
| WRK-16 rate limited | batch with its Retry-After | `WT:705-716` - `rate limited, CAM-P vN retry in 2.0 s` | ✅ |
| WRK-16 client counts | counts read from a 2xx body; absent/invalid body still ok | `CT:74-77` - `toEqual({ kind: "ok", outcome: { applied: 1, ignored: 0 } })`; `CT:97-112` - not JSON / JSON without counts → `toStrictEqual({ kind: "ok" })`; `CT:86-95` 201/204 empty body → ok | ✅ |
| WRK-03 (regression) | POST `/updates`, `X-Api-Key`, body shape | `CT:78-83` - `toEqual({ method: "POST", url: "/updates", key: "secret", body: { tenantId, items } })` | ✅ |
| WRK-04 (regression) | 2xx ok; 429 Retry-After ms; else `HTTP <status>` | `CT:114-145`; error bodies still cancelled unread (`C:74-75`), so `last_error` never carries the body | ✅ |
| WRK-05 (regression) | `timeout` / `network error` | `CT:147-167` | ✅ |
| WRK-13 (regression) | `attempts+1`, `last_error`, `failed` at max, else backoff × random | `WT:309-346`, `WT:348-373` (`[500, 1000, 2000, 2500]`, `failed`, `attempts: 5`), `WT:375-387`. Refactor at `W:140-149`: `failed` → `nextAttemptAt: null` → `status: "failed"` with `next_attempt_at` untouched (`sync.repository.ts:154`); otherwise `now + backoffMs(attempts)`; the logged delay is the same `delayMs` that is stored | ✅ |

Spec precision: WRK-16 lists the content of each line, not its exact wording; the tests pin the implementation's wording with `toEqual`, which is stricter than the spec and acceptable for a log.

**Sensor (iteration 2)**: mutants were applied to copies in an isolated scratch (`scratchpad/sync-worker/backend`, `src` copied, `node_modules` symlinked), never to the real tree, because `tsx watch src/worker.ts` is running against the `stocksync` DB and would hot-reload an in-place mutant. Each mutant was restored from a backup and its hash checked (`restored-identical` for all). One vitest at a time, test DB `stocksync_test`.

| # | Mutant | Result |
| --- | --- | --- |
| LM1 | 2xx returns `{ kind: "ok" }` without `outcome` | killed (`CT:72`) |
| LM2 | always `{ kind: "ok", outcome }` (undefined key) | killed (`CT:97`, 2 tests, `toStrictEqual`) |
| LM3 | `readOutcome` rethrows instead of tolerating | killed (`CT:86`, `CT:97`, 3 tests) |
| LM4 | body cast without Zod validation | killed (`CT:97` JSON without counts) |
| LM5 | `last_error` includes the error body | killed (`CT:135`, 4 tests) |
| LM6 | 5xx body parsed as an outcome and returned ok | killed (`CT:135`, 2 tests) |
| LW1 | counts omitted | killed (`WT:663`) |
| LW2 | applied/ignored swapped | killed (`WT:663`) |
| LW3 | attempt shown as `event.attempts` (off by one) | killed (`WT:686`) |
| LW4 | logged delay is the cap, not the stored jittered delay | killed (`WT:686`) |
| LW5 | `failed` threshold `>` instead of `>=` | killed (3 tests) |
| LW6 | `-> failed` line replaced by a retry line | killed (`WT:686`) |
| LW7 | superseded names its own version | killed (`WT:663`) |
| **LW8** | superseded names `kept[kept.length - 1]` instead of the same product | **survived** |
| **LW16** | superseded names `kept[0]` | **survived** |
| LW9 | rate-limited seconds divided by 1000 again | killed (`WT:705`) |
| LW14 | rate-limited line drops the event list | killed (`WT:705`) |
| LW10 | `nextAttemptAt` stored when `failed` (never becomes `failed`) | killed (2 tests) |
| LW11 | `nextAttemptAt: null` when not failed | killed (5 tests) |
| LW12 | stored delay uses `attempts - 1` | killed (4 tests) |
| LW15 | `last_error` gets an attempt suffix | killed (2 tests) |

21 mutants: 19 killed, 2 survived (same gap G8).

**Gate (iteration 2)**: `vitest run src/modules/sync` (real tree, final clean run) → 4 files, **74 passed**, 0 failed, 0 skipped (`CT` 12 → 14, `WT` 24 → 28). `tsc --noEmit` (apps/backend) clean; `biome check` on `src/modules/sync` and `src/worker.ts`: "Checked 10 files. No fixes applied." The full backend suite was not re-run; only sync files changed.

**Isolation**: `git status --porcelain`, `git diff | shasum` (`3f6f9e28...`) and the hashes of every untracked file match the pre-sensor baseline, except `validation.md`, which this report updates.

### Fix plan

#### G8 (Minor): superseded log line not discriminated across products (WRK-16, LW8, LW16)

- **Root cause**: `WT:663-675` coalesces a single product, so `kept` has one event and any choice from `kept` names the right version.
- **Fix task**: in that test (or a new one under "log"), put three products in one batch so the superseded product's kept event sits between two others by version: e.g. one BON-01 event, two CAM-P events, one MEIA-01 event. Assert `CAM-P v<older> superseded by v<newer CAM-P>` exactly. LW8 (last kept) and LW16 (first kept) must both fail.

**Traceability**: WRK-03, WRK-04, WRK-05, WRK-13 stay ✅ Verified. WRK-16 → ❌ Needs Fix (G8). Every other requirement is unchanged from iteration 1.

**Assumption**: "Items order in a batch" is now confirmed (`spec.md`, Assumptions table), and the code comment at `W:111-113` matches the corrected rationale. The open item from iteration 1 is closed.

---

## Iteration 1 report (superseded by iteration 2)

### Iteration 1 verdict: PASS

**Date**: 2026-10-05
**Spec**: `.specs/features/sync-worker/spec.md` (WRK-01..WRK-15 + 2 edge cases); source of truth `docs/prompts/05-sync.md`; rules `CLAUDE.md`
**Diff range**: uncommitted working tree on `feat/sync-worker` (same file set as iteration 0). Since iteration 0, the only changes are new tests in `sync.worker.test.ts` and `ads-client.test.ts`, plus one comment in `sync.worker.ts:98-100` above `client.sendUpdates`. No logic changed: `env.ts`, `ads-client.ts`, `token-bucket.ts` and `sync.repository.ts` are byte-identical to the iteration-0 backups.
**Verifier**: independent sub-agent (author ≠ verifier)
**Iteration**: 1 of max 3

The implementation is ready. Nine of the ten real mutants that survived iteration 0 are now killed by tests that assert outcomes from the spec. The tenth, R4 (pick without the `version` tiebreak), cannot be killed deterministically by a black-box test (see below). G7 is accepted on execution evidence, as the author agreed.

### Iteration 1: re-verification of G1-G7

| Gap | New test (`WT` = `apps/backend/src/modules/sync/sync.worker.test.ts`, `CT` = `apps/backend/src/modules/sync/ads-client.test.ts`) | Spec outcome asserted | Mutants |
| --- | --- | --- | --- |
| G1 (WRK-07 SKIP LOCKED) | `WT:484-495`: Acme's rows are locked by an open transaction, and `tick()` is raced against a 3 s timeout. It returns `true`, and the only call goes to `[globex]`. `WT:497-510`: Acme CAM-P rows are locked, and the tick sends exactly `["BON-01"]` for Acme | Locked rows are skipped and the tick does not block | R1 killed (2 tests), R2 killed (`WT:497`) |
| G2 (WRK-07 pick order) | `WT:512-527`: Acme is due at now−1000 and Globex at now−5000, so `[globex]` goes first even though its versions are higher. `WT:529-546`: on a `next_attempt_at` tie, the lowest version goes first, giving `[globex, acme]` | `ORDER BY next_attempt_at, version` | R3 killed (2 tests), R5 killed (`WT:529`), **R4 survived** |
| G3 (WRK-07 batch size, claim order) | `WT:548-574`: with `batchSize: 2` and 3 events, the calls are `[["CAM-P","BON-01"],["MEIA-01"]]`, and the third event is `sent` on the 2nd tick | At most `SYNC_BATCH_SIZE`, lowest versions first | R8, R9 killed (`WT:548`) |
| G4 (WRK-09 coalesce when the send does not succeed) | `WT:257-279` `it.each` with HTTP 500 and 429: statuses `["superseded","superseded","pending"]` | Older events of the product are superseded whatever the send result | W3 killed (2 tests) |
| G5 (WRK-06 token before `BEGIN`) | `WT:626-649`: the injected `sleep` counts `idle in transaction` backends in `pg_stat_activity`. It is called exactly once (2nd tick, rate 5), and the count is `[0]`. Not vacuous, because `toEqual([0])` requires one sleep | No transaction is open while the worker waits for a token | W13 killed (`WT:627`) |
| G6 (WRK-04 any 2xx) | `CT:83-92` `it.each([201, 204])` → `{ kind: "ok" }` | 2xx → ok | A9 killed (2 tests) |
| G7 (WRK-01 env) | No test. The iteration-0 execution evidence (`apps/backend/src/infra/env.ts:11-19`) is accepted, as in `ads-mock` | Defaults and required `ADS_*` | E1, E2 accepted by agreement |

**R4, accepted residual (not a fix task).** Without the tiebreak, Postgres returns tied rows in an undefined order, and the correct order is one of the possible results. A test can kill R4 only by relying on the physical heap order, which is an implementation detail and a source of flakiness. In `WT:529`, Acme's tuples come first on the heap after the bulk reset, so R4 happens to pick Acme as well. The iteration-0 fix plan already expected this. The tiebreak is present by inspection at `apps/backend/src/modules/sync/sync.repository.ts:33` (`asc(syncEvents.nextAttemptAt), asc(syncEvents.version)`), and R5 (`version desc`) is killed. That kill shows the tiebreak column and its direction are tested whenever Postgres has to honour it.

**Equivalent mutants**: R12-R16 and R17 are unchanged and still equivalent. The `sync.worker.ts:98-100` comment change has no behavior impact.

**Flakiness**: the 8 new `WT` tests (claiming, token before the transaction, coalescing on a non-ok send) passed 3 times in a row with `-t` (8 passed each run, about 2.5 s). The lock tests use separate pool connections and release the lock when the test transaction ends. `fileParallelism: false` (`apps/backend/vitest.config.ts:11`) keeps other files from holding transactions during the `pg_stat_activity` check.

**Sensor (iteration 1)**: re-ran the 10 real survivors with the same exact-text mutants and runner. Each mutant was restored from a backup and its SHA-256 checked afterwards: `restored=ok` for all 10. `sync.worker.ts` was re-backed up after the comment change. 9 were killed and R4 survived (accepted residual). Overall: 58 mutants, 49 killed, 6 equivalent, 1 accepted residual (R4), 2 env survivors accepted (E1, E2).

**Gate (iteration 1)**: `npx vitest run src/modules/sync` → 4 files, **68 passed**, 0 failed, 0 skipped. `pnpm typecheck` ok (turbo cache hit on the current inputs). `pnpm lint:check` "Checked 78 files. No fixes applied." Feature tests went from 30 to 40 (`CT` 10 → 12, `WT` 16 → 24, `BT` 4). The full backend suite was not re-run, and only sync test files changed.

**Traceability**: WRK-04, WRK-06, WRK-07 and WRK-09 move from Needs Fix to ✅ Verified. WRK-07 also relies on inspection for the tiebreak's role (R4). Every other requirement is unchanged from iteration 0.

**Open, not blocking**: the "Items order in a batch" assumption (`spec.md:31`) still says "n" and is waiting for the user's decision. Operational note from iteration 0: add `ADS_API_URL`/`ADS_API_KEY` to the local `.env`.

**Lessons**: none recorded in this iteration. The clean re-verification adds no new failure, and the iteration-0 gaps were already distilled.

---

## Iteration 0 report (superseded by iteration 1)

Iteration 0 verdict: not ready (10 real survivors). Kept below for the record.

**Iteration**: 0

The implementation matches the spec on every AC when read against the code. The verdict is FAIL because 10 non-equivalent mutants on explicit SHALLs survive. All the gaps are in the tests, and no code fix is needed:

- WRK-07: no test exercises `FOR UPDATE SKIP LOCKED` (pick or claim), the pick order `next_attempt_at, version`, or `SYNC_BATCH_SIZE` with the claim order.
- WRK-09: no test checks that coalesced events are superseded when the send does not succeed.
- WRK-06: no test checks that the token is taken *before* the transaction opens.
- WRK-04: no test covers a 2xx other than 200.

Everything else is discriminated, with assertions that target the exact outcomes the spec defines. That covers the backoff formula with jitter and cap, failure at max attempts, 429 leaving `attempts` unchanged, `Retry-After` × 1000, timeout vs network error, a body that never leaks, crash rollback, version-sorted items, supersede limited to pending/failed of the same product, and the `run` loop.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 Env variables | ✅ Done | `env.ts:11-19`, `vitest.config.ts:18-26`; verified by execution (see WRK-01) |
| T2 HTTP AdsClient | ✅ Done (one 2xx gap) | `ads-client.ts:28-66`; see G6 |
| T3 Token bucket | ✅ Done | `token-bucket.ts:4-21` |
| T4 Worker tick and repository | ⚠️ Done, tests not discriminating for WRK-07 locking/ordering/batch size, WRK-09 non-ok path, WRK-06 placement | `sync.worker.ts:58-154`, `sync.repository.ts:17-157`; see G1-G5 |
| T5 Entry point and scripts | ✅ Done | `worker.ts:1-45`, `package.json:8,11`; author's manual end-to-end run (mock `FAILURE_RATE` 0.5) accepted as context |

---

## Spec-Anchored Acceptance Criteria

`WT` = `apps/backend/src/modules/sync/sync.worker.test.ts`, `CT` = `apps/backend/src/modules/sync/ads-client.test.ts`, `BT` = `apps/backend/src/modules/sync/token-bucket.test.ts`, `W` = `apps/backend/src/modules/sync/sync.worker.ts`, `R` = `apps/backend/src/modules/sync/sync.repository.ts`, `C` = `apps/backend/src/modules/sync/ads-client.ts`, `TB` = `apps/backend/src/modules/sync/token-bucket.ts`.

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| WRK-01 env: `ADS_*` required, `SYNC_*` defaults | 50 / 5 / 3000 / 5 / 1000 / 60000 / 1000; missing `ADS_*` rejected | **No automated test** (by plan: `tasks.md` matrix "Env and entry point: none"). Verified by execution against `apps/backend/src/infra/env.ts:11-19` with only the base vars plus `ADS_API_URL`/`ADS_API_KEY`: `{"SYNC_BATCH_SIZE":50,"SYNC_RATE_LIMIT_PER_SECOND":5,"SYNC_REQUEST_TIMEOUT_MS":3000,"SYNC_MAX_ATTEMPTS":5,"SYNC_BACKOFF_BASE_MS":1000,"SYNC_BACKOFF_MAX_MS":60000,"SYNC_POLL_INTERVAL_MS":1000}`. Without them: "Invalid environment variables: ✖ … → at ADS_API_URL ✖ … → at ADS_API_KEY". E1, E2 survive by construction | ✅ PASS (execution only, G7) |
| WRK-02 `src/worker.ts`, `worker`/`dev:worker` with same `.env`, stops on SIGINT/SIGTERM | scripts present, signals end the loop | Inspection: `apps/backend/package.json:8` `tsx watch --env-file-if-exists=.env src/worker.ts`, `:11` `node --env-file-if-exists=.env dist/worker.js` (same flag as `dev`/`start`); `tsconfig.build.json` includes `src` so `dist/worker.js` is emitted; `apps/backend/src/worker.ts:7-10` `process.once` SIGINT/SIGTERM → `controller.abort()`, `:13-17` abortable sleep, `:40-45` `pool.end()` in `finally`. Author's manual run accepted | ✅ PASS (inspection + manual run) |
| WRK-03 `POST {url}/updates`, `X-Api-Key`, body `{ tenantId, items }` | exact method, path, header, body | `CT:74-80` `toEqual({ method: "POST", url: "/updates", key: "secret", body: { tenantId: TENANT, items: ITEMS } })`. A4, A5, A6 killed | ✅ PASS |
| WRK-04 2xx → ok; 429 → `Retry-After` ms; other → `HTTP <status>` | `{kind:"ok"}`, `retryAfterMs: 2000`, `"HTTP 500"` etc. | `CT:74` ok on 200; `CT:86-89` `retryAfterMs: 2000`; `CT:92-102` fallback 1000 (missing, non-numeric); `CT:104-114` `it.each([500,503,401,400])` → `error: \`HTTP ${status}\`` (exact, so the body cannot leak). A1, A3, A7, A8 killed. **Only 200 is tested as 2xx; A9 (`response.ok` → `status === 200`) survived** | ❌ GAP (G6) |
| WRK-05 timeout → `timeout`; connection failure → `network error` | exact labels | `CT:116-125` server never answers, `timeoutMs` 50 → `error: "timeout"`; `CT:127-136` closed server → `error: "network error"`. A2, A10 killed | ✅ PASS |
| WRK-06 token taken before the transaction; at most rate/s | spacing 1000/rate, ≤ rate in any 1 s window, take before `BEGIN` | `BT:31-32` takes at `[10000,10200,…,11000]`, sleeps `[200×5]`; `BT:46-49` ≤ 5 per window over 20 irregular takes; `BT:62`, `BT:73` no wait / remainder 50. `WT:478-496` ticks spaced `[200, 200]`. T1-T4, W14 killed. Code `W:75` `await takeToken()` precedes `W:77` `db.transaction`. **W13 (token taken inside the transaction) survived: no test pins the placement** | ❌ GAP (G5) |
| WRK-07 pick by `next_attempt_at, version`; claim ≤ `SYNC_BATCH_SIZE` by `version`, `FOR UPDATE SKIP LOCKED` | oldest due tenant first, batch capped, locked rows skipped | Code `R:26-36` pick (order `R:33`, `skipLocked` `R:35`), `R:39-60` claim (tenant filter `R:56`, order `R:57`, `limit` `R:58`, `skipLocked` `R:59`). Tests: `WT:199-206` Acme then Globex (R6, R7, R10, R11 killed). **R1/R2 (no SKIP LOCKED), R3/R4/R5 (pick order), R8 (claim order desc), R9 (batch size ignored) all survived**: no concurrent-lock test, no test where order by `next_attempt_at` and by `version` disagree, every test uses `batchSize` 50 with fewer events | ❌ GAP (G1, G2, G3) |
| WRK-08 nothing due → nothing sent, reports false | `tick()` → `false`, no call | `WT:220-226` `toBe(false)`, `calls` `toEqual([])`; also `WT:301-302`, `WT:346`, `WT:379` not-yet-due → `false` | ✅ PASS |
| WRK-09 keep highest version per product, others `superseded`, items sorted by `version` | one item, older two `superseded`; version order | `WT:240-254` statuses `[superseded, superseded, sent]`, single exact item `{ sku, stock: 22, priceCents: 5990, version }`; `WT:274-278` deleted then recreated CAM-P in version order. W1, W2, W4 killed. **W3 (coalesced events not marked `superseded`) survived**: on 2xx `supersedeOlderEvents` covers them, and no test coalesces on a failed or 429 send | ❌ GAP (G4) |
| WRK-10 single tenant per batch; two tenants in separate batches | Acme batch, then Globex batch | `WT:171-196` call 1 tenant Acme, items exactly Acme's events, Globex still `["pending","pending"]`; `WT:206-217` `[acme, globex]`, Globex CAM-P `priceCents` 5490. R7 killed | ✅ PASS |
| WRK-11 2xx → `sent` + `sent_at`; older pending/failed of same products → `superseded` | `status "sent"`, `sentAt = clock`; older failed and not-yet-due pending superseded; other products/tenants untouched | `WT:185-188` `sentAt` `toEqual(clock.now())`; `WT:388-407` older failed → `superseded`; `WT:409-425` older not-due pending → `superseded`, attempts 1 kept; `WT:427-447` failed events of another product and of Globex CAM-P stay `failed`. R18 (includes `sent`, killed by `WT:478`), R19, R20, R23, W5 killed | ✅ PASS |
| WRK-12 429 → `next_attempt_at = now + Retry-After`, `last_error 'HTTP 429'`, attempts unchanged | attempts 0, `+2000` ms, due exactly at +2000 | `WT:371-383` `toMatchObject({ status: "pending", attempts: 0, lastError: "HTTP 429" })`, `nextAttemptAt` `= now + 2000`, `false` at +1999, `true` at +2000. R21, W6, W7, W8 killed | ✅ PASS |
| WRK-13 failure → attempts+1, `last_error`; `failed` at max; else `min(MAX, BASE·2^(n−1))·random()` | delays 500/1000/2000/2500 with random 0.5, max 5000; `failed` at attempt 5 | `WT:338` `delays` `toEqual([500, 1000, 2000, 2500])` (cap reached at attempt 4); `WT:339-344` `{ status: "failed", attempts: 5, lastError: "HTTP 503", sentAt: null }`; `WT:345-346` never picked again; `WT:349-361` random 0.25, base 4000 → 1000; `WT:293-299` `lastError "HTTP 500"`, `WT:307-311` `"timeout"`. W9, W10, W11, W12, W19, R22 killed | ✅ PASS |
| WRK-14 throw before commit → claimed events stay pending, due, attempts unchanged | rows identical to before | `WT:451-474` client throws; `eventsOf` after `toEqual(before)` (every column), both `pending`. W15 (no transaction) killed | ✅ PASS |
| WRK-15 loop ticks again after claims, waits poll interval otherwise | no sleep after a claiming tick; one poll sleep when idle; survives a failing tick | `WT:500-522` two claiming ticks, exactly one `pollIntervalMs` sleep and it is the last; `WT:524-554` `logs[0]` `"tick failed: connection reset"`, 3 ticks, all events `sent`. W16 (timeout), W17, W18 killed | ✅ PASS |

**Edge cases**

- [x] Two failures then a success → `sent` with `attempts = 2`: `WT:283-320` `toMatchObject({ status: "sent", attempts: 2 })`, `sentAt` = clock, 3 calls
- [x] Deleted and recreated SKU in one batch → recreated item last: `WT:257-279` exact two items ordered by version (W2 killed)

**Status**: ❌ 4 ACs with test gaps (WRK-04, WRK-06, WRK-07, WRK-09). 0 spec-precision gaps: every AC states a precise outcome. One spec assumption ("Items order in a batch") is still "Confirmed? n". The "Token bucket capacity" assumption changed to "y (asked the user)" during this run (`spec.md` mtime 14:42:50, edited outside the Verifier).

---

## Discrimination Sensor

Baseline before the sensor: `git status --porcelain` saved, `git diff | shasum` = `7f5170b8adbe8908abf4fda54eecf32d07b01a97`, and `shasum` of all 12 untracked files. The five mutated sources (`env.ts`, `ads-client.ts`, `token-bucket.ts`, `sync.repository.ts`, `sync.worker.ts`) were backed up to the session scratchpad. Each mutant was an exact-text replacement: one occurrence, or a fixed occurrence index for the identical tenant-filtered `where` clauses. Each one ran with `npx vitest run` on the three sync test files, one vitest at a time with a 180 s hard kill, and the file was then copied back and checked against the backup SHA-256 ("restored=ok" after all 58). No `git stash` or `checkout` was used. After the sensor, porcelain and the diff hash matched the baseline. 11 of the 12 untracked hashes matched. `.specs/features/sync-worker/spec.md` changed at 14:42:50, during the run, and the sensor never touches `.specs/`. The only change is the Token bucket assumption row going from "n" to "y (asked the user)", so the edit came from outside the Verifier.

| # | File:line | Mutation | Killed? |
| - | --------- | -------- | ------- |
| R1 | `R:35` | pick without `skipLocked` | ❌ Survived → G1 |
| R2 | `R:59` | claim without `skipLocked` | ❌ Survived → G1 |
| R3 | `R:33` | pick ordered by `version` only | ❌ Survived → G2 |
| R4 | `R:33` | pick without the `version` tiebreak | ❌ Survived → G2 |
| R5 | `R:33` | pick tiebreak `version desc` | ❌ Survived → G2 |
| R6 | `R:33` | pick `next_attempt_at desc` | ✅ Killed (4 tests) |
| R7 | `R:56` | claim without tenant filter | ✅ Killed (`WT:161`) |
| R8 | `R:57` | claim `version desc` | ❌ Survived → G3 |
| R9 | `R:58` | claim ignores `SYNC_BATCH_SIZE` | ❌ Survived → G3 |
| R10 | `R:19` | due without `status = 'pending'` | ✅ Killed (11 tests) |
| R11 | `R:20` | due `<=` → `<` | ✅ Killed (3 tests) |
| R12 | `R:74` | `markSuperseded` without tenant filter | ⚪ Equivalent: ids are global UUIDs; filter is defense in depth (`CLAUDE.md`), present by inspection |
| R13 | `R:86` | `markSent` without tenant filter | ⚪ Equivalent (same reason) |
| R14 | `R:129` | `rescheduleEvents` without tenant filter | ⚪ Equivalent (same reason) |
| R15 | `R:156` | `recordFailure` without tenant filter | ⚪ Equivalent (same reason) |
| R16 | `R:102` | `supersedeOlderEvents` without tenant filter | ⚪ Equivalent: `product_id` is a global UUID |
| R17 | `R:108` | supersede `lt` → `lte` | ⚪ Equivalent: `markSent` (`W:105`) already set the kept event to `sent`, outside `["pending","failed"]` |
| R18 | `R:103` | supersede also `sent` events | ✅ Killed (`WT:478`) |
| R19 | `R:103` | supersede only `pending` (not `failed`) | ✅ Killed (`WT:388`) |
| R20 | `R:107` | supersede any product with a lower version | ✅ Killed (`WT:427`) |
| R21 | `R:128` | 429 sets `attempts` | ✅ Killed (`WT:363`) |
| R22 | `R:154` | max attempts never sets `failed` | ✅ Killed (2 tests) |
| R23 | `R:85` | `markSent` without `sent_at` | ✅ Killed (12 tests) |
| W1 | `W:42` | coalesce keeps the lowest version | ✅ Killed (`WT:230`) |
| W2 | `W:46` | kept sorted `version desc` | ✅ Killed (3 tests) |
| W3 | `W:91` | coalesced events not marked `superseded` | ❌ Survived → G4 |
| W4 | `W:100` | send every claimed event, not the kept ones | ✅ Killed (`WT:230`) |
| W5 | `W:106` | no supersede after a send | ✅ Killed (2 tests) |
| W6 | `W:114` | 429 `last_error` `"rate limited"` | ✅ Killed (`WT:363`) |
| W7 | `W:111` | 429 handled as a failure | ✅ Killed (`WT:363`) |
| W8 | `W:113` | 429 ignores `Retry-After` (fixed 1 s) | ✅ Killed (`WT:363`) |
| W9 | `W:126` | failed at max `>=` → `>` | ✅ Killed (2 tests) |
| W10 | `W:32` | backoff `2 ** attempts` | ✅ Killed (3 tests) |
| W11 | `W:32` | backoff without jitter | ✅ Killed (3 tests) |
| W12 | `W:32` | backoff without the max cap | ✅ Killed (`WT:322`) |
| W13 | `W:75-77` | token taken inside the transaction | ❌ Survived → G5 |
| W14 | `W:75` | token not taken | ✅ Killed (`WT:478`) |
| W15 | `W:77,138` | no transaction (crash rollback) | ✅ Killed (`WT:451`) |
| W16 | `W:149` | `run` never sleeps | ✅ Killed (suite hangs, 180 s kill) |
| W17 | `W:149` | `run` sleeps after a claiming tick | ✅ Killed (`WT:500`) |
| W18 | `W:146` | `run` rethrows a tick error | ✅ Killed (`WT:524`) |
| W19 | `W:102` | outcome timestamps from the real clock | ✅ Killed (5 tests) |
| A1 | `C:22` | `Retry-After` not × 1000 | ✅ Killed (`CT:83`) |
| A2 | `C:51` | timeout mapped as `network error` | ✅ Killed (`CT:116`) |
| A3 | `C:54,63` | response body appended to the error | ✅ Killed (4 tests) |
| A4 | `C:45` | header `X-Key` | ✅ Killed (`CT:48`) |
| A5 | `C:37` | path `/update` | ✅ Killed (`CT:48`) |
| A6 | `C:46` | body without `tenantId` | ✅ Killed (`CT:48`) |
| A7 | `C:57` | 429 not recognized | ✅ Killed (3 tests) |
| A8 | `C:17` | default `Retry-After` 2 s | ✅ Killed (2 tests) |
| A9 | `C:56` | only 200 is ok, not any 2xx | ❌ Survived → G6 |
| A10 | `C:47` | no request timeout | ✅ Killed (`CT:116`) |
| T1 | `TB:13` | interval `1000 / (rate + 1)` | ✅ Killed (4 tests) |
| T2 | `TB:19` | next slot from the pre-sleep time | ✅ Killed (3 tests) |
| T3 | `TB:18` | `<` → `<=` | ✅ Killed (`BT:52`) |
| T4 | `TB:14,18` | burst of 5 (capacity 5) | ✅ Killed (3 tests) |
| E1 | `env.ts:13` | `SYNC_BATCH_SIZE` default 20 | ❌ Survived (no env tests by plan) → G7 |
| E2 | `env.ts:12` | `ADS_API_KEY` optional | ❌ Survived (no env tests by plan) → G7 |

**Sensor depth**: P0-expanded (data integrity: ordering, duplicates, crash safety, tenant isolation); 58 manual behavior-level mutations
**Sensor outcome**: 40/58 killed. 18 survived: 6 are equivalent (R12-R17), 10 are test gaps on explicit SHALLs (R1, R2, R3, R4, R5, R8, R9, W3, W13, A9) and 2 sit in the env schema, which is untested by plan (E1, E2). Not ready ❌

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code: one client, one bucket function, one worker factory, repository functions per write | ✅ |
| Surgical changes: only `env.ts`, `vitest.config.ts`, `package.json`, `sync.repository.ts` and new sync files | ✅ |
| No scope creep: no `/sync/status`, no leases, no compose service | ✅ |
| Matches patterns: repository takes `Executor`, every write filters `tenant_id` except the documented cross-tenant pick (`R:22`) | ✅ |
| `CLAUDE.md` comments: only the non-obvious why (`R:22`, `R:89-90`, `C:26-27`, `C:53`, `TB:1-3`, `W:25-26`, `W:72-73`, `W:98-99`, `worker.ts:12`) | ✅ |
| `CLAUDE.md` database rules: no `DELETE`, statuses instead; timestamps from the injected clock into `timestamptz` columns | ✅ |
| Spec-anchored outcome check | ⚠️ WRK-04, WRK-06, WRK-07, WRK-09 partly undiscriminated |
| Every test maps to a spec AC or edge case | ✅ |
| Documented guidelines followed: `CLAUDE.md`, `docs/prompts/05-sync.md` | ✅ |

Operational note (not a spec violation): `ADS_API_URL`/`ADS_API_KEY` are required by the shared `infra/env.ts`, as `05-sync.md` asks. The API (`pnpm dev`), `db:migrate`/`db:generate` (`drizzle.config.ts` imports `env`) and `db:seed` therefore now fail without them, and the local `apps/backend/.env` does not define them. CI is unaffected because tests get them from `vitest.config.ts`. The user should add both keys to their `.env`.

Minor behavior note (not a gap): on SIGINT/SIGTERM during the token wait, the abortable sleep resolves early and that tick still runs one transaction before the loop exits (`W:75`, `worker.ts:13-17`, `W:142`). An in-flight HTTP call is not aborted and can take up to `SYNC_REQUEST_TIMEOUT_MS`. Both are harmless for a graceful stop.

---

## Gate Check

- **Gate command**: `pnpm typecheck && pnpm lint:check` (repo root) and `npx vitest run` (`apps/backend`, whole backend suite)
- **Result**: typecheck 2/2 tasks ok; biome "Checked 78 files. No fixes applied."; vitest **311 passed**, 0 failed, 0 skipped (14 files, 71 s)
- **Test count before feature**: 281
- **Test count after feature**: 311
- **Delta**: +30 (`CT` 10, `BT` 4, `WT` 16)
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

### G1 (Major): `FOR UPDATE SKIP LOCKED` not tested (WRK-07, R1, R2)

- **Root cause**: no test holds a lock while ticking.
- **Fix task**: in `WT`, open a transaction that locks Acme's due events (`SELECT … FOR UPDATE`) and keep it open. Then call `tick()` and assert that it returns `true` without blocking and that the single call went to Globex. With R1 or R2 applied, the tick blocks (test timeout) or picks Acme. Release the lock in `finally`.

### G2 (Major): pick order `next_attempt_at, version` not tested (WRK-07, R3, R4, R5)

- **Root cause**: in the seed, Acme's events have both the earlier `next_attempt_at` and the lower versions, so every ordering gives the same result.
- **Fix task**: (a) set Acme's due events to a later `next_attempt_at` than Globex's (both due) and assert Globex goes first (kills R3). (b) Discard the seed events, record a Globex event and then an Acme event (so Globex has the lower version), set both to the same `next_attempt_at`, and assert that Globex goes first. This kills R5 deterministically. R4 (no tiebreak) leaves the order to Postgres and may still survive.

### G3 (Major): `SYNC_BATCH_SIZE` and the claim order not tested (WRK-07, R8, R9)

- **Root cause**: every test uses `batchSize: 50` with at most a few due events.
- **Fix task**: with `overrides: { batchSize: 2 }` and three due events of one tenant on different products, assert the first call carries exactly the two lowest versions, the third event stays `pending`, and the next tick sends it.

### G4 (Minor): coalescing on a non-ok send not tested (WRK-09, W3)

- **Root cause**: on 2xx, `supersedeOlderEvents` also marks the coalesced events, which masks a missing `markSuperseded`.
- **Fix task**: three events for one product, `results: [{ kind: "error", error: "HTTP 500" }]`. Assert the two older events are `superseded` and the newest is `pending` with `attempts: 1`. Optionally add the same with a 429.

### G5 (Minor): token placement before `BEGIN` not tested (WRK-06, W13)

- **Root cause**: the fake clock makes spacing identical whether the token is taken before or inside the transaction.
- **Fix task**: inside the injected `sleep`, query `pg_stat_activity` for this database (or try `SELECT … FOR UPDATE NOWAIT` on the due events from a separate connection after a first tick has run) and assert that no transaction from the worker is open (`state <> 'idle in transaction'`) while it waits for a token. An alternative is to accept code inspection (`W:75` before `W:77`) explicitly in the spec.

### G6 (Minor): only HTTP 200 tested as success (WRK-04, A9)

- **Fix task**: add `it.each([201, 204])` (or at least 202) to `CT` asserting `{ kind: "ok" }`.

### G7 (Minor, accept like `ads-mock` G3): env schema without tests (WRK-01, E1, E2)

- **Root cause**: by plan; `env.ts` exits at import. Verified by execution in this report.
- **Fix task (optional)**: accept execution evidence explicitly, or export a `parseEnv(source)` and test defaults and the two required keys.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| WRK-03, WRK-05, WRK-08, WRK-10..WRK-15 | Implemented | ✅ Verified |
| WRK-01 | Implemented | ✅ Verified by execution (no automated test, G7) |
| WRK-02 | Implemented | ✅ Verified by inspection + author's manual run |
| WRK-04 | Implemented | ❌ Needs Fix (G6) |
| WRK-06 | Implemented | ❌ Needs Fix (G5) |
| WRK-07 | Implemented | ❌ Needs Fix (G1, G2, G3) |
| WRK-09 | Implemented | ❌ Needs Fix (G4) |

---

## Summary

**Overall**: ❌ Not Ready (iteration 0 of max 3)

**Spec-anchored check**: 11/15 ACs fully matched (WRK-01 by execution, WRK-02 by inspection); 4 ACs with test gaps; 0 spec-precision gaps.
**Sensor**: 58 mutations, 40 killed, 6 equivalent, 10 gaps, 2 env-schema survivors.
**Gate**: 311 passed, typecheck and lint clean.

**What works**: the retry state machine is pinned exactly: the backoff sequence 500/1000/2000/2500 with cap and jitter, `failed` at the 5th attempt and never picked again, 429 with `attempts` 0 and due at exactly +`Retry-After`. Supersede is limited to pending/failed events of the same product and tenant. Crash rollback leaves every column untouched. Items are version-sorted for delete + recreate. Batches are single-tenant. The HTTP client maps errors to exact labels with no body leak, and the token bucket spaces requests at 200 ms with no 5-burst. The `run` loop sleeps only when idle and survives a failing tick.

**Issues found**: G1-G3 (Major, WRK-07: locking, pick order, batch size) and G4-G6 (Minor). All are test-only additions in `sync.worker.test.ts` / `ads-client.test.ts`. G7 is optional.

**Next steps**: add the G1-G6 tests (each must fail with its mutant applied), re-run `pnpm --filter stocksync-api test`, and re-dispatch the Verifier. Add `ADS_API_URL`/`ADS_API_KEY` to the local `.env`.
