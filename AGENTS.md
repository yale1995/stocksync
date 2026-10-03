# Agent Rules

## Architecture

Backend code in `apps/backend/src/` is organized as:

- `infra/`: technical details only (compose, env, db, Drizzle `schemas/`, `migrations/`).
- `http/`: shared HTTP pieces (errors, error handler, auth and role middlewares).
- `modules/<feature>/`: `*.routes.ts` (Zod validation, HTTP status), `*.service.ts` (business rules, transactions), `*.repository.ts` (Drizzle queries, always filtered by `tenantId`), `*.validation.ts` (Zod schemas) and `*.test.ts`.

## Code comments

- Avoid comments that restate what the code does; prefer clear names and small functions.
- Comment only the non-obvious *why*: decisions, workarounds, subtle invariants or references.
- No commented-out code, change notes or redundant docblocks.

## Database

- Write table names explicitly in plural snake_case, e.g. `pgTable("sale_items", ...)`. Do not derive them with `pgTableCreator` or a pluralization library.
- Use soft delete: a nullable `deleted_at` column instead of `DELETE`. Queries exclude rows where `deleted_at` is set, and unique constraints become partial indexes `WHERE deleted_at IS NULL`.
- Date and time columns always use `timestamptz` (`timestamp({ withTimezone: true })`), never `timestamp` without time zone.
