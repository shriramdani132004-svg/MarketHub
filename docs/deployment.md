# Deployment

MarketHub runs as **one Render Free web service** that executes migrations at boot, then serves both the REST API and the static Next.js export from the same HTTPS origin. PostgreSQL is hosted on **Neon Free**.

## Prerequisites

- A GitHub repository containing this project (the default branch is `main`).
- A Neon project with a database.
- A Render account and workspace.
- The Render CLI (v2.34+) for automated creation and checks:

  ```bash
  render --version
  render whoami
  ```

## 1. Prepare Neon

The API uses two connection strings:

| Variable       | Endpoint                | Consumer                     |
| -------------- | ----------------------- | ---------------------------- |
| `DATABASE_URL` | Neon **pooled** host    | API runtime (Prisma + `pg`)  |
| `DIRECT_URL`   | Neon **direct** host    | Prisma migrations at startup |

Create a project (or a dedicated branch) and copy both URLs. Keep `sslmode=require` in each URL.

Apply the schema and seed the category taxonomy once:

```bash
export DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
export DIRECT_URL="postgresql://.../neondb?sslmode=require"

pnpm install
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm prisma:seed
```

The seed only creates the category tree. It does **not** create products, orders, sellers or fake revenue.

## 2. Configure the service

The Blueprint is [`render.yaml`](../render.yaml). Validate it locally:

```bash
render blueprints validate render.yaml
```

Create the service from the Render Dashboard (**New → Blueprint**, select the repository) or with the CLI:

```bash
export DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
export DIRECT_URL="postgresql://.../neondb?sslmode=require"
export JWT_SECRET="$(openssl rand -hex 32)"
export JWT_REFRESH_SECRET="$(openssl rand -hex 32)"

render services create \
  --name markethub \
  --type web_service \
  --repo https://github.com/<owner>/MarketHub \
  --branch main \
  --runtime node \
  --plan free \
  --region oregon \
  --build-command "corepack enable && pnpm install --frozen-lockfile && pnpm build" \
  --start-command "node scripts/render-start.mjs" \
  --health-check-path /api/v1/health/ready \
  --env-var NODE_VERSION=22.20.0 \
  --env-var NODE_ENV=production \
  --env-var "DATABASE_URL=$DATABASE_URL" \
  --env-var "DIRECT_URL=$DIRECT_URL" \
  --env-var "JWT_SECRET=$JWT_SECRET" \
  --env-var "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" \
  --env-var COOKIE_SECURE=true \
  --env-var COOKIE_SAME_SITE=lax \
  --env-var RESERVATION_TTL_MINUTES=15 \
  --confirm
```

`FRONTEND_ORIGIN` is derived from `RENDER_EXTERNAL_URL` at startup; set it explicitly if you use a custom domain.

### Required production values

- `NODE_ENV=production`
- `COOKIE_SECURE=true` (the API also defaults to secure cookies in production)
- `JWT_SECRET` and `JWT_REFRESH_SECRET` — at least 32 random characters each and different from one another
- `DATABASE_URL` and `DIRECT_URL` as above

The server refuses to start if any required value is missing, if a secret is too short, or if `FRONTEND_ORIGIN` is not HTTPS.

## 3. Deploy

Render builds automatically on pushes to `main` (or trigger a deploy with `render deploys create <service-id>`).

Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build`

This runs Prisma generate, the Next static export, the Nest build, then copies the export into `apps/api/public`.

Start: `node scripts/render-start.mjs`

This validates the environment, runs `prisma migrate deploy` against `DIRECT_URL`, and starts the API on `$PORT` bound to `0.0.0.0`.

## 4. Bootstrap the first administrator (optional)

Set `ADMIN_BOOTSTRAP_SECRET` on the service, then:

```bash
ADMIN_BOOTSTRAP_SECRET=... pnpm admin:bootstrap \
  --url https://<service>.onrender.com \
  --email admin@example.com \
  --name "MarketHub Admin"
```

The password is read interactively. Once an administrator exists the endpoint returns `403`, so remove the secret afterwards.

## 5. Verify the live deployment

```bash
BASE=https://<service>.onrender.com

curl -fsS "$BASE/api/v1/health/live"
curl -fsS "$BASE/api/v1/health/ready"
curl -fsS "$BASE/api/v1/categories" | head -c 300
curl -fsS -o /dev/null -w '%{http_code}\n' "$BASE/"
curl -fsS -o /dev/null -w '%{http_code}\n' "$BASE/api/docs"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/v1/does-not-exist"   # expect 404 JSON
```

Then complete a real commerce flow with a throwaway customer:

1. `GET /api/v1/auth/csrf`, then register.
2. Re-read `mh_csrf` (authentication rotates it).
3. Add a published product to the cart.
4. Create an address.
5. `POST /api/v1/checkout`.
6. `POST /api/v1/payments/:id/simulate` with `{ "outcome": "SUCCESS" }`.
7. Read the order and confirm it is `PAID` and stock moved from reserved to sold.

All smoke-test orders are clearly demo data and use simulated payments.

## Operational notes

- **Free tier**: the service idles after inactivity; the first request may take several seconds. Transaction timeouts are widened for Neon cold starts.
- **Migrations**: run automatically before the server starts. A failed migration aborts the boot and the previous deploy stays live.
- **Secrets**: never commit `.env`, `.env.test`, Neon URLs or JWT secrets. The Blueprint marks database URLs as `sync: false`; token secrets use `generateValue`.
- **Logs**: `render logs -r <service-id> --tail` streams structured JSON access logs. Cookies and credentials are never logged.
- **Rollback**: redeploy a previous commit from the Dashboard, or revert the commit and push. Schema changes should be rolled back with a new forward migration rather than editing applied migrations.

## Troubleshooting

| Symptom                              | Likely cause / fix                                                    |
| ------------------------------------ | --------------------------------------------------------------------- |
| Boot exits with "Missing environment variables" | A required variable is unset on the service                |
| Boot exits with "FRONTEND_ORIGIN must be HTTPS" | Set an HTTPS origin or allow the `RENDER_EXTERNAL_URL` fallback |
| Health check fails                   | Database unreachable, or migrations failed — inspect deploy logs      |
| `500` on `/api/v1/...` right after idle | Neon cold start; retry. Check `/health/ready`                       |
| Cookies not persisted                | `COOKIE_SECURE` must match HTTPS; use the same origin for UI and API  |
| `403` on POSTs                       | Missing or stale `x-csrf-token`; re-fetch `GET /auth/csrf` after login |
| Migration permission error           | `DIRECT_URL` must be the non-pooled Neon endpoint                    |
