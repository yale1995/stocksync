# Frontend Sales Specification

## Problem Statement

Registering a sale is the operator's core task, often under time pressure, and the outcome must be unambiguous. This feature turns the `/sales/new` placeholder into a multi-item sale form backed by `POST /api/v1/sales`. It blocks quantities the displayed stock cannot cover, never registers a sale twice on a retry (Idempotency-Key), and explains every outcome inline: the 201 summary, or a 409/404/400 naming what failed. Source of truth: `docs/prompts/06-frontend.md` (Screens > New sale, Tests > New sale) and the direction contract's FIRST VIEWPORT (`apps/frontend/.impeccable/surfaces/src.md`).

## Goals

- [ ] Staff build a sale of several products and see the line subtotals and the total before submitting
- [ ] A sale is never registered twice because of a retry, a timeout or a double click
- [ ] Every outcome says what happened and what to do next, inline above the form

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Sales history / receipt page | Not required; the API has no list endpoint |
| Editing the unit price | The API freezes the product's current price |
| Barcode scanning, keyboard shortcuts beyond the standard ones | Not required |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/06-frontend.md` and the direction contract | Applied as written | Agreed with the user | y |
| Columns | Product (name over SKU), In stock, Quantity, Unit price, Subtotal, Remove | Direction contract FIRST VIEWPORT | y |
| Add button label | "Add product" | Direction contract ("+ Add product"); the prompt's "Add item" names the same action | y |
| New line defaults | One empty line on open; picking a product sets quantity 1 | Fast path for the common case | y |
| Accessible names in a line | Product picker "Product, line N"; quantity "Quantity, line N"; remove "Remove line N" | Several lines share the same columns; the line number keeps names unique | y |
| Picker search | Debounced 300 ms; `GET /products?search=<text>&page=1&limit=20`; options show name, SKU and stock ("N in stock" or "Out of stock") | Same debounce as the products page; one page of matches is enough to pick from | y |
| Out-of-stock products in the picker | Offered (with the "Out of stock" badge); picking one shows the inline stock error | Staff should see why it cannot be sold, not wonder why it is missing | y |
| When the idempotency key changes | Every change to the lines (pick, quantity, add, remove) generates a new key; a resubmit without changes reuses it; a success generates a new key | Matches the prompt: same items reuse it, changed items or quantities get a new one | y |
| Displayed unit price | The product's current `priceCents`; the 201 summary shows the price the API froze | The API is the source of truth for the charged price | y |
| Client validation messages | Not a whole number: "Enter a whole number"; below 1: "Enter at least 1"; above stock: "Only N available" | Direction contract's "Only N available"; each names the fix | y |
| Outcome alert | One alert above the items card (`role="alert"`), replaced by the next submit's outcome. Failure title "Sale not registered" + API message + "Nothing was changed."; network/5xx add "Submitting again will not register it twice." | Sales are all-or-nothing; idempotency makes a retry safe | y |
| A line whose product no longer exists (detail 404) | Shows "This product is no longer available" and blocks submit | Happens after a 404 sale invalidates products | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Build a sale ⭐ MVP

**User Story**: As an operator, I want to add products and quantities and see the total so that I can register what the customer is buying.

**Acceptance Criteria**:

1. SALE-01: WHEN the page opens THEN the form SHALL show one empty line and an "Add product" button
2. SALE-02: WHEN "Add product" is activated THEN the system SHALL add an empty line
3. SALE-03: WHEN "Remove line N" is activated THEN the system SHALL remove that line, and WHILE only one line exists its remove button SHALL be disabled
4. SALE-04: WHEN the user types in a line's product picker THEN the system SHALL request `GET /products` with that `search` 300 ms after the last keystroke and list the matches with name, SKU and stock
5. SALE-05: The picker SHALL NOT offer a product already chosen in another line
6. SALE-06: WHEN a product is picked THEN the line SHALL show its name, SKU, available stock and unit price, set quantity 1, and load the stock from `GET /products/:id`
7. SALE-07: The system SHALL show each line's subtotal (unit price × quantity) and the sale total, formatted in USD

**Independent Test**: pick two products, change a quantity, see subtotals and total; the picker no longer offers the first product.

---

### P1: Client-side stock check ⭐ MVP

**User Story**: As an operator, I want to be stopped before submitting a quantity the stock cannot cover so that I fix it without a round trip.

**Acceptance Criteria**:

1. SALE-08: IF a quantity is above the line's displayed stock THEN the line SHALL show "Only N available" next to the quantity, set `aria-invalid` and link the message with `aria-describedby`
2. SALE-09: IF a quantity is below 1 or not a whole number THEN the line SHALL show "Enter at least 1" or "Enter a whole number" the same way
3. SALE-10: WHILE any line has no product, an invalid quantity or an unavailable product, the "Register sale" button SHALL be disabled
4. SALE-11: IF a line's product detail answers 404 THEN the line SHALL show "This product is no longer available"

**Independent Test**: pick a product with stock 2, type 3, see "Only 2 available" and a disabled submit.

---

### P1: Submit once, whatever happens ⭐ MVP

**User Story**: As an operator, I want retries to be safe so that a network hiccup or a double click never registers the sale twice.

**Acceptance Criteria**:

1. SALE-12: WHEN the form opens THEN the system SHALL generate an Idempotency-Key with `crypto.randomUUID()` and send it on `POST /sales` with `{ items: [{ productId, quantity }] }`
2. SALE-13: WHEN the same lines are submitted again (after a network error, a timeout or any failure) THEN the system SHALL send the same Idempotency-Key
3. SALE-14: WHEN any line changes (product, quantity, added or removed line) THEN the next submit SHALL send a new Idempotency-Key
4. SALE-15: WHILE the request is pending the "Register sale" button SHALL be disabled

**Independent Test**: fail the first `POST /sales` with a network error, resubmit and compare keys; change a quantity, resubmit and compare again.

---

### P1: Outcomes ⭐ MVP

**User Story**: As an operator, I want to know at once whether the sale was registered and, if not, why.

**Acceptance Criteria**:

1. SALE-16: WHEN the API answers 201 THEN the system SHALL show "Sale registered" with each item's SKU, name, quantity, unit price and line total and the sale total from the response, reset the form to one empty line, and use a new Idempotency-Key for the next sale
2. SALE-17: WHEN the API answers 201 THEN the system SHALL invalidate the `products` queries
3. SALE-18: IF the API answers 409 THEN the system SHALL show "Sale not registered" with the API message and "Nothing was changed.", keep the lines, and invalidate the `products` queries so the lines show the current stock
4. SALE-19: IF the API answers 404 THEN the system SHALL show "Sale not registered" with the API message ("One or more products were not found"), keep the lines and invalidate the `products` queries
5. SALE-20: IF the API answers 400 THEN the system SHALL show "Sale not registered" with the API message and keep the lines
6. SALE-21: IF the request fails without a response or with a 5xx THEN the system SHALL show "Sale not registered" with the error message and "Submitting again will not register it twice.", and keep the lines
7. SALE-22: The outcome alert SHALL sit above the items card with `role="alert"` and SHALL be replaced by the next submit's outcome

**Independent Test**: one MSW scenario per status; for 409, the line's stock updates from the refetched product.

---

## Edge Cases

- WHEN a 201 arrives with `Idempotent-Replayed: true` THEN the system SHALL show the same "Sale registered" summary (the sale exists once)
- WHEN the user double-clicks "Register sale" THEN the system SHALL send one request
- WHEN a 409 lowers a line's stock below its quantity THEN that line SHALL show "Only N available" and the submit SHALL be disabled until fixed

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SALE-01 | P1: Build a sale | Execute | Implemented |
| SALE-02 | P1: Build a sale | Execute | Implemented |
| SALE-03 | P1: Build a sale | Execute | Implemented |
| SALE-04 | P1: Build a sale | Execute | Implemented |
| SALE-05 | P1: Build a sale | Execute | Implemented |
| SALE-06 | P1: Build a sale | Execute | Implemented |
| SALE-07 | P1: Build a sale | Execute | Implemented |
| SALE-08 | P1: Client-side stock check | Execute | Implemented |
| SALE-09 | P1: Client-side stock check | Execute | Implemented |
| SALE-10 | P1: Client-side stock check | Execute | Implemented |
| SALE-11 | P1: Client-side stock check | Execute | Implemented |
| SALE-12 | P1: Submit once | Execute | Implemented |
| SALE-13 | P1: Submit once | Execute | Implemented |
| SALE-14 | P1: Submit once | Execute | Implemented |
| SALE-15 | P1: Submit once | Execute | Implemented |
| SALE-16 | P1: Outcomes | Execute | Implemented |
| SALE-17 | P1: Outcomes | Execute | Implemented |
| SALE-18 | P1: Outcomes | Execute | Implemented |
| SALE-19 | P1: Outcomes | Execute | Implemented |
| SALE-20 | P1: Outcomes | Execute | Implemented |
| SALE-21 | P1: Outcomes | Execute | Implemented |
| SALE-22 | P1: Outcomes | Execute | Implemented |

**Coverage:** 22 total, 22 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm --filter frontend test`, `pnpm lint:check` and `pnpm --filter frontend build` pass
- [ ] With the seeded backend, an operator registers a two-item sale, sees the summary, and the products page shows the lowered stock; a sale above stock shows the 409 with every short SKU
