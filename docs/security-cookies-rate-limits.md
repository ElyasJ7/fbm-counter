# Auth cookies, CSRF, and rate limiting

## Cookies

- `httpOnly: true`
- `SameSite`: `COOKIE_SAME_SITE` (`lax` default, `strict` allowed)
- `Secure`: `COOKIE_SECURE` or auto-true when `NODE_ENV=production`

### CSRF assumptions

With `SameSite=lax` or `strict`, cross-site browser POSTs do not include cookies in typical CSRF scenarios.

**`COOKIE_SAME_SITE=none` is rejected at startup** until explicit CSRF tokens (double-submit or synchronizer) are implemented.

## Rate limiting

Global default: **300 req / 60s** (raised from 120 to avoid frustrating normal workflows).

Route-specific (override):

| Route | Limit / 60s |
|-------|-------------|
| `POST /auth/login` | 10 |
| `POST /auth/refresh|logout` | 30 |
| `GET /search` | 60 |
| `GET /dashboard` | 30 |
| `GET /reports` | 30 |
| `GET /reports/export` | 10 |
| `GET /invoices/:id/pdf` | 20 |
| Document upload | 20 |

Tune via Nest `@Throttle` and `ThrottlerModule`. Ensure `TRUST_PROXY=true` behind reverse proxies so client IP is correct.
