import { and, eq } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { errorResponseSchema } from "../../http/controllers/common.validation.js";
import {
	productListSchema,
	productSchema,
} from "../../http/controllers/products.validation.js";
import { db } from "../../infra/db.js";
import { signAccessToken } from "../../infra/jwt.js";
import { products } from "../../infra/schemas/products.js";
import { tenants } from "../../infra/schemas/tenants.js";
import { users } from "../../infra/schemas/users.js";
import { seed } from "../../infra/seed/seed.js";

const productKeys = [
	"createdAt",
	"id",
	"name",
	"priceCents",
	"sku",
	"stock",
	"updatedAt",
];
const unauthorizedBody = {
	error: { code: "UNAUTHORIZED", message: "Authentication required" },
};
const notFoundBody = {
	error: { code: "NOT_FOUND", message: "Product not found" },
};

async function cookieFor(email: string): Promise<string> {
	const [user] = await db.select().from(users).where(eq(users.email, email));
	if (!user) throw new Error(`user ${email} not seeded`);
	const token = await signAccessToken({
		userId: user.id,
		tenantId: user.tenantId,
		role: user.role,
	});
	return `access_token=${token}`;
}

async function tenantId(name: string): Promise<string> {
	const [tenant] = await db
		.select()
		.from(tenants)
		.where(eq(tenants.name, name));
	if (!tenant) throw new Error(`tenant ${name} not seeded`);
	return tenant.id;
}

async function findProduct(tenant: string, sku: string) {
	const [product] = await db
		.select()
		.from(products)
		.where(
			and(eq(products.tenantId, await tenantId(tenant)), eq(products.sku, sku)),
		);
	if (!product) throw new Error(`product ${sku} of ${tenant} not found`);
	return product;
}

async function insertProducts(
	tenant: string,
	rows: { sku: string; name: string; stock?: number }[],
) {
	const id = await tenantId(tenant);
	return db
		.insert(products)
		.values(
			rows.map((row) => ({ priceCents: 1000, stock: 5, ...row, tenantId: id })),
		)
		.returning();
}

let acmeAdmin: string;
let acmeOperator: string;
let globexAdmin: string;

beforeEach(async () => {
	await seed(db);
	acmeAdmin = await cookieFor("admin@acme.test");
	acmeOperator = await cookieFor("operator@acme.test");
	globexAdmin = await cookieFor("admin@globex.test");
});

function list(cookie: string, query = "") {
	return request(createApp())
		.get(`/api/v1/products${query}`)
		.set("Cookie", cookie);
}

const validProduct = {
	sku: "MUG-01",
	name: "Mug",
	priceCents: 1500,
	stock: 12,
};

function create(cookie: string, body: object) {
	return request(createApp())
		.post("/api/v1/products")
		.set("Cookie", cookie)
		.send(body);
}

function patch(cookie: string, id: string, body: object) {
	return request(createApp())
		.patch(`/api/v1/products/${id}`)
		.set("Cookie", cookie)
		.send(body);
}

function remove(cookie: string, id: string) {
	return request(createApp())
		.delete(`/api/v1/products/${id}`)
		.set("Cookie", cookie);
}

function skus(response: request.Response): string[] {
	return response.body.data.map((product: { sku: string }) => product.sku);
}

describe("GET /products", () => {
	it("returns the tenant's products with the product shape and default meta", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await list(acmeAdmin);

		expect(response.status).toBe(200);
		productListSchema.parse(response.body);
		expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
		expect(skus(response)).toEqual(["BON-01", "CAM-P"]);
		expect(Object.keys(response.body.data[1]).sort()).toEqual(productKeys);
		expect(response.body.data[1]).toEqual({
			id: camP.id,
			sku: "CAM-P",
			name: "Camiseta P",
			priceCents: 4990,
			stock: 25,
			createdAt: camP.createdAt.toISOString(),
			updatedAt: camP.updatedAt.toISOString(),
		});
	});

	it("is allowed for operators", async () => {
		const response = await list(acmeOperator);

		expect(response.status).toBe(200);
		expect(skus(response)).toEqual(["BON-01", "CAM-P"]);
	});

	it("never returns products of another tenant", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		const response = await list(acmeAdmin, "?limit=100");

		expect(response.body.meta.total).toBe(2);
		expect(
			response.body.data.map((product: { id: string }) => product.id),
		).not.toContain(globexCamP.id);
		expect(skus(response)).not.toContain("CAN-01");
	});

	it("ignores a tenantId passed in the query string", async () => {
		const globex = await tenantId("Globex");

		const response = await list(acmeAdmin, `?tenantId=${globex}`);

		expect(response.status).toBe(200);
		expect(skus(response)).toEqual(["BON-01", "CAM-P"]);
	});

	it("excludes soft-deleted products from data and total", async () => {
		await db
			.update(products)
			.set({ deletedAt: new Date() })
			.where(eq(products.id, (await findProduct("Acme", "CAM-P")).id));

		const response = await list(acmeAdmin);

		expect(skus(response)).toEqual(["BON-01"]);
		expect(response.body.meta.total).toBe(1);
	});

	it("paginates with page and limit and reports the filtered total", async () => {
		await insertProducts("Acme", [
			{ sku: "A-1", name: "Apple" },
			{ sku: "D-1", name: "Date" },
			{ sku: "E-1", name: "Elderberry" },
		]);

		const first = await list(acmeAdmin, "?page=1&limit=2");
		const second = await list(acmeAdmin, "?page=2&limit=2");
		const third = await list(acmeAdmin, "?page=3&limit=2");

		expect(skus(first)).toEqual(["A-1", "BON-01"]);
		expect(skus(second)).toEqual(["CAM-P", "D-1"]);
		expect(skus(third)).toEqual(["E-1"]);
		expect(second.body.meta).toEqual({ page: 2, limit: 2, total: 5 });
	});

	it("returns an empty page with the real total past the end", async () => {
		const response = await list(acmeAdmin, "?page=5&limit=2");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			data: [],
			meta: { page: 5, limit: 2, total: 2 },
		});
	});

	it("accepts limit 100 and page 1 as boundaries", async () => {
		const response = await list(acmeAdmin, "?page=1&limit=100");

		expect(response.status).toBe(200);
		expect(response.body.meta).toEqual({ page: 1, limit: 100, total: 2 });
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
		const response = await list(acmeAdmin, `?${query}`);

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("orders by name, then by id for equal names", async () => {
		const inserted = await insertProducts("Acme", [
			{ sku: "SAME-2", name: "Same" },
			{ sku: "SAME-1", name: "Same" },
			{ sku: "AAA", name: "Aaa" },
		]);
		const sameIds = inserted
			.filter((product) => product.name === "Same")
			.map((product) => product.id)
			.sort();

		const response = await list(acmeAdmin);

		expect(
			response.body.data.map((product: { name: string }) => product.name),
		).toEqual(["Aaa", "Boné", "Camiseta P", "Same", "Same"]);
		expect(
			response.body.data.slice(3).map((product: { id: string }) => product.id),
		).toEqual(sameIds);
	});

	describe("search", () => {
		it("matches the name case-insensitively", async () => {
			const response = await list(acmeAdmin, "?search=CAMISETA");

			expect(skus(response)).toEqual(["CAM-P"]);
			expect(response.body.meta.total).toBe(1);
		});

		it("matches the SKU case-insensitively", async () => {
			const response = await list(acmeAdmin, "?search=bon-");

			expect(skus(response)).toEqual(["BON-01"]);
		});

		it("matches a substring in the middle of the name", async () => {
			const response = await list(acmeAdmin, "?search=iseta");

			expect(skus(response)).toEqual(["CAM-P"]);
		});

		it("trims the term", async () => {
			const response = await list(acmeAdmin, "?search=%20camiseta%20");

			expect(skus(response)).toEqual(["CAM-P"]);
		});

		it("ignores an empty or blank term", async () => {
			const empty = await list(acmeAdmin, "?search=");
			const blank = await list(acmeAdmin, "?search=%20%20");

			expect(skus(empty)).toEqual(["BON-01", "CAM-P"]);
			expect(skus(blank)).toEqual(["BON-01", "CAM-P"]);
		});

		it("matches % literally", async () => {
			await insertProducts("Acme", [{ sku: "PCT", name: "100% cotton" }]);

			const response = await list(acmeAdmin, "?search=%25");

			expect(skus(response)).toEqual(["PCT"]);
			expect(response.body.meta.total).toBe(1);
		});

		it("matches _ literally", async () => {
			await insertProducts("Acme", [{ sku: "UND_1", name: "Underscore" }]);

			const response = await list(acmeAdmin, "?search=_");

			expect(skus(response)).toEqual(["UND_1"]);
		});

		it("matches \\ literally", async () => {
			await insertProducts("Acme", [{ sku: "BSL", name: "Back\\slash" }]);

			const response = await list(acmeAdmin, "?search=%5C");

			expect(skus(response)).toEqual(["BSL"]);
		});

		it("does not match products of another tenant", async () => {
			const response = await list(acmeAdmin, "?search=caneca");

			expect(response.body).toEqual({
				data: [],
				meta: { page: 1, limit: 20, total: 0 },
			});
		});

		it("accepts 100 characters and returns 400 above", async () => {
			const ok = await list(acmeAdmin, `?search=${"a".repeat(100)}`);
			const tooLong = await list(acmeAdmin, `?search=${"a".repeat(101)}`);

			expect(ok.status).toBe(200);
			expect(tooLong.status).toBe(400);
			expect(tooLong.body.error.code).toBe("VALIDATION_ERROR");
		});
	});

	describe("outOfStock", () => {
		it("returns only products with stock 0 when true", async () => {
			const response = await list(acmeAdmin, "?outOfStock=true");

			expect(skus(response)).toEqual(["BON-01"]);
			expect(response.body.meta.total).toBe(1);
		});

		it("returns only products with stock above 0 when false", async () => {
			const response = await list(acmeAdmin, "?outOfStock=false");

			expect(skus(response)).toEqual(["CAM-P"]);
			expect(response.body.meta.total).toBe(1);
		});

		it("combines with search", async () => {
			const response = await list(
				acmeAdmin,
				"?outOfStock=true&search=camiseta",
			);

			expect(response.body).toEqual({
				data: [],
				meta: { page: 1, limit: 20, total: 0 },
			});
		});

		it.each([["yes"], ["1"], ["TRUE"], [""]])(
			"returns 400 for outOfStock=%s",
			async (value) => {
				const response = await list(acmeAdmin, `?outOfStock=${value}`);

				expect(response.status).toBe(400);
				expect(response.body.error.code).toBe("VALIDATION_ERROR");
			},
		);
	});
});

describe("GET /products/:id", () => {
	it("returns the product to an admin", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await request(createApp())
			.get(`/api/v1/products/${camP.id}`)
			.set("Cookie", acmeAdmin);

		expect(response.status).toBe(200);
		productSchema.parse(response.body);
		expect(response.body).toEqual({
			id: camP.id,
			sku: "CAM-P",
			name: "Camiseta P",
			priceCents: 4990,
			stock: 25,
			createdAt: camP.createdAt.toISOString(),
			updatedAt: camP.updatedAt.toISOString(),
		});
	});

	it("returns the product to an operator", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await request(createApp())
			.get(`/api/v1/products/${camP.id}`)
			.set("Cookie", acmeOperator);

		expect(response.status).toBe(200);
		expect(response.body.id).toBe(camP.id);
	});

	it("returns 404 for a product of another tenant", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		const response = await request(createApp())
			.get(`/api/v1/products/${globexCamP.id}`)
			.set("Cookie", acmeAdmin);

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("returns 404 for a soft-deleted product", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		await db
			.update(products)
			.set({ deletedAt: new Date() })
			.where(eq(products.id, camP.id));

		const response = await request(createApp())
			.get(`/api/v1/products/${camP.id}`)
			.set("Cookie", acmeAdmin);

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("returns 404 for an unknown id", async () => {
		const response = await request(createApp())
			.get("/api/v1/products/0190a8e2-0000-7000-8000-000000000000")
			.set("Cookie", acmeAdmin);

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("returns 404 for an id that is not a uuid", async () => {
		const response = await request(createApp())
			.get("/api/v1/products/not-a-uuid")
			.set("Cookie", acmeAdmin);

		expect(response.status).toBe(404);
		errorResponseSchema.parse(response.body);
		expect(response.body).toEqual(notFoundBody);
	});
});

describe("POST /products", () => {
	it("creates the product and returns 201 with the product shape", async () => {
		const response = await create(acmeAdmin, validProduct);

		expect(response.status).toBe(201);
		productSchema.parse(response.body);
		expect(Object.keys(response.body).sort()).toEqual(productKeys);
		expect(response.body).toMatchObject(validProduct);
		const stored = await findProduct("Acme", "MUG-01");
		expect(response.body).toEqual({
			id: stored.id,
			...validProduct,
			createdAt: stored.createdAt.toISOString(),
			updatedAt: stored.updatedAt.toISOString(),
		});
		expect(stored.tenantId).toBe(await tenantId("Acme"));
	});

	it("stores the SKU trimmed and uppercased", async () => {
		const response = await create(acmeAdmin, {
			...validProduct,
			sku: "  mug-01.b_x ",
		});

		expect(response.status).toBe(201);
		expect(response.body.sku).toBe("MUG-01.B_X");
		expect((await findProduct("Acme", "MUG-01.B_X")).sku).toBe("MUG-01.B_X");
	});

	it("trims the name", async () => {
		const response = await create(acmeAdmin, {
			...validProduct,
			name: "  Mug  ",
		});

		expect(response.body.name).toBe("Mug");
	});

	it("accepts price 0, stock 0 and the maximums", async () => {
		const free = await create(acmeAdmin, {
			...validProduct,
			sku: "FREE",
			priceCents: 0,
			stock: 0,
		});
		const max = await create(acmeAdmin, {
			...validProduct,
			sku: "MAX",
			name: "x".repeat(200),
			priceCents: 100_000_000,
			stock: 1_000_000,
		});
		const longSku = await create(acmeAdmin, {
			...validProduct,
			sku: "S".repeat(64),
		});

		expect(free.status).toBe(201);
		expect(max.status).toBe(201);
		expect(longSku.status).toBe(201);
	});

	it("ignores a tenantId sent in the body", async () => {
		const globex = await tenantId("Globex");

		const response = await create(acmeAdmin, {
			...validProduct,
			tenantId: globex,
		});

		expect(response.status).toBe(201);
		expect((await findProduct("Acme", "MUG-01")).tenantId).toBe(
			await tenantId("Acme"),
		);
	});

	it("returns 409 for a SKU already used in the tenant", async () => {
		const response = await create(acmeAdmin, { ...validProduct, sku: "CAM-P" });

		expect(response.status).toBe(409);
		errorResponseSchema.parse(response.body);
		expect(response.body).toEqual({
			error: {
				code: "CONFLICT",
				message: "A product with SKU CAM-P already exists",
			},
		});
	});

	it("returns 409 when only the case differs", async () => {
		const response = await create(acmeAdmin, {
			...validProduct,
			sku: " cam-p ",
		});

		expect(response.status).toBe(409);
		expect(response.body.error.code).toBe("CONFLICT");
	});

	it("allows a SKU that another tenant already uses", async () => {
		const response = await create(globexAdmin, {
			...validProduct,
			sku: "BON-01",
		});

		expect(response.status).toBe(201);
		expect(response.body.sku).toBe("BON-01");
		expect((await findProduct("Globex", "BON-01")).id).toBe(response.body.id);
	});

	it("returns 403 for an operator", async () => {
		const response = await create(acmeOperator, validProduct);

		expect(response.status).toBe(403);
		errorResponseSchema.parse(response.body);
		expect(response.body.error.code).toBe("FORBIDDEN");
		const rows = await db
			.select()
			.from(products)
			.where(eq(products.sku, "MUG-01"));
		expect(rows).toEqual([]);
	});

	it.each([
		["sku with invalid characters", { sku: "CAM P" }],
		["sku with a slash", { sku: "CAM/P" }],
		["blank sku", { sku: "   " }],
		["sku longer than 64", { sku: "S".repeat(65) }],
		["blank name", { name: "  " }],
		["name longer than 200", { name: "x".repeat(201) }],
		["negative price", { priceCents: -1 }],
		["non-integer price", { priceCents: 10.5 }],
		["price above the maximum", { priceCents: 100_000_001 }],
		["price as a string", { priceCents: "1500" }],
		["negative stock", { stock: -1 }],
		["non-integer stock", { stock: 1.5 }],
		["stock above the maximum", { stock: 1_000_001 }],
	])("returns 400 for %s", async (_label, override) => {
		const response = await create(acmeAdmin, { ...validProduct, ...override });

		expect(response.status).toBe(400);
		errorResponseSchema.parse(response.body);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
	});

	it.each([["sku"], ["name"], ["priceCents"], ["stock"]])(
		"returns 400 when %s is missing",
		async (field) => {
			const { [field as keyof typeof validProduct]: _, ...body } = validProduct;

			const response = await create(acmeAdmin, body);

			expect(response.status).toBe(400);
			expect(response.body.error.code).toBe("VALIDATION_ERROR");
			expect(response.body.error.message).toMatch(new RegExp(`^${field}: `));
		},
	);
});

describe("PATCH /products/:id", () => {
	it("updates name and priceCents and refreshes updatedAt", async () => {
		const before = await findProduct("Acme", "CAM-P");

		const response = await patch(acmeAdmin, before.id, {
			name: "  Camiseta P Azul ",
			priceCents: 5990,
		});

		expect(response.status).toBe(200);
		productSchema.parse(response.body);
		expect(Object.keys(response.body).sort()).toEqual(productKeys);
		const after = await findProduct("Acme", "CAM-P");
		expect(response.body).toEqual({
			id: before.id,
			sku: "CAM-P",
			name: "Camiseta P Azul",
			priceCents: 5990,
			stock: 25,
			createdAt: before.createdAt.toISOString(),
			updatedAt: after.updatedAt.toISOString(),
		});
		expect(after.updatedAt.getTime()).toBeGreaterThan(
			before.updatedAt.getTime(),
		);
	});

	it("updates only the name", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await patch(acmeAdmin, camP.id, { name: "Renamed" });

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ name: "Renamed", priceCents: 4990 });
	});

	it("updates only the price, accepting 0", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await patch(acmeAdmin, camP.id, { priceCents: 0 });

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ name: "Camiseta P", priceCents: 0 });
	});

	it("never changes sku or stock", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await patch(acmeAdmin, camP.id, {
			name: "Renamed",
			sku: "NEW-SKU",
			stock: 999,
		});

		expect(response.status).toBe(200);
		const stored = await findProduct("Acme", "CAM-P");
		expect(stored.sku).toBe("CAM-P");
		expect(stored.stock).toBe(25);
		expect(response.body).toMatchObject({ sku: "CAM-P", stock: 25 });
	});

	it.each([
		["an empty body", {}],
		["only sku and stock", { sku: "NEW-SKU", stock: 3 }],
	])("returns 400 for %s", async (_label, body) => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await patch(acmeAdmin, camP.id, body);

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
		expect(response.body.error.message).toContain(
			"At least one field is required",
		);
	});

	it.each([
		["blank name", { name: " " }],
		["name longer than 200", { name: "x".repeat(201) }],
		["negative price", { priceCents: -1 }],
		["non-integer price", { priceCents: 1.5 }],
		["price above the maximum", { priceCents: 100_000_001 }],
	])("returns 400 for %s", async (_label, body) => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await patch(acmeAdmin, camP.id, body);

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("returns 404 for a product of another tenant and leaves it unchanged", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		const response = await patch(acmeAdmin, globexCamP.id, {
			name: "Hijacked",
		});

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
		expect((await findProduct("Globex", "CAM-P")).name).toBe("Camiseta P");
	});

	it("returns 404 for a soft-deleted product", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		await db
			.update(products)
			.set({ deletedAt: new Date() })
			.where(eq(products.id, camP.id));

		const response = await patch(acmeAdmin, camP.id, { name: "Renamed" });

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("returns 404 for an id that is not a uuid", async () => {
		const response = await patch(acmeAdmin, "not-a-uuid", { name: "Renamed" });

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("returns 403 for an operator and leaves the product unchanged", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await patch(acmeOperator, camP.id, { name: "Renamed" });

		expect(response.status).toBe(403);
		expect(response.body.error.code).toBe("FORBIDDEN");
		expect((await findProduct("Acme", "CAM-P")).name).toBe("Camiseta P");
	});
});

describe("DELETE /products/:id", () => {
	it("soft deletes the product and returns 204 with no body", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await remove(acmeAdmin, camP.id);

		expect(response.status).toBe(204);
		expect(response.text).toBe("");
		const stored = await findProduct("Acme", "CAM-P");
		expect(stored.deletedAt).toBeInstanceOf(Date);
	});

	it("hides the product from the list and from GET /products/:id", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		await remove(acmeAdmin, camP.id).expect(204);

		const listed = await list(acmeAdmin);
		const fetched = await request(createApp())
			.get(`/api/v1/products/${camP.id}`)
			.set("Cookie", acmeAdmin);
		expect(skus(listed)).toEqual(["BON-01"]);
		expect(listed.body.meta.total).toBe(1);
		expect(fetched.status).toBe(404);
		expect(fetched.body).toEqual(notFoundBody);
	});

	it("returns 404 when deleting the same product again", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		await remove(acmeAdmin, camP.id).expect(204);

		const response = await remove(acmeAdmin, camP.id);

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("allows creating the SKU again after a soft delete", async () => {
		const camP = await findProduct("Acme", "CAM-P");
		await remove(acmeAdmin, camP.id).expect(204);

		const response = await create(acmeAdmin, { ...validProduct, sku: "cam-p" });

		expect(response.status).toBe(201);
		expect(response.body.sku).toBe("CAM-P");
		expect(response.body.id).not.toBe(camP.id);
	});

	it("returns 404 for a product of another tenant and leaves it active", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		const response = await remove(acmeAdmin, globexCamP.id);

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
		expect((await findProduct("Globex", "CAM-P")).deletedAt).toBeNull();
	});

	it("returns 404 for an id that is not a uuid", async () => {
		const response = await remove(acmeAdmin, "not-a-uuid");

		expect(response.status).toBe(404);
		expect(response.body).toEqual(notFoundBody);
	});

	it("returns 403 for an operator and leaves the product active", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await remove(acmeOperator, camP.id);

		expect(response.status).toBe(403);
		expect(response.body.error.code).toBe("FORBIDDEN");
		expect((await findProduct("Acme", "CAM-P")).deletedAt).toBeNull();
	});
});

describe("authentication", () => {
	it.each([
		["/api/v1/products"],
		["/api/v1/products/0190a8e2-0000-7000-8000-000000000000"],
	])("returns 401 on GET %s without a cookie", async (path) => {
		const response = await request(createApp()).get(path);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 on POST without a cookie", async () => {
		const response = await request(createApp())
			.post("/api/v1/products")
			.send(validProduct);

		expect(response.status).toBe(401);
		errorResponseSchema.parse(response.body);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 on PATCH without a cookie", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await request(createApp())
			.patch(`/api/v1/products/${camP.id}`)
			.send({ name: "Renamed" });

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 on DELETE without a cookie", async () => {
		const camP = await findProduct("Acme", "CAM-P");

		const response = await request(createApp()).delete(
			`/api/v1/products/${camP.id}`,
		);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
		expect((await findProduct("Acme", "CAM-P")).deletedAt).toBeNull();
	});

	it("returns 401 for an invalid token", async () => {
		const response = await list("access_token=invalid.token.value");

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});
});
