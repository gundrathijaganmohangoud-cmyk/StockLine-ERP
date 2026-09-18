# StockFlow ERP

Full-stack ERP workspace: **PostgreSQL + Express 5 + Prisma 6 + Node 22 (backend)** and **Vite + React 19 + react-router 7 (frontend)**.

Flow: Enquiry -> Quotation (server-authoritative pricing) -> Sales Order (ACCEPTED quotations only) -> Confirm (inventory reservation) -> Dispatch.

## Tech Stack
- Backend: Node 22, Express 5, Prisma 6, PostgreSQL, bcrypt, jsonwebtoken (8h tokens), Jest + Supertest
- Frontend: React 19, react-router-dom 7, axios, Vite 7

## Prerequisites
- Node.js 18+ (tested on 22)
- PostgreSQL 14+ running locally (no Docker needed for a plain install)
- Two databases: `pern_erp` (dev) and `pern_erp_test` (tests)

```sql
CREATE DATABASE pern_erp;
CREATE DATABASE pern_erp_test;
```

## Environment Variables
`backend/.env` (copy from `backend/.env.example`):

```
DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/pern_erp
TEST_DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/pern_erp_test
JWT_SECRET=change-me-to-a-long-random-secret
PORT=5000
```

`frontend/.env`:

```
VITE_API_URL=http://localhost:5000/api
```

## Setup (Migration/Seed)

```bash
cd backend
npm install

# 1. Create the schema + client (generates prisma/migrations/<ts>_init)
npx prisma migrate dev --name init

# 2. Add the inventory CHECK constraints (Prisma cannot express them):
#    - Open prisma/migrations/<timestamp>_init/migration.sql and paste the
#      contents of prisma/check-constraints.sql at the bottom, then run:
npx prisma migrate dev
#    (Alternative: psql "$DATABASE_URL" -f prisma/check-constraints.sql)

# 3. Seed users, products, inventory, customers:
npx prisma db seed
```

## Running Frontend/Backend

```bash
# Terminal 1 - API on http://localhost:5000
cd backend && npm run dev

# Terminal 2 - UI on http://localhost:5173
cd frontend && npm install && npm run dev
```

## Deploying with Render and Neon

The repository includes `render.yaml` for deploying the API and Vite frontend.
Create a Render Blueprint from the repository, then configure these values:

- `DATABASE_URL`: the pooled Neon PostgreSQL connection string
- `CORS_ORIGIN`: the deployed frontend URL
- `VITE_API_URL`: the deployed API URL followed by `/api`

The API runs `npx prisma migrate deploy` before starting. Do not use
`prisma migrate dev` against the production Neon database.

Health check (public): `GET http://localhost:5000/api/health`

The complete route-by-route responsibility guide is in `docs/API_ROUTE_GUIDE.md`.

## Running Tests

```bash
cd backend
npm test
```

- Tests run against `TEST_DATABASE_URL` (never your dev data). If it is not
  set, they fall back to `DATABASE_URL` with a loud warning.
- `global-setup.js` applies the schema to the test DB automatically
  (`prisma migrate deploy`, falling back to `prisma db push` when no migration
  exists yet).
- `helpers.js` truncates and re-baselines the test DB per suite, so suites are
  independent and repeatable.

Covered scenarios:
1. Quotation grand_total is computed server-side; spoofed totals in the body are ignored
2. DRAFT and REJECTED quotations cannot convert to sales orders (400)
3. Converting the same ACCEPTED quotation twice creates ONE order (2nd attempt 409)
4. Confirming an order larger than available stock is rejected and inventory is unchanged
5. SALES role gets 403 on confirm/dispatch; 401 handling (missing/malformed/expired tokens)
6. Bonus: two concurrent confirms on limited stock - reserved never exceeds physical

## API Overview (all JSON; errors are `{ "error": "message" }`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | /api/health | public | health check |
| POST | /api/auth/login | public | returns JWT (userId, role, 8h) |
| GET | /api/products | any | catalog + availability (dropdowns) |
| POST | /api/enquiries | SALES/ADMIN | create enquiry + items (tx), ENQ-0001... |
| GET | /api/enquiries | any | list (?status=) |
| GET | /api/enquiries/:id | any | detail with product names |
| POST | /api/quotations | SALES/ADMIN | server recalculates pricing, QTN-0001... |
| GET | /api/quotations | any | list (?status=) |
| GET | /api/quotations/:id | any | detail incl. recalculatedGrandTotal |
| PATCH | /api/quotations/:id/status | SALES/ADMIN | DRAFT->SENT->ACCEPTED/REJECTED only |
| POST | /api/quotations/:id/convert | SALES/ADMIN | -> PENDING sales order (unique quotation_id) |
| GET | /api/sales-orders | any | list |
| GET | /api/sales-orders/:id | any | detail + availableQty per line |
| POST | /api/sales-orders/:id/confirm | ADMIN | reserves stock atomically |
| POST | /api/sales-orders/:id/dispatch | ADMIN | dispatch record + stock deduction |
| GET | /api/dispatches | any | list |
| GET | /api/dispatches/:id | any | detail |

## Design Decisions Worth Knowing

- **Server-authoritative pricing**: line_amount and grand_total are always
  recomputed by `src/utils/calculations.js` (integer-cents math). Client totals
  are never read. `GET /api/quotations/:id` returns `recalculatedGrandTotal`
  for verification.
- **One order per quotation** is enforced by the DB (`sales_orders.quotation_id`
  UNIQUE). The service pre-checks and catches Prisma P2002 -> 409, so racing
  convert requests fail cleanly instead of crashing.
- **Concurrency-safe reservation**: confirming an order runs each line through
  one atomic conditional UPDATE (`UPDATE inventory SET reserved_qty =
  reserved_qty + qty WHERE product_id = id AND physical_qty - reserved_qty -
  damaged_qty >= qty`). The full lost-update explanation is documented in
  `src/services/inventory.service.js`.
- **Document numbers** (ENQ/QTN/SO/DSP) come from a `document_counters` table
  incremented inside the creating transaction (race-safe). Seed must have run
  at least once for counters to exist (tests create their own).
- **CHECK constraints** for inventory live in `prisma/check-constraints.sql`
  (Prisma does not support CHECK natively).

## Test Credentials

| Email | Role | Password |
| --- | --- | --- |
| admin@industraflow.com | ADMIN | Password123! |
| sales@industraflow.com | SALES | Password123! |

