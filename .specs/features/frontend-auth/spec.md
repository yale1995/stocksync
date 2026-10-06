# Frontend Auth Specification

## Problem Statement

Every StockSync screen is behind login. Store staff need to sign in with email and password, land where they were going, see who and which tenant they are signed in as, sign out, and be sent back to login with a clear message when the 1 h session expires. This feature adds the login screen, the route guard and app layout, logout and the global 401 handling. Source of truth: `docs/prompts/06-frontend.md` (Routes, Session and 401, Screens > Login, Accessibility).

## Goals

- [ ] An unauthenticated visitor can only reach `/login`; after signing in they land on the page they asked for
- [ ] A signed-in user always sees their email, tenant and role, and can sign out
- [ ] An expired session never leaves the user on a broken screen: they are sent to login with an explanation

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Products, New sale and Sync status content | Features `frontend-products`, `frontend-sales`, `frontend-sync`; this feature adds their routes with only the page heading so the nav works |
| Role-based screens | Admin and operator see the same screens; the role is only displayed |
| Session refresh / remember me | 1 h JWT without refresh (README trade-off) |
| Seeded-user hint on the login screen | Credentials are documented in the README only |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| All decisions in `docs/prompts/06-frontend.md` | Applied as written | Agreed with the user | y |
| When a 401 means "session expired" | Only when the app had a signed-in user (the `me` query has data). A 401 with no known user (first visit, guard check) redirects to `/login?redirect=…` without the message | Reconciles the prompt's two rules: the guard redirects silently, and "Your session has expired" is only true if there was a session. It also deduplicates parallel 401s: the first clears the cache, the rest find no user | y (no conflict with the prompt) |
| How the expired message reaches the login page | Search param `reason=expired` next to `redirect` | Survives the navigation, is testable, and keeps the login page the single place that renders it | y |
| Internal `redirect` | A path starting with `/` but not `//`; anything else goes to `/products` | Blocks open redirects to other origins | y |
| Client-side login validation | Email required and shaped like an email ("Enter your email" / "Enter a valid email address"), password required ("Enter your password"), checked on submit before calling the API | The prompt asks for field errors next to the fields; the API's 400 stays the backstop and is shown in the alert | y |
| Logout failure (network) | Stay signed in and show "Could not log out. Try again." in an alert next to the button | The cookie is `httpOnly`; only the API can clear it, so pretending to log out would be a lie | y |
| Placeholder pages | `/products`, `/sales/new` and `/sync` render only their heading and one-line description until their features land | The nav and the guard need real routes to link to and test | y |
| Layout | White sidebar with the app name and tenant, nav, and a user block (email, role) with "Log out" at the bottom; on narrow screens the sidebar becomes a top bar | Direction contract and Paper artboard 4 (critique reference); mobile must work | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Sign in ⭐ MVP

**User Story**: As store staff, I want to sign in with my email and password so that I can use the app for my tenant.

**Acceptance Criteria**:

1. AUTH-01: The login form SHALL have labelled "Email" and "Password" inputs and a "Log in" submit button
2. AUTH-02: WHILE the login request is pending the system SHALL disable the submit button
3. AUTH-03: WHEN the API accepts the credentials and `redirect` is an internal path THEN the system SHALL navigate to `redirect`
4. AUTH-04: WHEN the API accepts the credentials and `redirect` is absent or not an internal path THEN the system SHALL navigate to `/products`
5. AUTH-05: IF the API answers 401 THEN the system SHALL show its message ("Invalid email or password") in an alert (`role="alert"`)
6. AUTH-06: IF the email is empty or not shaped like an email, or the password is empty, THEN the system SHALL show the error next to that field, set `aria-invalid` and link it with `aria-describedby`, and SHALL NOT call the API
7. AUTH-07: WHEN a signed-in user visits `/login` THEN the system SHALL redirect to `/products`

**Independent Test**: render `/login?redirect=/sync` with MSW, submit valid credentials, land on `/sync`.

---

### P1: Guard and layout ⭐ MVP

**User Story**: As store staff, I want every screen to require a session and show who I am so that I never act on the wrong tenant.

**Acceptance Criteria**:

1. AUTH-08: WHEN a visitor without a session opens a protected route THEN the system SHALL redirect to `/login?redirect=<that location>` without the expired-session message
2. AUTH-09: WHEN `/` is opened by a signed-in user THEN the system SHALL redirect to `/products`
3. AUTH-10: WHILE signed in the layout SHALL show the user's email, tenant name and role
4. AUTH-11: The layout SHALL have a navigation landmark with links "Products", "New sale" and "Sync status", marking the current page with `aria-current="page"`
5. AUTH-12: WHEN the user activates "Log out" THEN the system SHALL call `POST /auth/logout`, clear the query cache and navigate to `/login`
6. AUTH-13: IF `POST /auth/logout` fails THEN the system SHALL keep the user on the page and show "Could not log out. Try again." in an alert

**Independent Test**: render `/sync` with a signed-in MSW user, see email/tenant/role and the current nav item, log out and land on `/login`.

---

### P1: Session expiry ⭐ MVP

**User Story**: As store staff, I want to be told when my session expired so that I understand why I am back at login.

**Acceptance Criteria**:

1. AUTH-14: WHEN any API request other than `POST /auth/login` answers 401 while a user is signed in THEN the system SHALL clear the query cache and navigate to `/login?redirect=<current location>`
2. AUTH-15: WHEN the login page is opened after a session expiry THEN it SHALL show "Your session has expired. Please log in again." in an alert (`role="alert"`)
3. AUTH-16: WHEN the user signs in again after an expiry THEN the system SHALL navigate back to the location they were on

**Independent Test**: signed in on `/products`, a protected request answers 401, the user is on `/login` with the message and returns to `/products` after logging in.

---

### P2: Focus on navigation

**User Story**: As a keyboard or screen reader user, I want focus to move to the new page's heading on navigation so that I know the page changed.

**Acceptance Criteria**:

1. AUTH-17: WHEN the route changes to a different path THEN the system SHALL move focus to the page's `h1`

**Independent Test**: click "Sync status" in the nav; the "Sync status" heading has focus.

---

## Edge Cases

- WHEN `redirect` is `//evil.example` or `https://evil.example` THEN after login the system SHALL navigate to `/products`
- WHEN several protected requests answer 401 at once THEN the system SHALL navigate to login once, with the message
- IF the API is unreachable during login THEN the system SHALL show the client's network message in the alert

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUTH-01 | P1: Sign in | Execute | Implemented |
| AUTH-02 | P1: Sign in | Execute | Implemented |
| AUTH-03 | P1: Sign in | Execute | Implemented |
| AUTH-04 | P1: Sign in | Execute | Implemented |
| AUTH-05 | P1: Sign in | Execute | Implemented |
| AUTH-06 | P1: Sign in | Execute | Implemented |
| AUTH-07 | P1: Sign in | Execute | Implemented |
| AUTH-08 | P1: Guard and layout | Execute | Implemented |
| AUTH-09 | P1: Guard and layout | Execute | Implemented |
| AUTH-10 | P1: Guard and layout | Execute | Implemented |
| AUTH-11 | P1: Guard and layout | Execute | Implemented |
| AUTH-12 | P1: Guard and layout | Execute | Implemented |
| AUTH-13 | P1: Guard and layout | Execute | Implemented |
| AUTH-14 | P1: Session expiry | Execute | Implemented |
| AUTH-15 | P1: Session expiry | Execute | Implemented |
| AUTH-16 | P1: Session expiry | Execute | Implemented |
| AUTH-17 | P2: Focus on navigation | Execute | Implemented |

**Coverage:** 17 total, 17 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm --filter frontend test`, `pnpm lint:check` and `pnpm --filter frontend build` pass
- [ ] With the real backend, `operator@acme.test` signs in, sees "Acme" and "Operator", logs out, and an expired cookie sends them back to login with the message
