# StockFlow ERP API Route Guide

Every route exists to move one part of the order lifecycle forward. The API is intentionally split by business responsibility so the frontend can stay focused and role-aware.

## Public platform routes

| Route | What it does | Why it exists |
| --- | --- | --- |
| `GET /api/health` | Reports that the API process is alive. | Load balancers and deployments need a cheap readiness signal. |
| `POST /api/auth/login` | Verifies credentials and returns an 8-hour JWT containing the user role. | The frontend needs a trusted identity before accessing operational data. |

## Catalog and demand

| Route | What it does | Why it exists |
| --- | --- | --- |
| `GET /api/products` | Lists products with live available quantity. | Sales needs current catalog and availability while capturing demand. |
| `POST /api/enquiries` | Creates an enquiry, customer context and line items in one transaction. | It is the system's first durable record of customer demand. |
| `GET /api/enquiries` | Lists enquiries with optional status filtering. | Teams need a queue of demand and its current lifecycle state. |
| `GET /api/enquiries/:id` | Returns one enquiry with customer and product detail. | Users need context before preparing a quote. |

## Commercial value

| Route | What it does | Why it exists |
| --- | --- | --- |
| `POST /api/quotations` | Creates a quotation and recalculates all money server-side. | Browser totals are estimates; the API is the pricing authority. |
| `GET /api/quotations` | Lists quotations with optional status filtering. | Sales needs a manageable quote pipeline. |
| `GET /api/quotations/:id` | Returns quote detail and a fresh recalculated total. | Stored value can be verified independently of client state. |
| `PATCH /api/quotations/:id/status` | Applies the allowed DRAFT to SENT to ACCEPTED/REJECTED state machine. | Controlled transitions keep commercial status meaningful. |
| `POST /api/quotations/:id/convert` | Converts one accepted quotation into one pending sales order. | Accepted value must become executable fulfillment work. |

## Fulfillment and inventory

| Route | What it does | Why it exists |
| --- | --- | --- |
| `GET /api/sales-orders` | Lists orders and their fulfillment summaries. | Admin and sales need a shared order queue. |
| `GET /api/sales-orders/:id` | Returns order lines and live availability per product. | Admin needs evidence before reserving stock. |
| `POST /api/sales-orders/:id/confirm` | Admin-only atomic stock reservation for a pending order. | It prevents over-committing limited inventory. |
| `POST /api/sales-orders/:id/dispatch` | Admin-only dispatch creation and physical/reserved stock deduction. | It records the handoff and keeps inventory truthful. |
| `GET /api/dispatches` | Lists completed dispatch records. | Operations needs an auditable outbound history. |
| `GET /api/dispatches/:id` | Returns one dispatch with order and product lines. | A dispatch record must be inspectable after the handoff. |

## Authorization model

- `SALES` and `ADMIN` can create enquiries and quotations.
- Authenticated users can read operational queues.
- Only `ADMIN` can confirm or dispatch orders.
- Missing, malformed and expired JWTs return `401`.
- Valid users without the required role return `403`.