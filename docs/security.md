# Security

MarketHub treats the browser as hostile and the network as untrusted. This document lists the controls and where they live.

## Authentication

- **Argon2id** password hashing with per-password salts (`argon2` defaults, `type: argon2id`).
- Passwords are never logged, returned, or stored in plaintext.
- Login failures return a generic message to avoid account enumeration; registration still needs to reveal duplicates.
- Access tokens are short-lived JWTs (default 15 minutes) delivered in the `mh_access` HttpOnly cookie.
- Refresh tokens are long-lived JWTs (default 7 days) in the `mh_refresh` HttpOnly cookie and are stored **hashed** in `Session`.
- Refresh **rotates** the session: the previous session is revoked and a new pair is issued.
- Logout revokes the current refresh session and clears all cookies.
- The one-time administrator bootstrap requires `ADMIN_BOOTSTRAP_SECRET` and refuses to run once any administrator exists.

## Cookies and CSRF

- `HttpOnly` on access and refresh cookies; `Secure` in production; `SameSite=Lax` by default.
- The CSRF token lives in the readable `mh_csrf` cookie and must match the `x-csrf-token` header on every state-changing request (double-submit pattern).
- Comparison uses a timing-safe equality check and rejects length mismatches.
- An `Origin` header, when present, must match the configured frontend origin.
- Bearer-token API clients are exempt because they do not rely on ambient cookies.
- Health, docs, safe methods and the secret-authenticated bootstrap route are exempt.

## Authorization

- Global guards run in order: throttling → JWT → roles → CSRF.
- `RolesGuard` enforces route roles; administrators are allowed through seller-only routes but not the reverse.
- **Ownership checks** are part of the queries, not just the UI: orders, payments, addresses, carts, reviews and seller resources are always filtered by the authenticated user or store.
- Sellers can only read and mutate their own products, orders and inventory.
- Suspended users and non-approved sellers are rejected at authentication/authorization time.
- Customer-only routes cannot be used by sellers or admins (except where the admin console intentionally aggregates read-only data).

## Rate limiting

`@nestjs/throttler` applies a global limit and tighter per-route limits on sensitive endpoints:

- authentication (register/login/refresh)
- checkout
- payment simulation
- review creation

Exceeding a limit returns `429`.

## Input validation

- Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform` rejects unknown fields and coerces only declared types.
- DTOs bound string lengths, enum values, quantities and money formats.
- Image URLs are validated as `http(s)` only, with credentials and dangerous schemes rejected.
- Slugs are normalised and length-limited.
- SQL is always parameterised through Prisma; raw SQL is limited to `SELECT ... FOR UPDATE` with interpolated IDs.

## Money and inventory integrity

- All money is `Decimal(12,2)`; no binary floating point is used in the domain.
- Checkout runs in a serializable transaction with ordered row locks and bounded retries.
- Stock cannot go negative: reservations check available stock under lock.
- Idempotency records make retried checkout/payment calls safe.
- Inventory movements and payment events are append-only audit trails.

## Transport and headers

- `helmet` sets security headers; CSP is intentionally disabled because the exported Next app inlines its own runtime into a single-origin deployment, and the frontend is static.
- `trust proxy` is enabled so secure-cookie and protocol decisions honour Render's proxy.
- CORS is restrictive and credentials are only allowed for the configured origin and local development origins.
- The production server refuses to start without an HTTPS `FRONTEND_ORIGIN`.

## Logging and secrets

- Access logs are structured JSON containing method, path, status, duration and timestamp only. Cookies, authorization headers and bodies are never logged.
- Startup errors print the message and stack, never environment values.
- Secrets are provided by the platform (Render generated values) or a local `.env` excluded by `.gitignore`. No secret is committed.
- `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) are kept distinct so runtime traffic uses the pooler while migrations use a direct connection.

## Known boundaries

- Payments are simulated. There is no payment-provider integration, webhook signature verification or PCI scope.
- Email verification and password-reset delivery are out of scope for the demo.
- The free hosting tier may spin down; the first request after idle is slower but still within transaction timeouts.
