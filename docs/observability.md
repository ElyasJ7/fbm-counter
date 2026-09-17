# Observability baseline

## Structured request logs

`RequestLoggingInterceptor` emits JSON lines:

`timestamp`, `level`, `msg`, `requestId`, `method`, `route`, `path`, `status`, `durationMs`, `userId`

Never logs passwords, cookies, Authorization headers, or tokens.
Response header: `x-request-id`.

## Health

- `GET /api/health` — liveness (+ DB check, public)
- `GET /api/health/ready` — DB + storage driver smoke (public, no secrets)
- `GET /api/health/metrics` — in-process counters (**ADMIN** only)

## Metrics contents

Request totals, 5xx count, average duration, per-route counts — suitable for uptime/error rate monitoring without a vendor lock-in.
