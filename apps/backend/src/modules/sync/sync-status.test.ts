import { and, eq } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { syncStatusSchema } from "../../http/controllers/sync.validation.js";
import { db } from "../../infra/db.js";
import { signAccessToken } from "../../infra/jwt.js";
import { hashPassword } from "../../infra/password.js";
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

async function tenantId(name: string) {
	const [tenant] = await db
		.select()
		.from(tenants)
		.where(eq(tenants.name, name));
	if (!tenant) throw new Error(`tenant ${name} not seeded`);
	return tenant.id;
}

async function productOf(tenant: string, sku: string) {
	const [product] = await db
		.select()
		.from(products)
		.where(and(eq(products.tenantId, tenant), eq(products.sku, sku)));
	if (!product) throw new Error(`product ${sku} not found`);
	return product;
}

function status(cookie: string) {
	return request(createApp()).get("/sync/status").set("Cookie", cookie);
}

type EventOverrides = Partial<typeof syncEvents.$inferInsert>;

async function insertEvents(
	product: { id: string; tenantId: string; sku: string },
	rows: EventOverrides[],
) {
	return db
		.insert(syncEvents)
		.values(
			rows.map((row) => ({
				tenantId: product.tenantId,
				productId: product.id,
				trigger: "stock_changed" as const,
				sku: product.sku,
				stock: 1,
				priceCents: 100,
				...row,
			})),
		)
		.returning();
}

const BASE = Date.parse("2026-10-05T12:00:00.000Z");

function at(seconds: number) {
	return new Date(BASE + seconds * 1000);
}

let acme: string;
let globex: string;
let acmeAdmin: string;
let acmeOperator: string;

beforeEach(async () => {
	await seed(db);
	acme = await tenantId("Acme");
	globex = await tenantId("Globex");
	acmeAdmin = await cookieFor("admin@acme.test");
	acmeOperator = await cookieFor("operator@acme.test");
});

describe("GET /sync/status", () => {
	it("returns the counts, a null last sync and no failures right after the seed", async () => {
		const response = await status(acmeAdmin).expect(200);

		expect(response.body).toEqual({
			pending: 2,
			sent: 0,
			failed: 0,
			superseded: 0,
			lastSuccessfulSyncAt: null,
			failedEvents: [],
		});
	});

	it("returns zeros for a tenant without events", async () => {
		const [tenant] = await db
			.insert(tenants)
			.values({ name: "Initech" })
			.returning();
		const [user] = await db
			.insert(users)
			.values({
				tenantId: tenant?.id ?? "",
				email: "admin@initech.test",
				passwordHash: await hashPassword("initech-admin-password"),
				role: "admin",
			})
			.returning();
		const token = await signAccessToken({
			userId: user?.id ?? "",
			tenantId: user?.tenantId ?? "",
			role: "admin",
		});

		const response = await status(`access_token=${token}`).expect(200);

		syncStatusSchema.parse(response.body);
		expect(response.body).toEqual({
			pending: 0,
			sent: 0,
			failed: 0,
			superseded: 0,
			lastSuccessfulSyncAt: null,
			failedEvents: [],
		});
	});

	it("counts each status and reports the latest sent_at", async () => {
		const camP = await productOf(acme, "CAM-P");
		await db
			.update(syncEvents)
			.set({ status: "superseded" })
			.where(eq(syncEvents.tenantId, acme));
		await insertEvents(camP, [
			{ status: "sent", sentAt: at(10) },
			{ status: "sent", sentAt: at(30) },
			{ status: "sent", sentAt: at(20) },
			{ status: "failed", attempts: 5, lastError: "HTTP 500" },
			{ status: "pending" },
		]);

		const response = await status(acmeOperator).expect(200);

		syncStatusSchema.parse(response.body);
		expect(response.body).toMatchObject({
			pending: 1,
			sent: 3,
			failed: 1,
			superseded: 2,
			lastSuccessfulSyncAt: "2026-10-05T12:00:30.000Z",
		});
	});

	it("returns a failed event without lastError as null", async () => {
		const camP = await productOf(acme, "CAM-P");
		await insertEvents(camP, [{ status: "failed", attempts: 5 }]);

		const response = await status(acmeAdmin).expect(200);

		syncStatusSchema.parse(response.body);
		expect(response.body.failedEvents[0].lastError).toBeNull();
	});

	// updated_at runs against the insertion order, as for an old event whose
	// last retry failed late, so ordering by id, version or created_at fails.
	it("lists the 20 most recent failed events, by updated_at then id, with exactly the agreed fields", async () => {
		const camP = await productOf(acme, "CAM-P");
		const failed = await insertEvents(
			camP,
			Array.from({ length: 23 }, (_, i) => ({
				status: "failed" as const,
				attempts: 5,
				lastError: `HTTP 50${i % 4}`,
				stock: i,
				// Events 0 and 1 share the latest timestamp; the id breaks the tie.
				updatedAt: at(Math.min(22 - i, 21)),
			})),
		);
		await insertEvents(camP, [
			{ status: "sent", sentAt: at(100), updatedAt: at(100) },
			{ status: "pending", updatedAt: at(101) },
		]);

		const response = await status(acmeAdmin).expect(200);

		const byStock = new Map(failed.map((event) => [event.stock, event]));
		const tied = [byStock.get(0), byStock.get(1)].toSorted((a, b) =>
			(a?.id ?? "") < (b?.id ?? "") ? 1 : -1,
		);
		const expected = [
			...tied,
			...Array.from({ length: 18 }, (_, i) => byStock.get(i + 2)),
		].map((event) => ({
			id: event?.id,
			productId: camP.id,
			sku: "CAM-P",
			trigger: "stock_changed",
			attempts: 5,
			lastError: event?.lastError,
			updatedAt: event?.updatedAt.toISOString(),
		}));
		expect(response.body.failed).toBe(23);
		expect(response.body.failedEvents).toEqual(expected);
	});

	it("drops an event from failedEvents once it is superseded", async () => {
		const camP = await productOf(acme, "CAM-P");
		const [event] = await insertEvents(camP, [
			{ status: "failed", attempts: 5, lastError: "timeout" },
		]);
		await db
			.update(syncEvents)
			.set({ status: "superseded" })
			.where(eq(syncEvents.id, event?.id ?? ""));

		const response = await status(acmeAdmin).expect(200);

		expect(response.body.failed).toBe(0);
		expect(response.body.failedEvents).toEqual([]);
	});

	it("shows only the caller's tenant", async () => {
		const globexCamP = await productOf(globex, "CAM-P");
		await insertEvents(globexCamP, [
			{ status: "failed", attempts: 5, lastError: "HTTP 500" },
			{ status: "sent", sentAt: at(50) },
		]);

		const acmeStatus = await status(acmeAdmin).expect(200);
		const globexStatus = await status(
			await cookieFor("operator@globex.test"),
		).expect(200);

		expect(acmeStatus.body).toEqual({
			pending: 2,
			sent: 0,
			failed: 0,
			superseded: 0,
			lastSuccessfulSyncAt: null,
			failedEvents: [],
		});
		expect(globexStatus.body).toMatchObject({
			pending: 2,
			sent: 1,
			failed: 1,
			lastSuccessfulSyncAt: "2026-10-05T12:00:50.000Z",
		});
		expect(globexStatus.body.failedEvents).toHaveLength(1);
		expect(globexStatus.body.failedEvents[0].productId).toBe(globexCamP.id);
	});

	it("ignores a tenant id sent in the query, a header or the body", async () => {
		const globexCamP = await productOf(globex, "CAM-P");
		await insertEvents(globexCamP, [
			{ status: "failed", attempts: 5, lastError: "HTTP 500" },
		]);

		const response = await request(createApp())
			.get("/sync/status")
			.query({ tenantId: globex })
			.set("Cookie", acmeAdmin)
			.set("X-Tenant-Id", globex)
			.send({ tenantId: globex })
			.expect(200);

		expect(response.body).toEqual({
			pending: 2,
			sent: 0,
			failed: 0,
			superseded: 0,
			lastSuccessfulSyncAt: null,
			failedEvents: [],
		});
	});

	it.each([
		["admin", () => acmeAdmin],
		["operator", () => acmeOperator],
	])("responds 200 to an %s", async (_role, cookie) => {
		await status(cookie()).expect(200);
	});

	it.each([
		["no cookie", undefined],
		["an invalid token", "access_token=not-a-token"],
	])("responds 401 with %s", async (_label, cookie) => {
		const req = request(createApp()).get("/sync/status");
		const response = await (cookie ? req.set("Cookie", cookie) : req).expect(
			401,
		);

		expect(response.body).toEqual({
			error: { code: "UNAUTHORIZED", message: "Authentication required" },
		});
	});
});
