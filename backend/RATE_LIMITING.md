# Rate Limiting Configuration

## Overview

The backend implements **granular rate limiting by endpoint type** to balance security, UX, and resource management:

| Endpoint Type | Max Requests | Window | Purpose |
|---|---|---|---|
| **Auth** (login/register) | 5 | 15 min | Brute force protection |
| **Read** (GET dashboards, projects) | 100 | 15 min | Flexible for frequent queries |
| **Analysis** (AI/Gemini requests) | 10 | 1 hour | Prevent resource exhaustion |
| **Upload** | 20 | 1 hour | Manage bandwidth/storage |
| **Admin** | 20 | 10 min | Protect sensitive operations |
| **Global** (fallback) | 100 | 15 min | Default for unspecified routes |

## Environment Variables

### Auth Rate Limit
- `RATE_LIMIT_AUTH_WINDOW_MS` — Window in milliseconds (default: 900000 = 15 min)
- `RATE_LIMIT_AUTH_MAX` — Max attempts per window (default: 5)

**Applies to:**
- `POST /api/auth/login`
- `POST /api/auth/register`

### Read Rate Limit
- `RATE_LIMIT_READ_WINDOW_MS` — Window (default: 900000 = 15 min)
- `RATE_LIMIT_READ_MAX` — Max requests per window (default: 100)

**Applies to:**
- `GET /api/dashboards`
- `GET /api/projects`
- `GET /api/jobs`

### Analysis Rate Limit
- `RATE_LIMIT_ANALYSIS_WINDOW_MS` — Window (default: 3600000 = 1 hour)
- `RATE_LIMIT_ANALYSIS_MAX` — Max analysis jobs per window (default: 10)

**Applies to:**
- `POST /api/projects/:id/analyze` — AI analysis requests (expensive, resource-intensive)

### Upload Rate Limit
- `RATE_LIMIT_UPLOAD_WINDOW_MS` — Window (default: 3600000 = 1 hour)
- `RATE_LIMIT_UPLOAD_MAX` — Max uploads per window (default: 20)

**Applies to:**
- `POST /api/upload/:projectId` — File uploads (bandwidth/storage intensive)

### Admin Rate Limit
- `RATE_LIMIT_ADMIN_WINDOW_MS` — Window (default: 600000 = 10 min)
- `RATE_LIMIT_ADMIN_MAX` — Max requests per window (default: 20)

**Applies to:**
- `GET /api/admin/audit` — Sensitive admin operations

### Global Rate Limit
- `RATE_LIMIT_WINDOW_MS` — Window (default: 900000 = 15 min)
- `RATE_LIMIT_MAX_REQUESTS` — Max requests per window (default: 100)

**Applies to:** All `/api/*` routes not covered by specific limiters

## How It Works

1. **Request arrives** at `/api/*`
2. **Global limiter** checks if client is within global quota
3. **Specific limiter** (if route matches) overrides with stricter/looser limit
4. **On limit exceeded:** Returns HTTP 429 with `RateLimit-*` headers and error message

## Response Headers

All rate limiters return standard HTTP headers:
- `RateLimit-Limit` — Max requests in window
- `RateLimit-Remaining` — Remaining requests
- `RateLimit-Reset` — Unix timestamp when limit resets

**Example:**
```
RateLimit-Limit: 5
RateLimit-Remaining: 2
RateLimit-Reset: 1620000000
```

## Development Mode

Rate limiting is **disabled in development** (`NODE_ENV=development`). All limits are bypassed to avoid friction during testing.

To test rate limiting in dev, set `NODE_ENV=production` or remove the `skip` condition in `rateLimiters.ts`.

## Production Recommendations

1. **Monitor 429 responses** — Track rate limit hits; spike = possible attack
2. **Adjust windows based on usage patterns** — Longer windows = fewer denied requests
3. **Consider per-user limits** — Current limits are per IP (respect `X-Forwarded-For` behind proxies)
4. **Add alerting** — Alert ops if auth fails exceed threshold (brute force attack indicator)
5. **Use proxy/WAF** — CloudFlare, AWS WAF, etc. for additional DDoS + rate limit layers

## Examples

### Hitting the Auth Rate Limit
```bash
# User tries to login 6 times in 15 min
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"wrong"}'
done

# Response (6th request):
# HTTP 429 Too Many Requests
# {
#   "error": "Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.",
#   "retryAfter": 900
# }
```

### Custom Rate Limit for New Endpoint

To add rate limiting to a new endpoint:

```typescript
// 1. Create a limiter in middleware/rateLimiters.ts (if needed)
export const customLimiter = rateLimit({
  windowMs: 300000, // 5 min
  max: 3
});

// 2. Import and apply to route
import { customLimiter } from '../middleware/rateLimiters';

router.post('/custom-action', customLimiter, handler);
```

## Debugging

Check current metrics + request tracking:
```bash
curl http://localhost:5000/api/observability/metrics
```

Each request includes a `X-Request-Id` header for tracing through logs.
