# Logging Design

**Spec**: `.specs/features/logging/spec.md`
**Status**: Approved

## Architecture

```
request ─► httpLogger (pino-http, first middleware) ─► cors ─► … ─► errorHandler
              │  genReqId: valid X-Request-Id or randomUUID, echoed as header
              │  req.log = child({ req: { id, method, url } })
              └─ on finish/close: one access line, level by status,
                 customProps adds tenantId/userId/role from req.auth

worker tick ─► claim ─► batchId = randomUUID(), log = logger.child({ tenantId, batchId })
              └─ AdsClient.sendUpdates(tenantId, items, batchId) ─► X-Request-Id ─► ads-mock pino-http
```

## Components

- `apps/backend/src/infra/logger.ts`: `loggerOptions` (redact list) and the root `logger` (`LOG_LEVEL`, `pino-pretty` only in development).
- `apps/backend/src/http/middlewares/http-logger.ts`: `createHttpLogger(logger)`, `genReqId`, `accessLogLevel`. Reduced `req`/`res` serializers; auth fields through `customProps`, which pino-http 11 evaluates again when the response finishes (`onResFinished`), so `req.auth` set by `requireAuth` is visible.
- `errorHandler`: the non-`AppError` branch sets `res.err = err`; pino-http logs the access line through its error path with `err` (stack) at `error`. No second line.
- `apps/backend/src/infra/test/memory-logger.ts`: a pino logger with the production options writing to an in-memory stream, for assertions.
- `sync.worker.ts`: `logger?: Logger`, default silent. `tick()` wraps the transaction, logs `tick failed` with the current (base or batch) logger and rethrows; `run()` swallows.
- `apps/ads-mock/src/logger.ts`: the mock's options, `genReqId` copy and `createHttpLogger`; `createApp` takes `logger` (silent by default).

## Decisions

Development output (follow-up, 2026-10-06): `infra/pretty.ts` (and `apps/ads-mock/src/pretty.ts`) holds `formatMessage` and the pino-pretty options, and loads pino-pretty with a dynamic import only in development. It runs as a stream on the main thread because a transport's worker thread cannot receive the `messageFormat` function. pino-http runs with `wrapSerializers: false` so `serializeError` receives the real `Error` and keeps only `type`, `message` and `stack`.

The request id stays in `req.id` (pino-http's default `req` binding), so every line written through `req.log` and the access line carry it as `req.id`.
