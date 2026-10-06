import { seedTenants } from "../infra/seed/seed.js";

function seedUsersSection(): string {
	const rows = seedTenants.flatMap(({ name, users }) =>
		users.map(
			({ email, password, role }) =>
				`| ${name} | \`${role}\` | \`${email}\` | \`${password}\` |`,
		),
	);
	return `### Seeded users

Available after \`pnpm db:seed\`. Each tenant only sees its own data.

| Tenant | Role | Email | Password |
| ------ | ---- | ----- | -------- |
${rows.join("\n")}
`;
}

export function apiDescription({
	showSeedUsers,
}: {
	showSeedUsers: boolean;
}): string {
	return `Multi-tenant inventory API. Each tenant manages a product catalog and registers sales. Every stock or price change is pushed asynchronously to an external ads service, so ads never promote out-of-stock items. No request waits for that service.

## Getting started

1. Call \`POST /auth/login\` ${showSeedUsers ? "with one of the users below" : "with your credentials"}. The response sets the \`access_token\` cookie.
2. Call any other endpoint. The browser sends the cookie on every request to this origin.

${showSeedUsers ? seedUsersSection() : ""}
## Authentication and tenancy

- The token is a JWT in the httpOnly \`access_token\` cookie, valid for 1 hour, with no refresh token. Log in again when it expires.
- The tenant comes only from the token. A \`tenantId\` sent in the path, query, header or body is ignored.
- A resource of another tenant answers \`404\`, the same as a missing one, so ids of other tenants cannot be probed.

## Roles

| Action | \`admin\` | \`operator\` |
| ------ | :-------: | :----------: |
| Read products, stock movements and sync status | ✓ | ✓ |
| Register sales | ✓ | ✓ |
| Create, update and delete products | ✓ | |
| Adjust stock | ✓ | |

## Conventions

- **Errors** always have the shape \`{ "error": { "code", "message" } }\`. Stack traces and SQL are never returned.

  | Status | Code |
  | ------ | ---- |
  | 400 | \`VALIDATION_ERROR\` |
  | 401 | \`UNAUTHORIZED\` |
  | 403 | \`FORBIDDEN\` |
  | 404 | \`NOT_FOUND\` |
  | 409 | \`CONFLICT\` |
  | 500 | \`INTERNAL_SERVER_ERROR\` |

- **Pagination**: \`page\` (default 1) and \`limit\` (default 20, max 100). Lists answer \`{ data, meta: { page, limit, total } }\`; a page past the end returns \`data: []\`.
- **Money** is an integer number of cents (\`priceCents\`, \`unitPriceCents\`, \`totalCents\`). There are no floating-point prices.
- **SKU** is trimmed, uppercased and unique per tenant. It cannot change after creation, because the ads service identifies products by SKU.
- **Timestamps** are ISO 8601 strings in UTC.
`;
}

export const tagDescriptions = [
	{
		name: "Health",
		description: "Server, database and sync queue health.",
	},
	{
		name: "Auth",
		description: "Log in and out with the `access_token` cookie.",
	},
	{
		name: "Products",
		description:
			"The tenant's catalog. Deleting a product is a soft delete; its SKU can be created again.",
	},
	{
		name: "Stock movements",
		description:
			"Every stock change (initial stock, adjustment or sale) is recorded in an append-only ledger with who, when, why and the stock after the change. A movement is never edited or deleted: a wrong adjustment is corrected with an opposite one.",
	},
	{
		name: "Sales",
		description: `A sale is all-or-nothing: if one item lacks stock, nothing changes and the \`409\` lists every short item. Concurrent sales never oversell.

Send an \`Idempotency-Key\` (uuid) with every sale:

- Retrying with the same key and the same items replays the original sale with \`201\` and \`Idempotent-Replayed: true\`. Item order does not matter.
- The same key with different items answers \`409\`.
- A key is kept only by a successful sale, so a sale that failed can be retried with the same key.`,
	},
	{
		name: "Sync",
		description: `Product changes are written to an outbox in the same transaction as the change, then sent to the ads service by a background worker in single-tenant batches, respecting its rate limit and retrying failures with backoff.

| Status | Meaning |
| ------ | ------- |
| \`pending\` | Waiting to be sent or retried |
| \`sent\` | Accepted by the ads service |
| \`failed\` | Gave up after the maximum number of attempts |
| \`superseded\` | A newer change of the same product was sent or is about to be, so this one no longer needs to be |

Every update carries an increasing version, and the ads service ignores versions older than the one it holds, so duplicates and out-of-order deliveries never overwrite newer data.`,
	},
];
