# Agent Rules

## Code comments

- Avoid comments that restate what the code does; prefer clear names and small functions.
- Comment only the non-obvious *why*: decisions, workarounds, subtle invariants or references.
- No commented-out code, change notes or redundant docblocks.

## Database

- Write table names explicitly in plural snake_case, e.g. `pgTable("sale_items", ...)`. Do not derive them with `pgTableCreator` or a pluralization library.
