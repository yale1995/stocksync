# Frontend Products Specification

## Problem Statement

Store staff need to see at a glance which products are in or out of stock and find a product quickly. This feature turns the `/products` placeholder into a read-only, paginated table backed by `GET /api/v1/products`, with search and an in/out-of-stock filter kept in the URL so back/forward and shared links work. Source of truth: `docs/prompts/06-frontend.md` (Screens > Products, Tests > Products list).

## Goals

- [ ] Staff find a product by SKU or name and see its price and stock without leaving the table
- [ ] Out of stock is impossible to miss and never relies on color alone
- [ ] Every filter state is a URL that can be shared or revisited

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Create, edit, delete, stock adjustment, movement history | README future improvement; the API supports them, the UI covers only the required screens |
| Sorting by column | Not required; the API orders by name |
| Page size selector | Fixed `limit` of 20 (prompt) |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/06-frontend.md` | Applied as written | Agreed with the user | y |
| URL format of the params | TanStack Router's JSON search format: `?search=cam&outOfStock=true&page=2`; `page=1` and empty values are omitted from the URL | The router parses `true` and `2` as boolean and number, so the Zod schema validates those types. Default values stay out of shared links | y |
| Invalid params in a shared link | `page` that is not an integer ≥ 1 becomes 1; `outOfStock` that is not a boolean becomes absent (All); a numeric `search` is read as text | The prompt asks for Zod validation; a broken link should still open the list instead of an error | y |
| Search scope | Placeholder "Search by name or SKU"; the API matches name or SKU, case-insensitive, up to 100 characters (`maxLength=100` on the input) | Mirrors `listProductsQuery` in the backend | y |
| Debounce | 300 ms after the last keystroke | Prompt (~300 ms) | y |
| Typing while a previous search is in flight | The input keeps what the user typed; it only follows the URL on back/forward or "Clear filters" | Avoids the text jumping back to an older value | y |
| A page past the end (e.g. `?page=9` with 2 pages) | Shows "This page is empty" with a "Go to first page" action | The API answers `data: []` with `total > 0`; this is neither "no products" nor "no match" | y |
| Stock 0 display | The number `0` plus an "Out of stock" badge (text, not color only) | Prompt + direction contract | y |
| Loading state | 5 skeleton rows plus a screen-reader status "Loading products…" | Prompt asks for skeleton rows; the status makes the state perceivable without sight | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Browse products ⭐ MVP

**User Story**: As store staff, I want a table of products with price and stock so that I can see what is available.

**Acceptance Criteria**:

1. PROD-01: The table SHALL have the accessible name "Products" and the columns SKU, Name, Price and Stock, one row per product in the order the API returns
2. PROD-02: The system SHALL format `priceCents` as USD with `Intl.NumberFormat` (e.g. `4990` → `$49.90`)
3. PROD-03: WHEN a product's stock is 0 THEN its row SHALL show an "Out of stock" badge next to the stock
4. PROD-04: WHILE the first page is loading the system SHALL show skeleton rows and a status "Loading products…"
5. PROD-05: IF the request fails THEN the system SHALL show the error message and a "Retry" button, and WHEN "Retry" is activated THEN it SHALL request the same page again
6. PROD-06: WHEN the API returns no products and no filter is set THEN the system SHALL show "No products yet"
7. PROD-07: WHEN the API returns no products and a search or stock filter is set THEN the system SHALL show "No products match your filters" with a "Clear filters" action that removes `search`, `outOfStock` and `page`

**Independent Test**: render `/products` against MSW fixtures and see rows, prices and the badge; swap the handler for empty and error responses.

---

### P1: Filters in the URL ⭐ MVP

**User Story**: As store staff, I want to search and filter by stock, with the result kept in the URL, so that I can go back, forward or share it.

**Acceptance Criteria**:

1. PROD-08: The system SHALL read `search`, `outOfStock` and `page` from the URL and request `GET /products` with those values and `limit=20`
2. PROD-09: WHEN the user types in the search input THEN the system SHALL update `search` in the URL 300 ms after the last keystroke and reset `page` to 1
3. PROD-10: WHEN the user picks All, In stock or Out of stock THEN the system SHALL set `outOfStock` to absent, `false` or `true` and reset `page` to 1
4. PROD-11: IF a URL param is invalid THEN the system SHALL use its default (`page` 1, no stock filter) instead of failing
5. PROD-12: The search input and the stock filter SHALL have labels

**Independent Test**: open `/products?search=cam&outOfStock=true&page=2` and inspect the request; type and pick a filter and inspect the URL and the next request.

---

### P1: Pagination ⭐ MVP

**User Story**: As store staff, I want to move between pages so that I can see the whole catalog.

**Acceptance Criteria**:

1. PROD-13: The system SHALL show "Page X of Y" with Y = max(1, ceil(total / 20))
2. PROD-14: WHEN "Next" or "Previous" is activated THEN the system SHALL set `page` to the next or previous number
3. PROD-15: The system SHALL disable "Previous" on page 1 and "Next" on the last page
4. PROD-16: WHILE the next page is loading the system SHALL keep the previous page's rows visible

**Independent Test**: with 45 products, go from page 1 to 2 and see page 1 rows until page 2 arrives.

---

## Edge Cases

- WHEN `page` is past the last page THEN the system SHALL show "This page is empty" with a "Go to first page" action
- WHEN the user navigates back after changing a filter THEN the search input and the filter SHALL show the URL's values again

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PROD-01 | P1: Browse products | Execute | Implemented |
| PROD-02 | P1: Browse products | Execute | Implemented |
| PROD-03 | P1: Browse products | Execute | Implemented |
| PROD-04 | P1: Browse products | Execute | Implemented |
| PROD-05 | P1: Browse products | Execute | Implemented |
| PROD-06 | P1: Browse products | Execute | Implemented |
| PROD-07 | P1: Browse products | Execute | Implemented |
| PROD-08 | P1: Filters in the URL | Execute | Implemented |
| PROD-09 | P1: Filters in the URL | Execute | Implemented |
| PROD-10 | P1: Filters in the URL | Execute | Implemented |
| PROD-11 | P1: Filters in the URL | Execute | Implemented |
| PROD-12 | P1: Filters in the URL | Execute | Implemented |
| PROD-13 | P1: Pagination | Execute | Implemented |
| PROD-14 | P1: Pagination | Execute | Implemented |
| PROD-15 | P1: Pagination | Execute | Implemented |
| PROD-16 | P1: Pagination | Execute | Implemented |

**Coverage:** 16 total, 16 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm --filter frontend test`, `pnpm lint:check` and `pnpm --filter frontend build` pass
- [ ] With the seeded backend, Acme's out-of-stock product shows the badge and the Out of stock filter lists only it
