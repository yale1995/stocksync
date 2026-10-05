import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../db.js";
import { verifyPassword } from "../password.js";
import { products } from "../schemas/products.js";
import { syncEvents } from "../schemas/sync-events.js";
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

	it("creates two products per tenant, with CAM-P in both and one out of stock each", async () => {
		await seed(db);

		const rows = await db
			.select({
				tenant: tenants.name,
				sku: products.sku,
				stock: products.stock,
			})
			.from(products)
			.innerJoin(tenants, eq(products.tenantId, tenants.id))
			.orderBy(tenants.name, products.sku);

		expect(rows).toEqual([
			{ tenant: "Acme", sku: "BON-01", stock: 0 },
			{ tenant: "Acme", sku: "CAM-P", stock: 25 },
			{ tenant: "Globex", sku: "CAM-P", stock: 10 },
			{ tenant: "Globex", sku: "CAN-01", stock: 0 },
		]);
	});

	it("records one pending product_created event per product, once", async () => {
		await seed(db);
		await seed(db);

		const rows = await db
			.select({
				tenant: tenants.name,
				productSku: products.sku,
				sku: syncEvents.sku,
				trigger: syncEvents.trigger,
				stock: syncEvents.stock,
				priceCents: syncEvents.priceCents,
				status: syncEvents.status,
			})
			.from(syncEvents)
			.innerJoin(tenants, eq(syncEvents.tenantId, tenants.id))
			.innerJoin(products, eq(syncEvents.productId, products.id))
			.orderBy(tenants.name, syncEvents.sku);

		const created = { trigger: "product_created", status: "pending" };
		expect(rows).toEqual([
			{
				...created,
				tenant: "Acme",
				productSku: "BON-01",
				sku: "BON-01",
				stock: 0,
				priceCents: 2990,
			},
			{
				...created,
				tenant: "Acme",
				productSku: "CAM-P",
				sku: "CAM-P",
				stock: 25,
				priceCents: 4990,
			},
			{
				...created,
				tenant: "Globex",
				productSku: "CAM-P",
				sku: "CAM-P",
				stock: 10,
				priceCents: 5490,
			},
			{
				...created,
				tenant: "Globex",
				productSku: "CAN-01",
				sku: "CAN-01",
				stock: 0,
				priceCents: 1990,
			},
		]);
	});

	it("runs twice without errors or duplicate rows", async () => {
		await seed(db);
		await seed(db);

		const [tenantCount] = await db.select({ value: count() }).from(tenants);
		const [userCount] = await db.select({ value: count() }).from(users);
		const [productCount] = await db.select({ value: count() }).from(products);

		expect(tenantCount?.value).toBe(2);
		expect(userCount?.value).toBe(4);
		expect(productCount?.value).toBe(4);
	});
});
