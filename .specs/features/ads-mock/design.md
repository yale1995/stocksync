# Ads Mock Design

**Spec**: `.specs/features/ads-mock/spec.md`

A standalone workspace app. It shares nothing with the backend, so it does not reuse `AppError` or the backend middlewares; it mirrors only the tooling (Express 5, Zod, Vitest + supertest, the `env.ts` style). Introduces AD-019 (mock contract).

## Components

| File | Responsibility |
| ---- | -------------- |
| `apps/ads-mock/package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` | Workspace app with `dev`, `build`, `start`, `test`, `typecheck` |
| `src/env.ts` | Zod env schema with defaults; exits on invalid env |
| `src/app.ts` | `createApp(options)`: API key → (on `POST /updates`) rate limit → body validation → failure injection → apply. In-memory `Map` keyed by `tenantId` + `sku` |
| `src/rate-limiter.ts` | Sliding 1 s window over the injected `now`; returns `{ allowed: true }` or `{ allowed: false, retryAfterSeconds }` |
| `src/server.ts` | Reads env, listens on `PORT` |
| `src/app.test.ts` | Every mock test from the prompt plus the failure modes |

## Order of checks on `POST /updates`

401 (key) → 429 (rate limit, counted only when accepted) → 400 (body) → failure injection (`random() < failureRate`, then `random()` in thirds: 500 / hold `timeoutDelayMs` then 500 / apply then 500) → apply → 200.
