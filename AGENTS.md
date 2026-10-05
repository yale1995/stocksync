# Agent Rules

## Architecture

Backend code in `apps/backend/src/` is organized as:

- `infra/`: technical details (compose, env, db, Drizzle `schemas/`, `migrations/`) and `errors.ts` (`AppError` subclasses and `formatZodIssues`).
- `http/middlewares/`: error handler, auth and role middlewares.
- `http/controllers/`: `<feature>.controller.ts` (Express router, Zod validation, HTTP status) and `<feature>.validation.ts` (Zod schemas).
- `modules/<feature>/`: `*.service.ts` (business rules, transactions), `*.repository.ts` (Drizzle queries, always filtered by `tenantId`) and `*.test.ts`.

## Code comments

- Avoid comments that restate what the code does; prefer clear names and small functions.
- Comment only the non-obvious *why*: decisions, workarounds, subtle invariants or references.
- No commented-out code, change notes or redundant docblocks.

## Database

- Write table names explicitly in plural snake_case, e.g. `pgTable("sale_items", ...)`. Do not derive them with `pgTableCreator` or a pluralization library.
- Use soft delete: a nullable `deleted_at` column instead of `DELETE`. Queries exclude rows where `deleted_at` is set, and unique constraints become partial indexes `WHERE deleted_at IS NULL`.
- Exception: `stock_movements` is an append-only ledger with no `updated_at` and no `deleted_at`. A movement is never edited or deleted; a wrong adjustment is corrected with an opposite adjustment.
- Date and time columns always use `timestamptz` (`timestamp({ withTimezone: true })`), never `timestamp` without time zone.
- Check business rules (duplicates, existence) with an explicit query before writing and throw the matching error, e.g. `ConflictError` or `NotFoundError`. Do not write first and translate Postgres error codes such as `23505`. Keep the constraints as the last line of defense: a concurrent race that slips past the check hits the constraint and becomes a 500. Where concurrency is a requirement (stock, idempotency), run the check under a lock (`SELECT ... FOR UPDATE`, or an advisory lock for rows that do not exist yet).
