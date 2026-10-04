import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../db.js";
import { verifyPassword } from "../password.js";
import { tenants } from "../schemas/tenants.js";
import { users } from "../schemas/users.js";
import { seed, seedTenants } from "./seed.js";

async function seededUsers() {
	return db
		.select({
			tenant: tenants.name,
			email: users.email,
			role: users.role,
			passwordHash: users.passwordHash,
		})
		.from(users)
		.innerJoin(tenants, eq(users.tenantId, tenants.id))
		.orderBy(users.email);
}

describe("seed", () => {
	it("creates Acme and Globex with one admin and one operator each", async () => {
		await seed(db);

		const rows = await seededUsers();

		expect(
			rows.map(({ tenant, email, role }) => ({ tenant, email, role })),
		).toEqual([
			{ tenant: "Acme", email: "admin@acme.test", role: "admin" },
			{ tenant: "Globex", email: "admin@globex.test", role: "admin" },
			{ tenant: "Acme", email: "operator@acme.test", role: "operator" },
			{ tenant: "Globex", email: "operator@globex.test", role: "operator" },
		]);
	});

	it("stores bcrypt hashes of the seed passwords", async () => {
		await seed(db);

		const rows = await seededUsers();
		const seedUsers = seedTenants.flatMap((tenant) => tenant.users);

		for (const row of rows) {
			const seedUser = seedUsers.find((user) => user.email === row.email);
			expect(row.passwordHash).toMatch(/^\$2[aby]\$10\$/);
			expect(
				await verifyPassword(seedUser?.password ?? "", row.passwordHash),
			).toBe(true);
		}
	});

	it("runs twice without errors or duplicate rows", async () => {
		await seed(db);
		await seed(db);

		const [tenantCount] = await db.select({ value: count() }).from(tenants);
		const [userCount] = await db.select({ value: count() }).from(users);

		expect(tenantCount?.value).toBe(2);
		expect(userCount?.value).toBe(4);
	});
});
