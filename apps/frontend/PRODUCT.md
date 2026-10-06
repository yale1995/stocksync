# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Store staff of a tenant, in their daily work:

- **Operator:** registers sales, often under time pressure, and checks product stock. Read-only on products.
- **Admin:** manages the catalog and watches stock and the sync with the advertising service.

Both roles use the same screens in this app; the role is only displayed.

## Product Purpose

StockSync is a multi-tenant inventory platform. Each tenant manages its product catalog and registers sales; every stock or price change is pushed asynchronously to an external advertising service so ads never promote items that are out of stock.

Success for staff: register a sale quickly and correctly, see at a glance what is in or out of stock, and trust that the ads are in sync (or see clearly when they are not).

## Operating Context

- Built as a technical assessment for CPP Digital: it is evaluated by reviewers and shown in a recorded walkthrough, but it is designed as a real tool for store staff.
- Screens in scope: login, product list (search, out-of-stock filter, pagination), new sale (multiple items), sync status (polling).
- The API is the source of truth. Stock can change concurrently (another sale), so the UI must handle a stale view: a sale can still be rejected for insufficient stock.

## Capabilities and Constraints

- Desktop first (laptop and monitor, dense tables); mobile must work without breaking, but is not a primary target.
- Sales are all-or-nothing and idempotent: retrying the same sale never registers it twice. An insufficient-stock rejection lists every short SKU with available and requested quantities.
- Sync updates move through pending, sent, failed and superseded; failures are retried with backoff and end as failed after a maximum number of attempts.
- Sessions last 1 hour with no refresh; an expired session sends the user back to login.
- Money is integer cents in the API. UI copy is English, matching the API's messages.
- Out of scope in the UI: product create/edit/delete, stock adjustments, movement history.

## Brand Commitments

No existing brand: "StockSync" is only a name, with no logo, palette or voice, and none should be presented as an existing brand.

Standing preference (chosen 2026-10-06 over three bespoke directions): the category standard, executed at full fidelity. The app should sit comfortably next to **Linear** and the **official shadcn/ui examples**; their craft level is the bar. Convention is the commitment: no novelty motifs, no smuggled quirks.

## Evidence on Hand

- Seed data: two tenants (Acme, Globex), each with an admin and an operator and two products, one of them out of stock. No real customers, testimonials or metrics exist; do not fabricate them.

## Product Principles

- Speed and certainty at the point of sale: the outcome of every action is unambiguous.
- Stock state is readable at a glance; out of stock is never easy to miss.
- Failures are explained, not hidden: insufficient stock, expired session and sync failures say what happened and what to do next.
- The server is the source of truth; the UI never pretends a stale value is current.

## Accessibility & Inclusion

Basic accessibility is an evaluation criterion: labeled inputs, keyboard operation, visible focus, announced async feedback, sufficient contrast. No formal WCAG level was committed.
