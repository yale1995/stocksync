# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When a spec enumerates a set of variants, cover every variant with a table-driven test asserting each listed value
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `http` · harmful: 0
- features: errors
- evidence: ERR-02 / M5,M6 (http)
- last seen: 2026-10-04T02:57:57Z

### L-002 - Assert default values explicitly, not only caller-overridden ones
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `http` · harmful: 0
- features: errors
- evidence: M7 apps/backend/src/http/errors.ts:16 (http)
- last seen: 2026-10-04T02:57:57Z

### L-003 - Test shared middleware through the real app factory, not only a throwaway app
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `http` · harmful: 0
- features: errors
- evidence: M3 apps/backend/src/app.ts:11 (http)
- last seen: 2026-10-04T02:57:57Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
