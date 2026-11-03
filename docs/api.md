# API reference

Base path: `/api/v1`. Interactive OpenAPI documentation is available at `/api/docs`.

## Authentication model

- Access and refresh tokens are delivered as **HttpOnly cookies** (`mh_access`, `mh_refresh`).
- A readable CSRF cookie (`mh_csrf`) is issued by `GET /auth/csrf`; state-changing requests must echo it in the `x-csrf-token` header (double-submit).
- Authenticating endpoints rotate the CSRF cookie, so clients must re-read it after login or registration.
- Bearer tokens are also accepted for API clients; those requests are exempt from CSRF.
- Roles: `CUSTOMER`, `SELLER`, `ADMIN`. Administrators may use seller endpoints.

### Typical browser flow

```http
GET  /api/v1/auth/csrf                 → 200, sets mh_csrf
POST /api/v1/auth/login                → 200, sets mh_access/mh_refresh, rotates mh_csrf
GET  /api/v1/auth/csrf                 → re-read the rotated token
POST /api/v1/cart/items                → x-csrf-token required
```

## Endpoints

### Authentication and account

| Method | Path                        | Access    | Notes                                   |
| ------ | --------------------------- | --------- | --------------------------------------- |
| GET    | `/auth/csrf`                | public    | Issue a double-submit token             |
| POST   | `/auth/register`            | public    | Customer registration                   |
| POST   | `/auth/seller/apply`        | public    | Seller application (store becomes PENDING) |
| POST   | `/auth/login`               | public    | Cookie login                            |
| POST   | `/auth/logout`              | any       | Revoke session and clear cookies        |
| POST   | `/auth/refresh`             | cookie    | Rotate the refresh session              |
| GET    | `/auth/me`                  | any       | Current user                            |
| POST   | `/auth/admin/bootstrap`     | secret    | One-time admin creation                 |
| GET    | `/users/me`                 | any       | Profile                                 |
| PATCH  | `/users/me`                 | any       | Update profile                          |
| GET    | `/addresses`                | any       | List addresses                          |
| POST   | `/addresses`                | any       | Create address                          |
| PATCH  | `/addresses/:id`            | owner     | Update address                          |
| PATCH  | `/addresses/:id/default`    | owner     | Set default address                     |
| DELETE | `/addresses/:id`            | owner     | Delete address                          |
| GET    | `/notifications`            | any       | List notifications                      |
| PATCH  | `/notifications/:id/read`   | owner     | Mark one read                           |
| PATCH  | `/notifications/read-all`   | any       | Mark all read                           |

### Catalogue and stores

| Method | Path                    | Access | Notes                                   |
| ------ | ----------------------- | ------ | --------------------------------------- |
| GET    | `/categories`           | public | Category tree                           |
| GET    | `/categories/:slug`     | public | Category with products                  |
| GET    | `/sellers`              | public | Approved stores                         |
| GET    | `/sellers/:slug`        | public | Store profile                           |
| GET    | `/products`             | public | Search, filter, sort, paginate          |
| GET    | `/products/:id`         | public | Product detail                          |
| GET    | `/products/:id/reviews` | public | Reviews                                 |
| POST   | `/products/:id/reviews` | customer | Create/update own review              |

### Cart and checkout

| Method | Path                | Access   | Notes                                 |
| ------ | ------------------- | -------- | ------------------------------------- |
| GET    | `/cart`             | customer | Active cart                           |
| POST   | `/cart/items`       | customer | Add item                              |
| PATCH  | `/cart/items/:id`   | customer | Change quantity                       |
| DELETE | `/cart/items/:id`   | customer | Remove item                           |
| DELETE | `/cart`             | customer | Clear cart                            |
| POST   | `/checkout`         | customer | Serializable checkout; `Idempotency-Key` |
| GET    | `/checkout/:id`     | customer | Checkout summary                      |

`POST /checkout` returns a summary with `orderId`, `paymentId`, `sellerOrderCount` and money totals as two-decimal strings.

### Payments

| Method | Path                     | Access   | Notes                          |
| ------ | ------------------------ | -------- | ------------------------------ |
| GET    | `/payments/:id`          | owner    | Payment detail                 |
| GET    | `/payments/:id/events`   | owner    | Immutable event history        |
| POST   | `/payments/:id/simulate` | owner    | `{ "outcome": "SUCCESS" \| "FAILURE" }` |

Simulation is idempotent when an `Idempotency-Key` header (or body `idempotencyKey`) is supplied.

### Orders

| Method | Path               | Access   | Notes                       |
| ------ | ------------------ | -------- | --------------------------- |
| GET    | `/orders/me`       | customer | Order history               |
| GET    | `/orders/:id`      | owner    | Order detail and timeline   |
| POST   | `/orders/:id/cancel` | owner  | Cancel while cancellable    |

### Seller

| Method | Path                          | Access         | Notes                        |
| ------ | ----------------------------- | -------------- | ---------------------------- |
| GET    | `/seller/profile`             | seller         | Own store                    |
| PATCH  | `/seller/profile`             | seller         | Update store                 |
| GET    | `/seller/products`            | seller         | Own catalogue                |
| POST   | `/seller/products`            | approved seller| Create product               |
| GET    | `/seller/products/:id`        | seller         | Product detail               |
| PATCH  | `/seller/products/:id`        | seller         | Update product               |
| DELETE | `/seller/products/:id`        | seller         | Archive product              |
| PATCH  | `/seller/products/:id/inventory` | seller      | Adjust stock, write ledger   |
| GET    | `/seller/orders`              | seller         | Own fulfilment groups        |
| GET    | `/seller/orders/:id`          | seller         | Group detail                 |
| PATCH  | `/seller/orders/:id/status`   | seller         | Forward-only status change   |

### Administration

| Method | Path                              | Access | Notes                    |
| ------ | --------------------------------- | ------ | ------------------------ |
| GET    | `/admin/dashboard`                | admin  | Live platform totals     |
| GET    | `/admin/sellers`                  | admin  | Seller directory         |
| PATCH  | `/admin/sellers/:id/approve`      | admin  | Approve                  |
| PATCH  | `/admin/sellers/:id/reject`       | admin  | Reject with reason       |
| PATCH  | `/admin/sellers/:id/suspend`      | admin  | Suspend                  |
| PATCH  | `/admin/sellers/:id/reactivate`   | admin  | Reactivate               |
| GET    | `/admin/orders`                   | admin  | All orders with filters  |
| GET    | `/admin/orders/:id`               | admin  | Order detail             |
| POST   | `/admin/orders/:id/cancel`        | admin  | Cancel and release stock |
| GET    | `/admin/products`                 | admin  | Moderation queue         |
| PATCH  | `/admin/products/:id/status`      | admin  | Change product status    |
| GET    | `/admin/payments`                 | admin  | Simulated payments       |
| GET    | `/admin/inventory`                | admin  | Stock overview           |
| GET    | `/admin/users`                    | admin  | User directory           |
| PATCH  | `/admin/users/:id/status`         | admin  | Suspend/reactivate user  |
| GET    | `/admin/categories`               | admin  | List categories          |
| POST   | `/admin/categories`               | admin  | Create category          |
| PATCH  | `/admin/categories/:id`           | admin  | Update category          |
| DELETE | `/admin/categories/:id`           | admin  | Delete unused category   |

### Analytics

| Method | Path                | Access          | Notes                         |
| ------ | ------------------- | --------------- | ----------------------------- |
| GET    | `/analytics/customer` | customer      | Own order/spend summary       |
| GET    | `/analytics/seller`   | seller        | Store sales, stock, orders    |
| GET    | `/analytics/admin`    | admin         | Platform KPIs                 |
| GET    | `/analytics/products` | seller/admin  | Top products (`?days=`)       |
| GET    | `/analytics/sales`    | seller/admin  | Sales series (`?days=`)       |

### Health

| Method | Path           | Access | Notes                    |
| ------ | -------------- | ------ | ------------------------ |
| GET    | `/health/live` | public | Process liveness         |
| GET    | `/health/ready`| public | Database readiness ping  |

## Errors

Errors use a consistent JSON envelope:

```json
{
  "statusCode": 409,
  "message": "Not enough stock available for this item",
  "error": "Conflict",
  "path": "/api/v1/checkout",
  "timestamp": "2026-01-01T10:00:00.000Z"
}
```

Validation errors return `400` with field-level messages. Rate-limited requests return `429`.
