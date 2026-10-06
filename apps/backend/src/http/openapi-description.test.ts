import { describe, expect, it } from "vitest";
import { seedTenants } from "../infra/seed/seed.js";
import { apiDescription, tagDescriptions } from "./openapi-description.js";

const seedUsers = seedTenants.flatMap(({ name, users }) =>
	users.map((user) => ({ tenant: name, ...user })),
);

function tag(name: string): string {
	const found = tagDescriptions.find((entry) => entry.name === name);
	if (!found) throw new Error(`tag ${name} not described`);
	return found.description;
}

describe("apiDescription", () => {
	it.each([
		"## Getting started",
		"## Authentication and tenancy",
		"## Roles",
		"## Conventions",
	])("has the section %s", (heading) => {
		expect(apiDescription({ showSeedUsers: false })).toContain(heading);
	});

	it.each([
		["400", "VALIDATION_ERROR"],
		["401", "UNAUTHORIZED"],
		["403", "FORBIDDEN"],
		["404", "NOT_FOUND"],
		["409", "CONFLICT"],
		["500", "INTERNAL_SERVER_ERROR"],
	])("maps status %s to %s", (status, code) => {
		expect(apiDescription({ showSeedUsers: false })).toContain(
			`| ${status} | \`${code}\` |`,
		);
	});

	it("lists every seeded user with tenant, role, email and password when asked", () => {
		const description = apiDescription({ showSeedUsers: true });

		expect(seedUsers).toHaveLength(4);
		for (const { tenant, role, email, password } of seedUsers) {
			expect(description).toContain(
				`| ${tenant} | \`${role}\` | \`${email}\` | \`${password}\` |`,
			);
		}
	});

	it("contains no seeded email or password otherwise", () => {
		const description = apiDescription({ showSeedUsers: false });

		for (const { email, password } of seedUsers) {
			expect(description).not.toContain(email);
			expect(description).not.toContain(password);
		}
	});
});

describe("tagDescriptions", () => {
	it("describes the Health, Auth, Products, Stock movements, Sales and Sync tags", () => {
		expect(tagDescriptions.map((entry) => entry.name)).toEqual([
			"Health",
			"Auth",
			"Products",
			"Stock movements",
			"Sales",
			"Sync",
		]);
		for (const { description } of tagDescriptions) {
			expect(description.length).toBeGreaterThan(0);
		}
	});

	it.each([
		"all-or-nothing",
		"`Idempotent-Replayed: true`",
		"The same key with different items answers `409`",
		"A key is kept only by a successful sale",
	])("states the sale rule: %s", (rule) => {
		expect(tag("Sales")).toContain(rule);
	});

	it.each(["pending", "sent", "failed", "superseded"])(
		"explains the %s sync status",
		(status) => {
			expect(tag("Sync")).toMatch(new RegExp(`\\| \`${status}\` \\| [^|\\s]`));
		},
	);
});
