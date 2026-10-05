import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { saleSchema } from "../../http/controllers/sales.validation.js";
import { db } from "../../infra/db.js";
import { signAccessToken } from "../../infra/jwt.js";
import { products } from "../../infra/schemas/products.js";
import { saleItems, sales } from "../../infra/schemas/sales.js";
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

async function stockOf(tenant: string, sku: string): Promise<number> {
	return (await findProduct(tenant, sku)).stock;
}

type Item = { productId: string; quantity: number };

function sell(cookie: string, items: Item[], key: string = randomUUID()) {
	return request(createApp())
		.post("/sales")
		.set("Cookie", cookie)
		.set("Idempotency-Key", key)
		.send({ items });
}

let acmeAdmin: string;
let acmeOperator: string;
let camP: Awaited<ReturnType<typeof findProduct>>;
let bon: Awaited<ReturnType<typeof findProduct>>;

// Goes through the adjustment endpoint so the ledger keeps explaining the stock.
async function restock(productId: string, quantity: number) {
	await request(createApp())
		.post(`/products/${productId}/stock-adjustments`)
		.set("Cookie", acmeAdmin)
		.send({ direction: "in", quantity, reason: "Restock" })
		.expect(201);
}

async function snapshot() {
	return {
		stock: await db
			.select({ id: products.id, stock: products.stock })
			.from(products)
			.orderBy(asc(products.id)),
		sales: await db.select().from(sales),
		saleItems: await db.select().from(saleItems),
		movements: await db.select().from(stockMovements),
	};
}

function saleMovementsOf(productId: string) {
	return db
		.select()
		.from(stockMovements)
		.where(
			and(
				eq(stockMovements.productId, productId),
				eq(stockMovements.source, "sale"),
			),
		);
}

function byProductId<T extends { productId: string }>(items: T[]): T[] {
	return items.toSorted((a, b) => (a.productId < b.productId ? -1 : 1));
}

beforeEach(async () => {
	await seed(db);
	acmeAdmin = await cookieFor("admin@acme.test");
	acmeOperator = await cookieFor("operator@acme.test");
	camP = await findProduct("Acme", "CAM-P");
	bon = await findProduct("Acme", "BON-01");
});

const notFoundBody = {
	error: { code: "NOT_FOUND", message: "One or more products were not found" },
};

describe("POST /sales", () => {
	it("creates the sale, decrements stock and records one sale movement per item", async () => {
		await restock(bon.id, 3);
		const operator = await findUser("operator@acme.test");

		const response = await sell(acmeOperator, [
			{ productId: camP.id, quantity: 2 },
			{ productId: bon.id, quantity: 1 },
		]);

		expect(response.status).toBe(201);
		saleSchema.parse(response.body);
		expect(response.headers["idempotent-replayed"]).toBeUndefined();
		const [stored] = await db.select().from(sales);
		expect(response.body).toEqual({
			id: stored?.id,
			items: byProductId([
				{
					productId: camP.id,
					sku: "CAM-P",
					name: "Camiseta P",
					quantity: 2,
					unitPriceCents: 4990,
				},
				{
					productId: bon.id,
					sku: "BON-01",
					name: "Boné",
					quantity: 1,
					unitPriceCents: 2990,
				},
			]),
			totalCents: 2 * 4990 + 2990,
			createdAt: stored?.createdAt.toISOString(),
			user: { id: operator.id, email: "operator@acme.test" },
		});
		expect(await stockOf("Acme", "CAM-P")).toBe(23);
		expect(await stockOf("Acme", "BON-01")).toBe(2);

		for (const [productId, quantity, stockAfter] of [
			[camP.id, 2, 23],
			[bon.id, 1, 2],
		] as const) {
			expect(await saleMovementsOf(productId)).toEqual([
				expect.objectContaining({
					tenantId: camP.tenantId,
					direction: "out",
					quantity,
					stockAfter,
					reason: null,
					saleId: stored?.id,
					userId: operator.id,
				}),
			]);
		}
		expect(
			(await db.select().from(saleItems)).map(
				({ productId, quantity, unitPriceCents, tenantId, saleId }) => ({
					productId,
					quantity,
					unitPriceCents,
					tenantId,
					saleId,
				}),
			),
		).toEqual(
			expect.arrayContaining([
				{
					productId: camP.id,
					quantity: 2,
					unitPriceCents: 4990,
					tenantId: camP.tenantId,
					saleId: stored?.id,
				},
				{
					productId: bon.id,
					quantity: 1,
					unitPriceCents: 2990,
					tenantId: camP.tenantId,
					saleId: stored?.id,
				},
			]),
		);
	});

	it("is allowed for admins", async () => {
		const response = await sell(acmeAdmin, [
			{ productId: camP.id, quantity: 1 },
		]);

		expect(response.status).toBe(201);
		expect(response.body.user.email).toBe("admin@acme.test");
		expect(await stockOf("Acme", "CAM-P")).toBe(24);
	});

	it("accepts a quantity equal to the stock and leaves stock 0", async () => {
		const response = await sell(acmeOperator, [
			{ productId: camP.id, quantity: 25 },
		]);

		expect(response.status).toBe(201);
		expect(await stockOf("Acme", "CAM-P")).toBe(0);
	});

	it("ignores tenantId and userId sent in the body", async () => {
		const globexAdmin = await findUser("admin@globex.test");

		const response = await request(createApp())
			.post("/sales")
			.set("Cookie", acmeOperator)
			.set("Idempotency-Key", randomUUID())
			.send({
				items: [{ productId: camP.id, quantity: 1 }],
				tenantId: globexAdmin.tenantId,
				userId: globexAdmin.id,
			});

		expect(response.status).toBe(201);
		expect(response.body.user.email).toBe("operator@acme.test");
		const [stored] = await db.select().from(sales);
		expect(stored?.tenantId).toBe(camP.tenantId);
	});

	it("returns 401 without a cookie or with an invalid token and changes nothing", async () => {
		const before = await snapshot();

		const noCookie = await request(createApp())
			.post("/sales")
			.set("Idempotency-Key", randomUUID())
			.send({ items: [{ productId: camP.id, quantity: 1 }] });
		const invalid = await sell("access_token=invalid.token.value", [
			{ productId: camP.id, quantity: 1 },
		]);

		for (const response of [noCookie, invalid]) {
			expect(response.status).toBe(401);
			expect(response.body).toEqual({
				error: { code: "UNAUTHORIZED", message: "Authentication required" },
			});
		}
		expect(await snapshot()).toEqual(before);
	});
});

describe("all-or-nothing", () => {
	it("returns 409 naming only the short item and changes nothing", async () => {
		const before = await snapshot();

		const response = await sell(acmeOperator, [
			{ productId: camP.id, quantity: 2 },
			{ productId: bon.id, quantity: 1 },
		]);

		expect(response.status).toBe(409);
		expect(response.body).toEqual({
			error: {
				code: "CONFLICT",
				message: "Insufficient stock for BON-01 (available: 0, requested: 1)",
			},
		});
		expect(await snapshot()).toEqual(before);
	});

	it("lists every short item ordered by productId", async () => {
		const before = await snapshot();

		const response = await sell(acmeOperator, [
			{ productId: camP.id, quantity: 26 },
			{ productId: bon.id, quantity: 3 },
		]);

		const details = byProductId([
			{ productId: camP.id, text: "CAM-P (available: 25, requested: 26)" },
			{ productId: bon.id, text: "BON-01 (available: 0, requested: 3)" },
		]).map((item) => item.text);
		expect(response.status).toBe(409);
		expect(response.body).toEqual({
			error: {
				code: "CONFLICT",
				message: `Insufficient stock for ${details.join(", ")}`,
			},
		});
		expect(await snapshot()).toEqual(before);
	});

	it.each([
		["missing", async () => "0190a8e2-0000-7000-8000-000000000000"],
		[
			"soft-deleted",
			async () => {
				await restock(bon.id, 5);
				await db
					.update(products)
					.set({ deletedAt: new Date() })
					.where(eq(products.id, bon.id));
				return bon.id;
			},
		],
		["other-tenant", async () => (await findProduct("Globex", "CAN-01")).id],
	])(
		"returns 404 for a %s product and changes nothing",
		async (_label, setup) => {
			const productId = await setup();
			const before = await snapshot();

			const response = await sell(acmeOperator, [
				{ productId: camP.id, quantity: 1 },
				{ productId, quantity: 1 },
			]);

			expect(response.status).toBe(404);
			expect(response.body).toEqual(notFoundBody);
			expect(await snapshot()).toEqual(before);
		},
	);

	it("returns 404 when one product is missing and another is short", async () => {
		const before = await snapshot();

		const response = await sell(acmeOperator, [
			{ productId: bon.id, quantity: 1 },
			{ productId: "0190a8e2-0000-7000-8000-000000000000", quantity: 1 },
		]);

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
		expect(await snapshot()).toEqual(before);
	});
});

describe("validation", () => {
	it.each([
		["missing items", () => ({})],
		["empty items", () => ({ items: [] })],
		[
			"more than 100 items",
			() => ({
				items: Array.from({ length: 101 }, () => ({
					productId: randomUUID(),
					quantity: 1,
				})),
			}),
		],
		["quantity 0", () => ({ items: [{ productId: camP.id, quantity: 0 }] })],
		[
			"negative quantity",
			() => ({ items: [{ productId: camP.id, quantity: -1 }] }),
		],
		[
			"non-integer quantity",
			() => ({ items: [{ productId: camP.id, quantity: 1.5 }] }),
		],
		[
			"quantity above 1,000,000",
			() => ({ items: [{ productId: camP.id, quantity: 1_000_001 }] }),
		],
		[
			"duplicate productId",
			() => ({
				items: [
					{ productId: camP.id, quantity: 1 },
					{ productId: camP.id, quantity: 2 },
				],
			}),
		],
		[
			"duplicate productId in another case",
			() => ({
				items: [
					{ productId: camP.id, quantity: 1 },
					{ productId: camP.id.toUpperCase(), quantity: 2 },
				],
			}),
		],
		[
			"non-uuid productId",
			() => ({ items: [{ productId: "not-a-uuid", quantity: 1 }] }),
		],
	])("returns 400 for %s and changes nothing", async (_label, body) => {
		const before = await snapshot();

		const response = await request(createApp())
			.post("/sales")
			.set("Cookie", acmeOperator)
			.set("Idempotency-Key", randomUUID())
			.send(body());

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
		expect(await snapshot()).toEqual(before);
	});

	it("accepts 100 items past validation", async () => {
		const response = await request(createApp())
			.post("/sales")
			.set("Cookie", acmeOperator)
			.set("Idempotency-Key", randomUUID())
			.send({
				items: Array.from({ length: 100 }, () => ({
					productId: randomUUID(),
					quantity: 1,
				})),
			});

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it.each([
		["missing", undefined],
		["not a uuid", "abc"],
	])(
		"returns 400 when the Idempotency-Key header is %s",
		async (_label, key) => {
			const before = await snapshot();
			const req = request(createApp())
				.post("/sales")
				.set("Cookie", acmeOperator);
			if (key !== undefined) req.set("Idempotency-Key", key);

			const response = await req.send({
				items: [{ productId: camP.id, quantity: 1 }],
			});

			expect(response.status).toBe(400);
			expect(response.body.error.code).toBe("VALIDATION_ERROR");
			expect(await snapshot()).toEqual(before);
		},
	);
});

describe("concurrency", () => {
	it("sells exactly the available stock under 10 parallel sales", async () => {
		await restock(bon.id, 5);

		const responses = await Promise.all(
			Array.from({ length: 10 }, () =>
				sell(acmeOperator, [{ productId: bon.id, quantity: 1 }]),
			),
		);

		const statuses = responses.map((response) => response.status);
		expect(statuses.filter((status) => status === 201)).toHaveLength(5);
		expect(statuses.filter((status) => status === 409)).toHaveLength(5);
		expect(await stockOf("Acme", "BON-01")).toBe(0);
		expect(await saleMovementsOf(bon.id)).toHaveLength(5);
		const history = await request(createApp())
			.get(`/products/${bon.id}/stock-movements`)
			.set("Cookie", acmeOperator);
		expect(
			history.body.data.map(
				(movement: { source: string; stockAfter: number }) => [
					movement.source,
					movement.stockAfter,
				],
			),
		).toEqual([
			["sale", 0],
			["sale", 1],
			["sale", 2],
			["sale", 3],
			["sale", 4],
			["adjustment", 5],
			["initial", 0],
		]);
	}, 15_000);

	it("does not deadlock sales of A+B and B+A running in parallel", async () => {
		await restock(bon.id, 10);

		for (let round = 0; round < 5; round++) {
			const responses = await Promise.all([
				sell(acmeOperator, [
					{ productId: camP.id, quantity: 1 },
					{ productId: bon.id, quantity: 1 },
				]),
				sell(acmeOperator, [
					{ productId: bon.id, quantity: 1 },
					{ productId: camP.id, quantity: 1 },
				]),
			]);
			expect(responses.map((response) => response.status)).toEqual([201, 201]);
		}
		expect(await stockOf("Acme", "CAM-P")).toBe(15);
		expect(await stockOf("Acme", "BON-01")).toBe(0);
	}, 15_000);
});

describe("idempotency", () => {
	it("replays the original sale for the same key and items", async () => {
		const key = randomUUID();
		const items = [{ productId: camP.id, quantity: 2 }];

		const first = await sell(acmeOperator, items, key);
		const replay = await sell(acmeOperator, items, key);

		expect(first.status).toBe(201);
		expect(replay.status).toBe(201);
		expect(replay.headers["idempotent-replayed"]).toBe("true");
		saleSchema.parse(replay.body);
		expect(replay.body).toEqual(first.body);
		expect(await stockOf("Acme", "CAM-P")).toBe(23);
		expect(await db.select().from(sales)).toHaveLength(1);
		expect(await saleMovementsOf(camP.id)).toHaveLength(1);
	});

	it("creates one sale when the same key is sent in parallel", async () => {
		const key = randomUUID();
		const items = [{ productId: camP.id, quantity: 1 }];

		const responses = await Promise.all(
			Array.from({ length: 5 }, () => sell(acmeOperator, items, key)),
		);

		expect(responses.map((response) => response.status)).toEqual(
			Array(5).fill(201),
		);
		const ids = new Set(responses.map((response) => response.body.id));
		expect(ids.size).toBe(1);
		expect(
			responses.filter(
				(response) => response.headers["idempotent-replayed"] === "true",
			),
		).toHaveLength(4);
		expect(await db.select().from(sales)).toHaveLength(1);
		expect(await stockOf("Acme", "CAM-P")).toBe(24);
		expect(await saleMovementsOf(camP.id)).toHaveLength(1);
	});

	it("treats the same items in another order as a replay", async () => {
		await restock(bon.id, 5);
		const key = randomUUID();

		const first = await sell(
			acmeOperator,
			[
				{ productId: camP.id, quantity: 1 },
				{ productId: bon.id, quantity: 2 },
			],
			key,
		);
		const replay = await sell(
			acmeOperator,
			[
				{ productId: bon.id, quantity: 2 },
				{ productId: camP.id.toUpperCase(), quantity: 1 },
			],
			key,
		);

		expect(replay.status).toBe(201);
		expect(replay.headers["idempotent-replayed"]).toBe("true");
		expect(replay.body.id).toBe(first.body.id);
		expect(await stockOf("Acme", "BON-01")).toBe(3);
	});

	it("returns 409 for the same key with different items and changes nothing", async () => {
		const key = randomUUID();
		await sell(acmeOperator, [{ productId: camP.id, quantity: 1 }], key);
		const before = await snapshot();

		const response = await sell(
			acmeOperator,
			[{ productId: camP.id, quantity: 2 }],
			key,
		);

		expect(response.status).toBe(409);
		expect(response.body).toEqual({
			error: {
				code: "CONFLICT",
				message: "Idempotency key was already used with a different request",
			},
		});
		expect(await snapshot()).toEqual(before);
	});

	it("processes a retry again after the key's sale failed and stock was replenished", async () => {
		const key = randomUUID();
		const items = [{ productId: bon.id, quantity: 2 }];

		const failed = await sell(acmeOperator, items, key);
		await restock(bon.id, 2);
		const retry = await sell(acmeOperator, items, key);

		expect(failed.status).toBe(409);
		expect(retry.status).toBe(201);
		expect(retry.headers["idempotent-replayed"]).toBeUndefined();
		expect(await stockOf("Acme", "BON-01")).toBe(0);
	});

	it("creates independent sales for the same key in two tenants", async () => {
		const key = randomUUID();
		const globexCamP = await findProduct("Globex", "CAM-P");
		const globexOperator = await cookieFor("operator@globex.test");

		const acme = await sell(
			acmeOperator,
			[{ productId: camP.id, quantity: 1 }],
			key,
		);
		const globex = await sell(
			globexOperator,
			[{ productId: globexCamP.id, quantity: 1 }],
			key,
		);

		expect(acme.status).toBe(201);
		expect(globex.status).toBe(201);
		expect(globex.headers["idempotent-replayed"]).toBeUndefined();
		expect(globex.body.id).not.toBe(acme.body.id);

		const acmeReplay = await sell(
			acmeOperator,
			[{ productId: camP.id, quantity: 1 }],
			key,
		);
		const globexReplay = await sell(
			globexOperator,
			[{ productId: globexCamP.id, quantity: 1 }],
			key,
		);

		expect(acmeReplay.status).toBe(201);
		expect(acmeReplay.headers["idempotent-replayed"]).toBe("true");
		expect(acmeReplay.body).toEqual(acme.body);
		expect(globexReplay.status).toBe(201);
		expect(globexReplay.headers["idempotent-replayed"]).toBe("true");
		expect(globexReplay.body).toEqual(globex.body);
		expect(await stockOf("Acme", "CAM-P")).toBe(24);
		expect(await stockOf("Globex", "CAM-P")).toBe(9);
	});

	it("replays the original price and total after the product price changed", async () => {
		const key = randomUUID();
		const items = [{ productId: camP.id, quantity: 2 }];
		await sell(acmeOperator, items, key);
		await request(createApp())
			.patch(`/products/${camP.id}`)
			.set("Cookie", acmeAdmin)
			.send({ priceCents: 9999 })
			.expect(200);

		const replay = await sell(acmeOperator, items, key);

		expect(replay.status).toBe(201);
		expect(replay.body.items[0].unitPriceCents).toBe(4990);
		expect(replay.body.totalCents).toBe(9980);
	});

	it("replays a sale after its product was soft deleted", async () => {
		const key = randomUUID();
		const items = [{ productId: camP.id, quantity: 1 }];
		await sell(acmeOperator, items, key);
		await request(createApp())
			.delete(`/products/${camP.id}`)
			.set("Cookie", acmeAdmin)
			.expect(204);

		const replay = await sell(acmeOperator, items, key);

		expect(replay.status).toBe(201);
		expect(replay.headers["idempotent-replayed"]).toBe("true");
		expect(replay.body.items).toEqual([
			{
				productId: camP.id,
				sku: "CAM-P",
				name: "Camiseta P",
				quantity: 1,
				unitPriceCents: 4990,
			},
		]);
	});
});

describe("movement history", () => {
	it("shows the sale movement with its saleId and keeps the ledger equal to the stock", async () => {
		await restock(bon.id, 4);
		const sale = await sell(acmeOperator, [
			{ productId: camP.id, quantity: 3 },
			{ productId: bon.id, quantity: 4 },
		]);

		const history = await request(createApp())
			.get(`/products/${camP.id}/stock-movements`)
			.set("Cookie", acmeOperator);

		expect(history.body.data[0]).toMatchObject({
			source: "sale",
			direction: "out",
			quantity: 3,
			stockAfter: 22,
			reason: null,
			saleId: sale.body.id,
		});
		expect(history.body.data[1]).toMatchObject({
			source: "initial",
			saleId: null,
		});

		for (const product of [camP, bon]) {
			const movements = await db
				.select()
				.from(stockMovements)
				.where(eq(stockMovements.productId, product.id));
			const sum = movements.reduce(
				(total, movement) =>
					total +
					(movement.direction === "in"
						? movement.quantity
						: -movement.quantity),
				0,
			);
			expect(sum).toBe((await findProduct("Acme", product.sku)).stock);
		}
	});
});

describe("database constraints", () => {
	async function rawSale(tenant: string, override: object = {}) {
		const user = await findUser(`admin@${tenant.toLowerCase()}.test`);
		const [sale] = await db
			.insert(sales)
			.values({
				tenantId: user.tenantId,
				userId: user.id,
				idempotencyKey: randomUUID(),
				requestHash: "a".repeat(64),
				...override,
			})
			.returning();
		if (!sale) throw new Error("raw sale not inserted");
		return sale;
	}

	async function rawSaleItem(override: object = {}) {
		const sale = await rawSale("Acme");
		return db.insert(saleItems).values({
			tenantId: sale.tenantId,
			saleId: sale.id,
			productId: camP.id,
			quantity: 1,
			unitPriceCents: 4990,
			...override,
		});
	}

	it("rejects a request_hash that is not 64 characters", async () => {
		await expect(
			rawSale("Acme", { requestHash: "a".repeat(63) }),
		).rejects.toMatchObject({
			cause: { code: "23514", constraint: "sales_request_hash_length" },
		});
	});

	it.each([
		["quantity 0", { quantity: 0 }, "sale_items_quantity_positive"],
		[
			"a negative unit price",
			{ unitPriceCents: -1 },
			"sale_items_unit_price_cents_non_negative",
		],
	])("rejects a sale item with %s", async (_label, override, constraint) => {
		await expect(rawSaleItem(override)).rejects.toMatchObject({
			cause: { code: "23514", constraint },
		});
	});

	it("rejects a second line for the same product in a sale", async () => {
		const sale = await rawSale("Acme");
		const item = {
			tenantId: sale.tenantId,
			saleId: sale.id,
			productId: camP.id,
			quantity: 1,
			unitPriceCents: 4990,
		};
		await db.insert(saleItems).values(item);

		await expect(db.insert(saleItems).values(item)).rejects.toMatchObject({
			cause: {
				code: "23505",
				constraint: "sale_items_sale_id_product_id_unique",
			},
		});
	});

	it("rejects a sale made by a user of another tenant", async () => {
		const globexAdmin = await findUser("admin@globex.test");

		await expect(
			rawSale("Acme", { userId: globexAdmin.id }),
		).rejects.toMatchObject({
			cause: { code: "23503", constraint: "sales_user_fk" },
		});
	});

	it("rejects a sale item pointing to a sale of another tenant", async () => {
		const globexSale = await rawSale("Globex");

		await expect(rawSaleItem({ saleId: globexSale.id })).rejects.toMatchObject({
			cause: { code: "23503", constraint: "sale_items_sale_fk" },
		});
	});

	it("rejects a sale item pointing to a product of another tenant", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		await expect(
			rawSaleItem({ productId: globexCamP.id }),
		).rejects.toMatchObject({
			cause: { code: "23503", constraint: "sale_items_product_fk" },
		});
	});

	it("rejects a movement pointing to a sale of another tenant", async () => {
		const globexSale = await rawSale("Globex");
		const admin = await findUser("admin@acme.test");

		await expect(
			db.insert(stockMovements).values({
				tenantId: camP.tenantId,
				productId: camP.id,
				userId: admin.id,
				direction: "out",
				source: "sale",
				quantity: 1,
				stockAfter: 24,
				reason: null,
				saleId: globexSale.id,
			}),
		).rejects.toMatchObject({
			cause: { code: "23503", constraint: "stock_movements_sale_fk" },
		});
	});
});
