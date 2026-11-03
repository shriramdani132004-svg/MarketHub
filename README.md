# MarketHub

A production-quality multi-vendor e-commerce platform: a Next.js storefront, seller workspace and administration console served by a single NestJS API, backed by PostgreSQL through Prisma.

MarketHub demonstrates a complete commerce lifecycle — customer registration, seller onboarding and approval, catalogue management, cart, multi-vendor checkout with per-seller order splitting, transactional stock reservation, simulated payments, fulfilment, refunds and analytics — with security and consistency controls that are exercised by automated tests.

**Live demo:** <https://markethub-535y.onrender.com> — deployed on Render's free tier, so the first request after idle may take a few seconds. Payments are simulated.

> **Payments are simulated.** No card data is collected and no real money is charged. All revenue figures are labelled as simulated demo data.

## Highlights

- **Multi-vendor checkout** — one cart splits into per-seller orders with independent shipping, fulfilment and status.
- **Correct money handling** — `Decimal(12,2)` everywhere; no floating-point arithmetic on prices or totals.
- **Transactional inventory** — `stockOnHand` / `reservedStock` with deterministic row locking, serializable retries, reservation expiry and an append-only inventory ledger.
- **Idempotent mutations** — checkout and payment simulation honour an `Idempotency-Key` so retries never duplicate orders or double-charge demo payments.
- **Order state machines** — enforced transitions for order and seller-order statuses; invalid jumps are rejected.
- **Security by default** — Argon2id password hashing, HttpOnly access/refresh cookies, rotating refresh sessions, double-submit CSRF, rate limiting, ownership checks, role guards and one-time admin bootstrap.
- **Three real experiences** — a responsive marketplace, a distinct seller dashboard and a distinct administration console. No dead buttons and no fabricated metrics: dashboards read live data.

## Tech stack

| Layer     | Choice                                                              |
| --------- | ------------------------------------------------------------------- |
| Frontend  | Next.js 15 (App Router, static export), React 19, Tailwind CSS      |
| API       | NestJS 11, class-validator, Swagger/OpenAPI                          |
| Database  | PostgreSQL 18 (Neon), Prisma ORM 7 with `@prisma/adapter-pg`         |
| Auth      | Argon2id, JWT access/refresh in HttpOnly cookies, rotating sessions  |
| Tooling   | pnpm workspaces, TypeScript 5.9, ESLint 9, Jest 29, GitHub Actions   |
| Hosting   | Render Free web service (single service: API + static frontend)      |

## Repository layout

```
markethub/
├── apps/
│   ├── api/                 NestJS API, Prisma client output, tests
│   │   ├── src/             modules: auth, users, sellers, products, carts,
│   │   │                    checkout, payments, orders, seller-orders,
│   │   │                    inventory, analytics, admin, health
│   │   └── test/            unit, integration and HTTP end-to-end suites
│   └── web/                 Next.js static-export storefront and dashboards
│       ├── app/(store)/     public marketplace routes
│       ├── app/seller/      seller workspace
│       ├── app/admin/       administration console
│       ├── components/      shared UI, store, seller and admin components
│       └── lib/             API client, auth/cart contexts, formatting
├── prisma/                  schema, migrations and seed data
├── scripts/                 build, migration, startup and bootstrap helpers
├── docs/                    architecture, API, deployment and testing guides
├── .github/workflows/       CI pipeline
├── render.yaml              Render Blueprint
└── package.json             root scripts
```

## Quick start

Prerequisites: **Node.js 22+**, **pnpm 10.34.9** (via `corepack enable`), and a PostgreSQL 14+ database.

```bash
# 1. Install dependencies
pnpm install

# 2. Configure the environment
cp .env.example .env        # fill in DATABASE_URL, DIRECT_URL and secrets

# 3. Generate the Prisma client, apply migrations and seed categories
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm prisma:seed

# 4. Start the API and the web app in separate terminals
pnpm dev:api                # http://localhost:4100 (or PORT from .env)
pnpm dev:web                # http://localhost:3000
```

The web app calls the API at `/api/v1` (same origin). In development it falls back to `http://localhost:4100/api/v1` when running on the Next dev server.

### Create the first administrator

Set `ADMIN_BOOTSTRAP_SECRET` in the environment, then run:

```bash
ADMIN_BOOTSTRAP_SECRET=... pnpm admin:bootstrap --email admin@example.com --name "MarketHub Admin"
```

The bootstrap endpoint disables itself once an administrator exists. Remove the secret afterwards.

## Environment variables

| Variable                   | Required | Purpose                                                        |
| -------------------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`             | yes      | Pooled PostgreSQL URL used by the API at runtime               |
| `DIRECT_URL`               | yes      | Direct PostgreSQL URL used by Prisma migrations                |
| `JWT_SECRET`               | yes      | Access-token signing secret, at least 32 characters            |
| `JWT_REFRESH_SECRET`       | yes      | Refresh-token signing secret, at least 32 characters, distinct |
| `FRONTEND_ORIGIN`          | yes      | Public origin used for CORS and CSRF origin checks             |
| `COOKIE_SECURE`            | prod     | Must be `true` in production                                   |
| `COOKIE_SAME_SITE`         | no       | `lax` (default), `strict` or `none`                            |
| `JWT_ACCESS_TTL`           | no       | Access-token lifetime in seconds (default `900`)               |
| `JWT_REFRESH_TTL`          | no       | Refresh-token lifetime in seconds (default `604800`)           |
| `RESERVATION_TTL_MINUTES`  | no       | Stock reservation window before automatic release (default 15) |
| `ADMIN_BOOTSTRAP_SECRET`   | no       | Enables the one-time administrator bootstrap endpoint          |
| `PORT`                     | no       | API port (default `4000`; Render injects this)                 |
| `WEB_DIST_DIR`             | no       | Override the static frontend directory                         |

On Render, `FRONTEND_ORIGIN` is derived from `RENDER_EXTERNAL_URL` when not set explicitly.

## Scripts

| Command                     | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `pnpm dev:api` / `dev:web`  | Development servers                                      |
| `pnpm build`                | Prisma generate → Next static export → Nest build → copy |
| `pnpm start`                | Production start (migrations, then API + static frontend)|
| `pnpm lint`                 | ESLint across workspaces                                 |
| `pnpm typecheck`            | TypeScript project checks                                |
| `pnpm test`                 | Unit tests (no database required)                        |
| `pnpm test:e2e`             | Integration + HTTP end-to-end suites (test database)     |
| `pnpm prisma:migrate:deploy`| Apply committed migrations                               |
| `pnpm prisma:seed`          | Seed the category taxonomy                               |
| `pnpm admin:bootstrap`      | Create the first administrator                           |

## Testing

```bash
pnpm lint
pnpm typecheck
pnpm test          # 66 unit tests
pnpm test:e2e      # integration + end-to-end, requires a test database
```

Database-backed suites expect `TEST_DATABASE_URL` / `TEST_DIRECT_URL` (for example in a gitignored `.env.test`). The test bootstrap refuses to fall back to the production `DATABASE_URL`, so a missing test database skips those suites rather than touching production.

See [`docs/testing.md`](docs/testing.md) for the full test matrix.

## Deployment

The service is defined by [`render.yaml`](render.yaml): one Render Free Node web service that runs migrations at startup, serves the API under `/api/v1` and the static Next.js export from the same origin.

```bash
# 1. Point DATABASE_URL / DIRECT_URL at your Neon project
# 2. Create the Blueprint (or use the Render Dashboard)
render blueprints create --file render.yaml
# 3. Apply the one-off category seed
DATABASE_URL=... DIRECT_URL=... pnpm prisma:seed
```

Full instructions, including Neon setup, secrets and smoke-test commands, are in [`docs/deployment.md`](docs/deployment.md).

## Architecture and API

- [`docs/architecture.md`](docs/architecture.md) — system overview, checkout sequence, inventory reservation, order state machines and data model.
- [`docs/api.md`](docs/api.md) — endpoint reference, authentication and CSRF usage.
- [`docs/security.md`](docs/security.md) — threat model and controls.
- Interactive OpenAPI documentation is served at `/api/docs` when the API is running.

## Design

The interface uses a deep ink/plum foundation with a warm amber accent:

| Token       | Value     | Use                                   |
| ----------- | --------- | ------------------------------------- |
| Ink         | `#17131F` | Primary background and text           |
| Plum        | `#38244B` | Surfaces, seller workspace            |
| Amber       | `#F4A63A` | Primary action and emphasis           |
| Sage        | `#7FB09A` | Success and positive status           |
| Porcelain   | `#FBF8F3` | Storefront canvas                     |
| Rose        | `#E86A7A` | Destructive and error                 |

Typography is Plus Jakarta Sans, bundled locally. Layouts are responsive down to small mobile widths, and the seller and admin workspaces use their own navigation and visual treatment rather than reusing the storefront shell.

## License

Released for demonstration and portfolio purposes. See the repository owner for reuse.
