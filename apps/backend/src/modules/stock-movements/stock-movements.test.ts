import { and, eq } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../infra/db.js";
import { signAccessToken } from "../../infra/jwt.js";
import { products } from "../../infra/schemas/products.js";
import { stockMovements } from "../../infra/schemas/stock-movements.js";
import { tenants } from "../../infra/schemas/tenants.js";
import { users } from "../../infra/schemas/users.js";
import { seed } from "../../infra/seed/seed.js";

async function findUser(email: string) {
	const [user] = await db.select().from(users).where(eq(users.email, email));
	if (!user) throw new Error(`user ${email} not seeded`);
	return user;
}

async function cookieFor(email: string): Promise<string> {
	const user = await findUser(email);
	const token = await signAccessToken({
		userId: user.id,
		tenantId: user.tenantId,
		role: user.role,
	});
	return `access_token=${token}`;
}

async function findProduct(tenant: string, sku: string) {
	const [product] = await db
		.select({ product: products })
		.from(products)
		.innerJoin(tenants, eq(products.tenantId, tenants.id))
		.where(and(eq(tenants.name, tenant), eq(products.sku, sku)));
	if (!product) throw new Error(`product ${sku} of ${tenant} not found`);
	return product.product;
}

function movementsOf(productId: string) {
	return db
		.select()
		.from(stockMovements)
		.where(eq(stockMovements.productId, productId));
}

let acmeAdmin: string;
let acmeOperator: string;

beforeEach(async () => {
	await seed(db);
	acmeAdmin = await cookieFor("admin@acme.test");
	acmeOperator = await cookieFor("operator@acme.test");
});

describe("database constraints", () => {
	async function rawMovement(override: object) {
		const camP = await findProduct("Acme", "CAM-P");
		const admin = await findUser("admin@acme.test");
		return db.insert(stockMovements).values({
			tenantId: camP.tenantId,
			productId: camP.id,
			userId: admin.id,
			direction: "in",
			source: "adjustment",
			quantity: 1,
			stockAfter: 26,
			reason: "Raw insert",
			...override,
		});
	}

	it.each([
		[
			"an initial movement going out",
			{ source: "initial", direction: "out", reason: null },
			"stock_movements_initial_is_in",
		],
		[
			"a sale movement going in",
			{ source: "sale", direction: "in", reason: null },
			"stock_movements_sale_is_out",
		],
		[
			"an adjustment with quantity 0",
			{ quantity: 0 },
			"stock_movements_quantity_positive",
		],
		[
			"a negative stock_after",
			{ stockAfter: -1 },
			"stock_movements_stock_after_non_negative",
		],
		[
			"an adjustment without a reason",
			{ reason: null },
			"stock_movements_reason_only_for_adjustments",
		],
		[
			"an initial movement with a reason",
			{ source: "initial", reason: "x" },
			"stock_movements_reason_only_for_adjustments",
		],
	])("rejects %s", async (_label, override, constraint) => {
		await expect(rawMovement(override)).rejects.toMatchObject({
			cause: { code: "23514", constraint },
		});
	});

	it("rejects a movement pointing to a product of another tenant", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		await expect(
			rawMovement({ productId: globexCamP.id }),
		).rejects.toMatchObject({
			cause: { code: "23503", constraint: "stock_movements_product_fk" },
		});
	});

	it("rejects a movement made by a user of another tenant", async () => {
		const globexAdmin = await findUser("admin@globex.test");

		await expect(rawMovement({ userId: globexAdmin.id })).rejects.toMatchObject(
			{ cause: { code: "23503", constraint: "stock_movements_user_fk" } },
		);
	});
});

describe("seed", () => {
	it("records exactly one initial movement per product by the tenant's admin, even when run twice", async () => {
		await seed(db);

		const rows = await db
			.select({
				tenant: tenants.name,
				sku: products.sku,
				stock: products.stock,
				direction: stockMovements.direction,
				source: stockMovements.source,
				quantity: stockMovements.quantity,
				stockAfter: stockMovements.stockAfter,
				reason: stockMovements.reason,
				email: users.email,
			})
			.from(stockMovements)
			.innerJoin(products, eq(stockMovements.productId, products.id))
			.innerJoin(tenants, eq(stockMovements.tenantId, tenants.id))
			.innerJoin(users, eq(stockMovements.userId, users.id))
			.orderBy(tenants.name, products.sku);

		const initial = { direction: "in", source: "initial", reason: null };
		expect(rows).toEqual([
			{
				...initial,
				tenant: "Acme",
				sku: "BON-01",
				stock: 0,
				quantity: 0,
				stockAfter: 0,
				email: "admin@acme.test",
			},
			{
				...initial,
				tenant: "Acme",
				sku: "CAM-P",
				stock: 25,
				quantity: 25,
				stockAfter: 25,
				email: "admin@acme.test",
			},
			{
				...initial,
				tenant: "Globex",
				sku: "CAM-P",
				stock: 10,
				quantity: 10,
				stockAfter: 10,
				email: "admin@globex.test",
			},
			{
				...initial,
				tenant: "Globex",
				sku: "CAN-01",
				stock: 0,
				quantity: 0,
				stockAfter: 0,
				email: "admin@globex.test",
			},
		]);
	});
});

describe("initial movement on POST /products", () => {
	function createProduct(stock: number) {
		return request(createApp())
			.post("/products")
			.set("Cookie", acmeAdmin)
			.send({ sku: "MUG-01", name: "Mug", priceCents: 1500, stock });
	}

	it.each([[12], [0]])(
		"records an initial movement with stock %i by the creating admin",
		async (stock) => {
			const admin = await findUser("admin@acme.test");

			const response = await createProduct(stock);

			expect(response.status).toBe(201);
			expect(Object.keys(response.body).sort()).toEqual([
				"createdAt",
				"id",
				"name",
				"priceCents",
				"sku",
				"stock",
				"updatedAt",
			]);
			const movements = await movementsOf(response.body.id);
			expect(movements).toEqual([
				expect.objectContaining({
					tenantId: admin.tenantId,
					direction: "in",
					source: "initial",
					quantity: stock,
					stockAfter: stock,
					reason: null,
					userId: admin.id,
				}),
			]);
		},
	);
});

const notFoundBody = {
	error: { code: "NOT_FOUND", message: "Product not found" },
};
const unauthorizedBody = {
	error: { code: "UNAUTHORIZED", message: "Authentication required" },
};

function adjust(cookie: string, productId: string, body: object) {
	return request(createApp())
		.post(`/products/${productId}/stock-adjustments`)
		.set("Cookie", cookie)
		.send(body);
}

async function softDelete(productId: string) {
	await db
		.update(products)
		.set({ deletedAt: new Date() })
		.where(eq(products.id, productId));
}

describe("POST /products/:id/stock-adjustments", () => {
	it.each([
		["in", 5, 30],
		["out", 3, 22],
		["out", 25, 0],
	] as const)(
		"applies %s %i and returns 201 with the movement",
		async (direction, quantity, expectedStock) => {
			const camP = await findProduct("Acme", "CAM-P");
			const admin = await findUser("admin@acme.test");

			const response = await adjust(acmeAdmin, camP.id, {
				direction,
				quantity,
				reason: "  Physical count  ",
			});

			expect(response.status).toBe(201);
			const stored = await movementsOf(camP.id);
			const created = stored.find((row) => row.id === response.body.id);
			expect(response.body).toEqual({
				id: created?.id,
				direction,
				quantity,
				stockAfter: expectedStock,
				source: "adjustment",
				reason: "Physical count",
				createdAt: created?.createdAt.toISOString(),
				user: { id: admin.id, email: "admin@acme.test" },
			});
			expect((await findProduct("Acme", "CAM-P")).stock).toBe(expectedStock);
			expect(stored).toHaveLength(2);
		},
	);

	it("returns 409 Insufficient stock for an out above the stock and changes nothing", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await adjust(acmeAdmin, camP.id, {
			direction: "out",
			quantity: 26,
			reason: "Too many",
		});

		expect(response.status).toBe(409);
		expect(response.body).toEqual({
			error: {
				code: "CONFLICT",
				message: "Insufficient stock for CAM-P (available: 25, requested: 26)",
			},
		});
		expect((await findProduct("Acme", "CAM-P")).stock).toBe(25);
		expect(await movementsOf(camP.id)).toHaveLength(1);
	});

	it("returns 409 for an in above the maximum and changes nothing", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const atMax = await adjust(acmeAdmin, camP.id, {
			direction: "in",
			quantity: 999_975,
			reason: "Fill up",
		});
		const above = await adjust(acmeAdmin, camP.id, {
			direction: "in",
			quantity: 1,
			reason: "One more",
		});

		expect(atMax.status).toBe(201);
		expect(atMax.body.stockAfter).toBe(1_000_000);
		expect(above.status).toBe(409);
		expect(above.body).toEqual({
			error: { code: "CONFLICT", message: "Stock cannot exceed 1000000" },
		});
		expect((await findProduct("Acme", "CAM-P")).stock).toBe(1_000_000);
		expect(await movementsOf(camP.id)).toHaveLength(2);
	});

	it("returns 403 for an operator and changes nothing", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await adjust(acmeOperator, camP.id, {
			direction: "in",
			quantity: 1,
			reason: "Operator",
		});

		expect(response.status).toBe(403);
		expect(response.body.error.code).toBe("FORBIDDEN");
		expect((await findProduct("Acme", "CAM-P")).stock).toBe(25);
	});

	it("returns 401 without a cookie or with an invalid token", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		const body = { direction: "in", quantity: 1, reason: "Anon" };

		const noCookie = await request(createApp())
			.post(`/products/${camP.id}/stock-adjustments`)
			.send(body);
		const invalid = await adjust(
			"access_token=invalid.token.value",
			camP.id,
			body,
		);

		expect(noCookie.status).toBe(401);
		expect(noCookie.body).toEqual(unauthorizedBody);
		expect(invalid.status).toBe(401);
		expect(invalid.body).toEqual(unauthorizedBody);
	});

	it("returns 404 for a product of another tenant and leaves its stock unchanged", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		const response = await adjust(acmeAdmin, globexCamP.id, {
			direction: "out",
			quantity: 1,
			reason: "Cross tenant",
		});

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
		expect((await findProduct("Globex", "CAM-P")).stock).toBe(10);
		expect(await movementsOf(globexCamP.id)).toHaveLength(1);
	});

	it("returns 404 for a soft-deleted product", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		await softDelete(camP.id);

		const response = await adjust(acmeAdmin, camP.id, {
			direction: "in",
			quantity: 1,
			reason: "Deleted",
		});

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
		expect((await findProduct("Acme", "CAM-P")).stock).toBe(25);
	});

	it("returns 404 for an unknown id and for an id that is not a uuid", async () => {
		const body = { direction: "in", quantity: 1, reason: "Missing" };

		const unknown = await adjust(
			acmeAdmin,
			"0190a8e2-0000-7000-8000-000000000000",
			body,
		);
		const notUuid = await adjust(acmeAdmin, "not-a-uuid", body);

		expect(unknown.status).toBe(404);
		expect(unknown.body).toEqual(notFoundBody);
		expect(notUuid.status).toBe(404);
		expect(notUuid.body).toEqual(notFoundBody);
	});

	it("ignores tenantId, userId and source sent in the body", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		const globexAdmin = await findUser("admin@globex.test");

		const response = await adjust(acmeAdmin, camP.id, {
			direction: "in",
			quantity: 1,
			reason: "Spoof",
			tenantId: globexAdmin.tenantId,
			userId: globexAdmin.id,
			source: "sale",
		});

		expect(response.status).toBe(201);
		expect(response.body.source).toBe("adjustment");
		expect(response.body.user.email).toBe("admin@acme.test");
	});

	const valid = { direction: "out", quantity: 1, reason: "Damaged" };

	it.each([
		["missing direction", { direction: undefined }],
		["invalid direction", { direction: "sideways" }],
		["missing quantity", { quantity: undefined }],
		["quantity 0", { quantity: 0 }],
		["negative quantity", { quantity: -1 }],
		["non-integer quantity", { quantity: 1.5 }],
		["quantity above the maximum", { quantity: 1_000_001 }],
		["quantity as a string", { quantity: "1" }],
		["missing reason", { reason: undefined }],
		["empty reason", { reason: "" }],
		["blank reason", { reason: "   " }],
		["reason longer than 500", { reason: "x".repeat(501) }],
	])("returns 400 for %s and changes nothing", async (_label, override) => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await adjust(acmeAdmin, camP.id, {
			...valid,
			...override,
		});

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
		expect((await findProduct("Acme", "CAM-P")).stock).toBe(25);
	});

	it("accepts a reason of 500 characters", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await adjust(acmeAdmin, camP.id, {
			...valid,
			reason: "x".repeat(500),
		});

		expect(response.status).toBe(201);
	});
});

function history(cookie: string, productId: string, query = "") {
	return request(createApp())
		.get(`/products/${productId}/stock-movements${query}`)
		.set("Cookie", cookie);
}

describe("GET /products/:id/stock-movements", () => {
	async function adjustCamP(changes: [string, number][]) {
		const camP = await findProduct("Acme", "CAM-P");
		for (const [direction, quantity] of changes) {
			await adjust(acmeAdmin, camP.id, {
				direction,
				quantity,
				reason: `${direction} ${quantity}`,
			}).expect(201);
		}
		return camP;
	}

	it("returns the movements newest first with the movement shape and default meta", async () => {
		const camP = await adjustCamP([
			["in", 5],
			["out", 10],
			["in", 1],
		]);
		const admin = await findUser("admin@acme.test");

		const response = await history(acmeAdmin, camP.id);

		expect(response.status).toBe(200);
		expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 4 });
		expect(
			response.body.data.map(
				(movement: {
					direction: string;
					quantity: number;
					stockAfter: number;
					source: string;
				}) => [
					movement.source,
					movement.direction,
					movement.quantity,
					movement.stockAfter,
				],
			),
		).toEqual([
			["adjustment", "in", 1, 21],
			["adjustment", "out", 10, 20],
			["adjustment", "in", 5, 30],
			["initial", "in", 25, 25],
		]);
		const [initial] = await db
			.select()
			.from(stockMovements)
			.where(
				and(
					eq(stockMovements.productId, camP.id),
					eq(stockMovements.source, "initial"),
				),
			);
		expect(response.body.data[3]).toEqual({
			id: initial?.id,
			direction: "in",
			quantity: 25,
			stockAfter: 25,
			source: "initial",
			reason: null,
			createdAt: initial?.createdAt.toISOString(),
			user: { id: admin.id, email: "admin@acme.test" },
		});
	});

	it("keeps the latest stockAfter equal to the product stock", async () => {
		const camP = await adjustCamP([
			["out", 7],
			["in", 2],
		]);

		const response = await history(acmeAdmin, camP.id);

		expect(response.body.data[0].stockAfter).toBe(20);
		expect((await findProduct("Acme", "CAM-P")).stock).toBe(20);
	});

	it("orders movements with the same createdAt by id, newest first", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		const admin = await findUser("admin@acme.test");
		const createdAt = new Date("2030-01-01T00:00:00Z");
		const inserted = await db
			.insert(stockMovements)
			.values(
				[1, 2].map((quantity) => ({
					tenantId: camP.tenantId,
					productId: camP.id,
					userId: admin.id,
					direction: "in" as const,
					source: "adjustment" as const,
					quantity,
					stockAfter: 25 + quantity,
					reason: "Same instant",
					createdAt,
				})),
			)
			.returning({ id: stockMovements.id });
		const expected = inserted
			.map((row) => row.id)
			.sort()
			.reverse();

		const response = await history(acmeAdmin, camP.id, "?limit=2");

		expect(
			response.body.data.map((movement: { id: string }) => movement.id),
		).toEqual(expected);
	});

	it("paginates with page and limit and reports the total", async () => {
		const camP = await adjustCamP([
			["in", 1],
			["in", 2],
			["in", 3],
			["in", 4],
		]);

		const first = await history(acmeAdmin, camP.id, "?page=1&limit=2");
		const second = await history(acmeAdmin, camP.id, "?page=2&limit=2");
		const third = await history(acmeAdmin, camP.id, "?page=3&limit=2");

		const quantities = (response: request.Response) =>
			response.body.data.map(
				(movement: { quantity: number }) => movement.quantity,
			);
		expect(quantities(first)).toEqual([4, 3]);
		expect(quantities(second)).toEqual([2, 1]);
		expect(quantities(third)).toEqual([25]);
		expect(second.body.meta).toEqual({ page: 2, limit: 2, total: 5 });
	});

	it("returns an empty page with the real total past the end", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await history(acmeAdmin, camP.id, "?page=3&limit=1");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			data: [],
			meta: { page: 3, limit: 1, total: 1 },
		});
	});

	it("accepts limit 100 and page 1 as boundaries", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await history(acmeAdmin, camP.id, "?page=1&limit=100");

		expect(response.status).toBe(200);
		expect(response.body.meta).toEqual({ page: 1, limit: 100, total: 1 });
	});

	it.each([
		["page=0"],
		["page=-1"],
		["page=1.5"],
		["page=abc"],
		["limit=0"],
		["limit=101"],
		["limit=2.5"],
		["page=1&page=2"],
	])("returns 400 for %s", async (query) => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await history(acmeAdmin, camP.id, `?${query}`);

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("is allowed for operators", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await history(acmeOperator, camP.id);

		expect(response.status).toBe(200);
		expect(response.body.meta.total).toBe(1);
	});

	it("still shows the user of a movement after that user is soft deleted", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		const admin = await findUser("admin@acme.test");
		await db
			.update(users)
			.set({ deletedAt: new Date() })
			.where(eq(users.id, admin.id));

		const response = await history(acmeOperator, camP.id);

		expect(response.status).toBe(200);
		expect(response.body.data[0].user).toEqual({
			id: admin.id,
			email: "admin@acme.test",
		});
	});

	it("returns 401 without a cookie or with an invalid token", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const noCookie = await request(createApp()).get(
			`/products/${camP.id}/stock-movements`,
		);
		const invalid = await history("access_token=invalid.token.value", camP.id);

		expect(noCookie.status).toBe(401);
		expect(noCookie.body).toEqual(unauthorizedBody);
		expect(invalid.status).toBe(401);
		expect(invalid.body).toEqual(unauthorizedBody);
	});

	it("returns 404 for a product of another tenant", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		const response = await history(acmeAdmin, globexCamP.id);

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("returns 404 for a soft-deleted product", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		await softDelete(camP.id);

		const response = await history(acmeAdmin, camP.id);

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("returns 404 for an unknown id and for an id that is not a uuid", async () => {
		const unknown = await history(
			acmeAdmin,
			"0190a8e2-0000-7000-8000-000000000000",
		);
		const notUuid = await history(acmeAdmin, "not-a-uuid");

		expect(unknown.status).toBe(404);
		expect(unknown.body).toEqual(notFoundBody);
		expect(notUuid.status).toBe(404);
		expect(notUuid.body).toEqual(notFoundBody);
	});
});
