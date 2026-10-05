import { randomUUID } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../infra/db.js";
import { signAccessToken } from "../../infra/jwt.js";
import { products } from "../../infra/schemas/products.js";
import { syncEvents } from "../../infra/schemas/sync-events.js";
import { tenants } from "../../infra/schemas/tenants.js";
import { users } from "../../infra/schemas/users.js";
import { seed } from "../../infra/seed/seed.js";

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

async function findProduct(tenant: string, sku: string) {
	const [row] = await db
		.select({ product: products })
		.from(products)
		.innerJoin(tenants, eq(products.tenantId, tenants.id))
		.where(and(eq(tenants.name, tenant), eq(products.sku, sku)));
	if (!row) throw new Error(`product ${sku} of ${tenant} not found`);
	return row.product;
}

function eventsOf(productId: string) {
	return db
		.select()
		.from(syncEvents)
		.where(eq(syncEvents.productId, productId))
		.orderBy(asc(syncEvents.version));
}

// Every seeded product already has its product_created event.
function eventsAfterSeed() {
	return db
		.select()
		.from(syncEvents)
		.where(ne(syncEvents.trigger, "product_created"))
		.orderBy(asc(syncEvents.version));
}

function snapshotOf(event: typeof syncEvents.$inferSelect) {
	return {
		tenantId: event.tenantId,
		productId: event.productId,
		trigger: event.trigger,
		sku: event.sku,
		stock: event.stock,
		priceCents: event.priceCents,
	};
}

const freshEvent = {
	status: "pending",
	attempts: 0,
	lastError: null,
	sentAt: null,
};

async function waitForLockWaiters(count: number) {
	for (let attempt = 0; attempt < 200; attempt++) {
		const { rows } = await db.execute<{ waiting: number }>(
			sql`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
		);
		if ((rows[0]?.waiting ?? 0) >= count) return;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error(`expected ${count} transactions waiting on a lock`);
}

function app() {
	return request(createApp());
}

function sell(items: { productId: string; quantity: number }[]) {
	return app()
		.post("/sales")
		.set("Cookie", acmeOperator)
		.set("Idempotency-Key", randomUUID())
		.send({ items });
}

function adjust(productId: string, direction: "in" | "out", quantity: number) {
	return app()
		.post(`/products/${productId}/stock-adjustments`)
		.set("Cookie", acmeAdmin)
		.send({ direction, quantity, reason: "Count" });
}

function patch(productId: string, body: object) {
	return app()
		.patch(`/products/${productId}`)
		.set("Cookie", acmeAdmin)
		.send(body);
}

function create(body: object) {
	return app().post("/products").set("Cookie", acmeAdmin).send(body);
}

let acmeAdmin: string;
let acmeOperator: string;
let camP: Awaited<ReturnType<typeof findProduct>>;
let bon: Awaited<ReturnType<typeof findProduct>>;

beforeEach(async () => {
	await seed(db);
	acmeAdmin = await cookieFor("admin@acme.test");
	acmeOperator = await cookieFor("operator@acme.test");
	camP = await findProduct("Acme", "CAM-P");
	bon = await findProduct("Acme", "BON-01");
});

describe("product creation", () => {
	it.each([
		["with stock", 7],
		["with stock 0", 0],
	])("records a pending product_created event %s", async (_label, stock) => {
		const response = await create({
			sku: "MEIA-01",
			name: "Meia",
			priceCents: 1500,
			stock,
		}).expect(201);

		const events = await eventsOf(response.body.id);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			...freshEvent,
			tenantId: camP.tenantId,
			productId: response.body.id,
			trigger: "product_created",
			sku: "MEIA-01",
			stock,
			priceCents: 1500,
		});
	});

	it("records no event when the SKU already exists", async () => {
		await create({
			sku: "CAM-P",
			name: "Camiseta",
			priceCents: 1500,
			stock: 1,
		}).expect(409);

		expect(await eventsOf(camP.id)).toHaveLength(1);
	});
});

describe("stock changes", () => {
	it("records one stock_changed event per product of a sale", async () => {
		await adjust(bon.id, "in", 4).expect(201);
		const before = (await eventsAfterSeed()).length;

		await sell([
			{ productId: camP.id, quantity: 2 },
			{ productId: bon.id, quantity: 3 },
		]).expect(201);

		const events = (await eventsAfterSeed()).slice(before);
		const sorted = events
			.map(snapshotOf)
			.toSorted((a, b) => (a.productId < b.productId ? -1 : 1));
		const expected = [
			{ product: camP, stock: 23 },
			{ product: bon, stock: 1 },
		]
			.map(({ product, stock }) => ({
				tenantId: product.tenantId,
				productId: product.id,
				trigger: "stock_changed",
				sku: product.sku,
				stock,
				priceCents: product.priceCents,
			}))
			.toSorted((a, b) => (a.productId < b.productId ? -1 : 1));
		expect(sorted).toEqual(expected);
		for (const event of events) expect(event).toMatchObject(freshEvent);
	});

	it("records no event when a sale fails with 409", async () => {
		await sell([
			{ productId: camP.id, quantity: 1 },
			{ productId: bon.id, quantity: 1 },
		]).expect(409);

		expect(await eventsAfterSeed()).toEqual([]);
	});

	it("records a stock_changed event for an adjustment", async () => {
		await adjust(camP.id, "out", 5).expect(201);

		const events = await eventsAfterSeed();
		expect(events.map(snapshotOf)).toEqual([
			{
				tenantId: camP.tenantId,
				productId: camP.id,
				trigger: "stock_changed",
				sku: "CAM-P",
				stock: 20,
				priceCents: 4990,
			},
		]);
	});

	it("records no event when an adjustment fails with 409", async () => {
		await adjust(camP.id, "out", 26).expect(409);

		expect(await eventsAfterSeed()).toEqual([]);
	});
});

describe("price changes", () => {
	it("records a price_changed event with the current stock and the new price", async () => {
		await adjust(camP.id, "out", 5).expect(201);

		await patch(camP.id, { priceCents: 5990 }).expect(200);

		const [, , priceChanged] = await eventsOf(camP.id);
		expect(priceChanged && snapshotOf(priceChanged)).toEqual({
			tenantId: camP.tenantId,
			productId: camP.id,
			trigger: "price_changed",
			sku: "CAM-P",
			stock: 20,
			priceCents: 5990,
		});
		expect(priceChanged).toMatchObject(freshEvent);
	});

	it("records one event when name and price change together", async () => {
		await patch(camP.id, { name: "Camiseta Azul", priceCents: 5990 }).expect(
			200,
		);

		expect((await eventsAfterSeed()).map(snapshotOf)).toEqual([
			expect.objectContaining({ trigger: "price_changed", priceCents: 5990 }),
		]);
	});

	it.each([
		["the same price", { priceCents: 4990 }],
		["only the name", { name: "Camiseta Azul" }],
		["the same price and a new name", { name: "Camiseta", priceCents: 4990 }],
	])("records no event for %s", async (_label, body) => {
		await patch(camP.id, body).expect(200);

		expect(await eventsAfterSeed()).toEqual([]);
	});

	it("records no event for a missing product", async () => {
		await patch(randomUUID(), { priceCents: 1 }).expect(404);

		expect(await eventsAfterSeed()).toEqual([]);
	});

	// A test transaction holds the row lock while A and then B queue behind it,
	// so B reaches the lock after A. Without the lock, B would read the stale
	// price 4990 before A commits, see no change and record nothing.
	it("records one event per concurrent price change, the highest version holding the final price", async () => {
		let first: ReturnType<typeof patch> | undefined;
		let second: ReturnType<typeof patch> | undefined;
		await db.transaction(async (tx) => {
			await tx.execute(
				sql`SELECT 1 FROM products WHERE id = ${camP.id} FOR UPDATE`,
			);
			first = patch(camP.id, { priceCents: 5990 });
			first.then(() => undefined);
			await waitForLockWaiters(1);
			second = patch(camP.id, { priceCents: 4990 });
			second.then(() => undefined);
			await waitForLockWaiters(2);
		});
		expect((await first)?.status).toBe(200);
		expect((await second)?.status).toBe(200);

		const final = await findProduct("Acme", "CAM-P");
		const events = await eventsAfterSeed();
		expect(events.map((event) => [event.trigger, event.priceCents])).toEqual([
			["price_changed", 5990],
			["price_changed", 4990],
		]);
		expect(final.priceCents).toBe(4990);
		expect(events.at(-1)?.priceCents).toBe(final.priceCents);
	});
});

describe("product deletion", () => {
	it("records product_deleted with stock 0 and leaves the product stock unchanged", async () => {
		await app()
			.delete(`/products/${camP.id}`)
			.set("Cookie", acmeAdmin)
			.expect(204);

		const [row] = await db
			.select()
			.from(products)
			.where(eq(products.id, camP.id));
		expect(row?.stock).toBe(25);
		expect(row?.deletedAt).not.toBeNull();
		expect((await eventsAfterSeed()).map(snapshotOf)).toEqual([
			{
				tenantId: camP.tenantId,
				productId: camP.id,
				trigger: "product_deleted",
				sku: "CAM-P",
				stock: 0,
				priceCents: 4990,
			},
		]);
	});

	it("records no event for a missing product", async () => {
		await app()
			.delete(`/products/${randomUUID()}`)
			.set("Cookie", acmeAdmin)
			.expect(404);

		expect(await eventsAfterSeed()).toEqual([]);
	});
	// The price changes while the DELETE waits on the row lock; an unlocked
	// read would snapshot the old price into the product_deleted event.
	it("snapshots the price committed while the delete waited on the lock", async () => {
		let deletion: ReturnType<typeof patch> | undefined;
		await db.transaction(async (tx) => {
			await tx.execute(
				sql`SELECT 1 FROM products WHERE id = ${camP.id} FOR UPDATE`,
			);
			deletion = app().delete(`/products/${camP.id}`).set("Cookie", acmeAdmin);
			deletion.then(() => undefined);
			await waitForLockWaiters(1);
			await tx
				.update(products)
				.set({ priceCents: 5990 })
				.where(eq(products.id, camP.id));
		});
		expect((await deletion)?.status).toBe(204);

		const events = await eventsOf(camP.id);
		expect(events.at(-1)).toMatchObject({
			trigger: "product_deleted",
			stock: 0,
			priceCents: 5990,
		});
	});
});

describe("versions", () => {
	it("grow across successive changes, delete and recreate with the same SKU", async () => {
		await adjust(camP.id, "out", 1).expect(201);
		await patch(camP.id, { priceCents: 5990 }).expect(200);
		await app()
			.delete(`/products/${camP.id}`)
			.set("Cookie", acmeAdmin)
			.expect(204);
		const recreated = await create({
			sku: "CAM-P",
			name: "Camiseta P",
			priceCents: 4990,
			stock: 3,
		}).expect(201);

		const events = await db
			.select()
			.from(syncEvents)
			.where(
				and(
					eq(syncEvents.tenantId, camP.tenantId),
					eq(syncEvents.sku, "CAM-P"),
				),
			)
			.orderBy(asc(syncEvents.createdAt), asc(syncEvents.id));

		expect(events.map((event) => [event.productId, event.trigger])).toEqual([
			[camP.id, "product_created"],
			[camP.id, "stock_changed"],
			[camP.id, "price_changed"],
			[camP.id, "product_deleted"],
			[recreated.body.id, "product_created"],
		]);
		const versions = events.map((event) => event.version);
		expect(versions).toEqual(versions.toSorted((a, b) => a - b));
		expect(new Set(versions).size).toBe(versions.length);
	});
});

describe("database constraints", () => {
	function rawEvent(override: Partial<typeof syncEvents.$inferInsert> = {}) {
		return db.insert(syncEvents).values({
			tenantId: camP.tenantId,
			productId: camP.id,
			trigger: "stock_changed",
			sku: camP.sku,
			stock: 1,
			priceCents: 1,
			...override,
		});
	}

	it.each([
		["negative stock", { stock: -1 }, "sync_events_stock_non_negative"],
		[
			"negative price",
			{ priceCents: -1 },
			"sync_events_price_cents_non_negative",
		],
		[
			"negative attempts",
			{ attempts: -1 },
			"sync_events_attempts_non_negative",
		],
		[
			"status sent without sent_at",
			{ status: "sent" as const },
			"sync_events_sent_at_only_when_sent",
		],
		[
			"sent_at on a pending event",
			{ sentAt: new Date() },
			"sync_events_sent_at_only_when_sent",
		],
	])("rejects an event with %s", async (_label, override, constraint) => {
		await expect(rawEvent(override)).rejects.toMatchObject({
			cause: { code: "23514", constraint },
		});
	});

	it("defaults next_attempt_at to the insert time", async () => {
		const before = new Date(Date.now() - 1000);
		const [event] = await rawEvent().returning();

		expect(event?.nextAttemptAt).toBeInstanceOf(Date);
		expect(event?.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
			before.getTime(),
		);
		expect(event?.nextAttemptAt.getTime()).toBeLessThanOrEqual(
			Date.now() + 1000,
		);
	});

	it("defines the worker, status and superseding indexes", async () => {
		const { rows } = await db.execute<{ indexdef: string }>(
			sql`SELECT indexdef FROM pg_indexes WHERE tablename = 'sync_events' AND indexname LIKE '%_idx' ORDER BY indexname`,
		);

		expect(rows.map((row) => row.indexdef)).toEqual([
			"CREATE INDEX sync_events_due_idx ON public.sync_events USING btree (next_attempt_at) WHERE (status = 'pending'::sync_event_status)",
			"CREATE INDEX sync_events_tenant_id_product_id_version_idx ON public.sync_events USING btree (tenant_id, product_id, version)",
			"CREATE INDEX sync_events_tenant_id_status_idx ON public.sync_events USING btree (tenant_id, status)",
		]);
	});

	it("accepts a sent event with sent_at", async () => {
		await expect(
			rawEvent({ status: "sent", sentAt: new Date() }),
		).resolves.toBeDefined();
	});

	it("rejects an event pointing to a product of another tenant", async () => {
		const globexCamP = await findProduct("Globex", "CAM-P");

		await expect(rawEvent({ productId: globexCamP.id })).rejects.toMatchObject({
			cause: { code: "23503", constraint: "sync_events_product_fk" },
		});
	});

	it("rejects a duplicate version", async () => {
		const [existing] = await eventsOf(camP.id);

		await expect(
			db.execute(
				sql`INSERT INTO sync_events (tenant_id, product_id, version, trigger, sku, stock, price_cents) OVERRIDING SYSTEM VALUE VALUES (${camP.tenantId}, ${camP.id}, ${existing?.version}, 'stock_changed', 'CAM-P', 1, 1)`,
			),
		).rejects.toMatchObject({
			cause: { code: "23505", constraint: "sync_events_version_unique" },
		});
	});
});
