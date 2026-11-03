# Testing

MarketHub has three automated layers plus static checks. The database-backed suites run against an isolated PostgreSQL branch and never touch production.

## Commands

```bash
pnpm lint        # ESLint, all workspaces
pnpm typecheck   # tsc --noEmit, API and web
pnpm test        # Jest unit suite, no database required
pnpm test:e2e    # integration + HTTP end-to-end, requires a test database
pnpm build       # Prisma generate, Next export, Nest build, static copy
```

## Test database

DB-backed suites load `TEST_DATABASE_URL` and `TEST_DIRECT_URL` from a gitignored `.env.test`, or from the process environment (CI). The bootstrap in `apps/api/test/setup-env.ts` explicitly removes `DATABASE_URL` when no test database is available, so a missing secret **skips** the suites instead of hitting the configured production database.

```dotenv
# .env.test (never committed)
TEST_DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
TEST_DIRECT_URL="postgresql://.../neondb?sslmode=require"
```

Apply migrations to the test branch before the first run:

```bash
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DIRECT_URL" pnpm prisma:migrate:deploy
```

## Unit suite (`pnpm test`)

Runs in `apps/api/test/unit`, mocks infrastructure, and completes in seconds.

| File                        | Coverage                                                                 |
| --------------------------- | ------------------------------------------------------------------------ |
| `money.util.spec.ts`        | Decimal arithmetic, shipping rules, order aggregation, timeline building |
| `crypto.util.spec.ts`       | token hashing, slug normalisation, URL safety                            |
| `transaction.util.spec.ts`  | serializable retry (P2034 and raw 40001/40P01), exhaustion, non-retry    |
| `pagination.spec.ts`        | page metadata and edge cases                                             |
| `csrf.guard.spec.ts`        | safe methods, double-submit matching, origin checks, exemptions          |
| `roles.guard.spec.ts`       | anonymous access, role matching, admin bypass                            |

## Integration suite (`pnpm test:e2e`, `test/integration`)

Runs real transactions against PostgreSQL through the same services the API uses.

- **Last-unit concurrency** — two customers check out the same final unit; exactly one succeeds, one receives a conflict, `reservedStock` is `1`, and exactly one reservation movement exists.
- **Checkout idempotency** — repeating the same idempotency key returns the original order and payment without double-reserving stock.
- **Reservation expiry** — an overdue reservation is released exactly once; a second sweep is a no-op. The order, seller groups and payment move to `CANCELLED`, and one `STOCK_RELEASED` movement is recorded.

Fixtures create isolated sellers, categories, products, customers, addresses and carts, and are deleted afterwards in dependency order.

## End-to-end suite (`pnpm test:e2e`, `test/e2e`)

Boots the real Nest application over HTTP with `supertest` and exercises the full commerce journey:

1. Health liveness and readiness.
2. Customer registration and duplicate-email rejection.
3. Seller application.
4. Administrator approval of the store.
5. Category and product creation by seller.
6. Address creation and cart add.
7. Checkout with per-seller splitting and stock reservation.
8. Successful simulated payment, stock commitment and order `PAID`.
9. Seller fulfilment `PROCESSING → SHIPPED → DELIVERED` with tracking.
10. Customer order shows `DELIVERED`.
11. Security assertions: missing CSRF → `403`, customer on admin route → `403`, seller on customer cart → `403`.
12. Seller analytics reflect the real simulated order.

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`:

- **verify** — install, Prisma generate, lint, typecheck, unit tests, production build.
- **integration** — runs only when `TEST_DATABASE_URL` is configured as a repository secret. It applies migrations to that database and runs `pnpm test:e2e`.

To enable the database job, add repository secrets `TEST_DATABASE_URL` and `TEST_DIRECT_URL` pointing at a disposable Neon branch.
