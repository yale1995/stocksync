import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { healthSchema } from "../../http/controllers/health.validation.js";
import { db } from "../../infra/db.js";
import { products } from "../../infra/schemas/products.js";
import { syncEvents } from "../../infra/schemas/sync-events.js";
import { tenants } from "../../infra/schemas/tenants.js";
import { seed } from "../../infra/seed/seed.js";

const packageVersion: string = JSON.parse(
	readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
).version;

async function health() {
	const response = await request(createApp()).get("/health");
	healthSchema.parse(response.body);
	return response;
}

async function firstProductOf(tenantName: string) {
	const [row] = await db
		.select({ id: products.id, tenantId: products.tenantId, sku: products.sku })
		.from(products)
		.innerJoin(tenants, eq(tenants.id, products.tenantId))
		.where(eq(tenants.name, tenantName))
		.limit(1);
	if (!row) throw new Error(`no product seeded for ${tenantName}`);
	return row;
}

type EventOverrides = Partial<typeof syncEvents.$inferInsert>;

function event(
	product: { id: string; tenantId: string; sku: string },
	overrides: EventOverrides,
) {
	return {
		tenantId: product.tenantId,
		productId: product.id,
		trigger: "stock_changed" as const,
		sku: product.sku,
		stock: 1,
		priceCents: 100,
		...overrides,
	};
}

const BASE = Date.parse("2026-10-06T12:00:00.000Z");

function at(seconds: number) {
	return new Date(BASE + seconds * 1000);
}

describe("GET /health", () => {
	it("answers 200 ok without a cookie and is never cached", async () => {
		const response = await health();

		expect(response.status).toBe(200);
		expect(response.body.status).toBe("ok");
		expect(response.headers["cache-control"]).toBe("no-store");
	});

	it("describes the server", async () => {
		const response = await health();

		expect(response.body.server).toEqual({
			status: "up",
			version: packageVersion,
			nodeVersion: process.version,
			environment: "test",
			provider: "local",
		});
	});

	it("describes the database", async () => {
		const { database } = (await health()).body;

		const version = await db.execute<{ server_version: string }>(
			sql`SHOW server_version`,
		);
		const maxConnections = await db.execute<{ max_connections: string }>(
			sql`SHOW max_connections`,
		);
		// Background processes have no datname, so the unfiltered count is higher.
		const allConnections = await db.execute<{ total: number }>(
			sql`SELECT count(*)::int AS total FROM pg_stat_activity`,
		);

		expect(database.status).toBe("up");
		expect(database.version).toBe(version.rows[0]?.server_version);
		expect(database.version.length).toBeGreaterThan(0);
		expect(database.maxConnections).toBe(
			Number(maxConnections.rows[0]?.max_connections),
		);
		expect(Number.isInteger(database.maxConnections)).toBe(true);
		expect(database.maxConnections).toBeGreaterThan(0);
		expect(database.openConnections).toBeGreaterThanOrEqual(1);
		expect(database.openConnections).toBeLessThan(
			allConnections.rows[0]?.total ?? 0,
		);
		expect(database.openConnections).toBeLessThanOrEqual(
			database.maxConnections,
		);
		expect(Number.isInteger(database.latencyMs)).toBe(true);
		expect(database.latencyMs).toBeGreaterThanOrEqual(0);
	});

	it("reports an empty sync queue", async () => {
		const response = await health();

		expect(response.body.sync).toEqual({
			pending: 0,
			failed: 0,
			oldestPendingAt: null,
			lastSuccessfulSyncAt: null,
		});
	});

	it("summarizes the sync queue across tenants without naming them", async () => {
		await seed(db);
		await db.delete(syncEvents);
		const acme = await firstProductOf("Acme");
		const globex = await firstProductOf("Globex");
		const future = new Date(Date.now() + 60 * 60 * 1000);
		await db.insert(syncEvents).values([
			event(acme, { status: "pending", createdAt: at(30) }),
			event(globex, {
				status: "pending",
				attempts: 2,
				nextAttemptAt: future,
				createdAt: at(10),
			}),
			event(acme, { status: "failed", attempts: 5, createdAt: at(1) }),
			event(globex, { status: "failed", attempts: 5, createdAt: at(2) }),
			event(acme, { status: "sent", sentAt: at(40), createdAt: at(0) }),
			event(globex, { status: "sent", sentAt: at(50), createdAt: at(3) }),
			event(acme, { status: "superseded", createdAt: at(4) }),
			event(globex, { status: "superseded", createdAt: at(5) }),
		]);

		const response = await health();

		expect(response.status).toBe(200);
		expect(response.body.sync).toEqual({
			pending: 2,
			failed: 2,
			oldestPendingAt: at(10).toISOString(),
			lastSuccessfulSyncAt: at(50).toISOString(),
		});
		const body = JSON.stringify(response.body);
		expect(body).not.toContain(acme.tenantId);
		expect(body).not.toContain(globex.tenantId);
	});
});
