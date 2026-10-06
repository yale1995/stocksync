import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../infra/db.js";
import { products } from "../../infra/schemas/products.js";
import { syncEvents } from "../../infra/schemas/sync-events.js";
import { tenants } from "../../infra/schemas/tenants.js";
import { users } from "../../infra/schemas/users.js";
import { seed } from "../../infra/seed/seed.js";
import { createMemoryLogger, LEVELS } from "../../infra/test/memory-logger.js";
import {
	createProduct,
	deleteProduct,
	updateProduct,
} from "../products/products.service.js";
import { createStockAdjustment } from "../stock-movements/stock-movements.service.js";
import type { AdsClient, AdsItem, AdsResult } from "./ads-client.js";
import { createSyncWorker, type SyncWorkerConfig } from "./sync.worker.js";

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const config: SyncWorkerConfig = {
	batchSize: 50,
	rateLimitPerSecond: 1000,
	maxAttempts: 5,
	backoffBaseMs: 1000,
	backoffMaxMs: 5000,
	pollIntervalMs: 1000,
};

// Ahead of the database clock, so events written by the services through
// now() are due from the first tick.
function fakeClock() {
	let current = Date.now() + 60_000;
	return {
		now: () => new Date(current),
		advance(ms: number) {
			current += ms;
		},
	};
}

type Call = {
	tenantId: string;
	items: AdsItem[];
	requestId: string;
	at: number;
};

function fakeClient(
	clock: ReturnType<typeof fakeClock>,
	results: AdsResult[] = [],
) {
	const calls: Call[] = [];
	const client: AdsClient = {
		async sendUpdates(tenantId, items, requestId) {
			calls.push({ tenantId, items, requestId, at: clock.now().getTime() });
			return results.shift() ?? { kind: "ok" };
		},
	};
	return { calls, client };
}

function setup({
	results = [],
	random = () => 0.5,
	overrides = {},
}: {
	results?: AdsResult[];
	random?: () => number;
	overrides?: Partial<SyncWorkerConfig>;
} = {}) {
	const clock = fakeClock();
	const { calls, client } = fakeClient(clock, results);
	const sleeps: number[] = [];
	const memory = createMemoryLogger();
	const worker = createSyncWorker({
		client,
		clock,
		random,
		sleep: async (ms) => {
			sleeps.push(ms);
			clock.advance(ms);
		},
		config: { ...config, ...overrides },
		logger: memory.logger,
	});
	return { worker, clock, calls, sleeps, lines: memory.lines };
}

async function tenantId(name: string) {
	const [tenant] = await db
		.select()
		.from(tenants)
		.where(eq(tenants.name, name));
	if (!tenant) throw new Error(`tenant ${name} not seeded`);
	return tenant.id;
}

async function adminOf(tenant: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(and(eq(users.tenantId, tenant), eq(users.role, "admin")));
	if (!user) throw new Error("admin not seeded");
	return user.id;
}

async function productOf(tenant: string, sku: string) {
	const [product] = await db
		.select()
		.from(products)
		.where(and(eq(products.tenantId, tenant), eq(products.sku, sku)));
	if (!product) throw new Error(`product ${sku} not found`);
	return product;
}

function eventsOf(productId: string) {
	return db
		.select()
		.from(syncEvents)
		.where(eq(syncEvents.productId, productId))
		.orderBy(asc(syncEvents.version));
}

async function eventById(id: string) {
	const [event] = await db
		.select()
		.from(syncEvents)
		.where(eq(syncEvents.id, id));
	if (!event) throw new Error(`event ${id} not found`);
	return event;
}

// Most tests follow one product; the seeded product_created events are taken
// out of the queue so they do not join the batch.
async function discardSeedEvents() {
	await db.update(syncEvents).set({ status: "superseded" });
}

let acme: string;
let globex: string;
let acmeAdmin: string;

beforeEach(async () => {
	await seed(db);
	acme = await tenantId("Acme");
	globex = await tenantId("Globex");
	acmeAdmin = await adminOf(acme);
});

function adjust(productId: string, quantity: number) {
	return createStockAdjustment(acme, acmeAdmin, productId, {
		direction: "out",
		quantity,
		reason: "Count",
	});
}

async function oneEvent() {
	await discardSeedEvents();
	const camP = await productOf(acme, "CAM-P");
	await adjust(camP.id, 1);
	const [event] = (await eventsOf(camP.id)).filter(
		(e) => e.status === "pending",
	);
	if (!event) throw new Error("no pending event");
	return event;
}

describe("successful send", () => {
	it("sends one single-tenant batch per tick and marks the events sent", async () => {
		const { worker, calls, clock } = setup();

		expect(await worker.tick()).toBe(true);

		const acmeEvents = await db
			.select()
			.from(syncEvents)
			.where(eq(syncEvents.tenantId, acme))
			.orderBy(asc(syncEvents.version));
		expect(calls).toHaveLength(1);
		expect(calls[0]?.tenantId).toBe(acme);
		expect(calls[0]?.items).toEqual(
			acmeEvents.map(({ sku, stock, priceCents, version }) => ({
				sku,
				stock,
				priceCents,
				version,
			})),
		);
		expect(calls[0]?.items.map((item) => item.sku)).toEqual([
			"CAM-P",
			"BON-01",
		]);
		for (const event of acmeEvents) {
			expect(event.status).toBe("sent");
			expect(event.sentAt).toEqual(clock.now());
		}
		const globexEvents = await db
			.select()
			.from(syncEvents)
			.where(eq(syncEvents.tenantId, globex));
		expect(globexEvents.map((event) => event.status)).toEqual([
			"pending",
			"pending",
		]);
	});

	it("delivers the events of two tenants in separate batches", async () => {
		const { worker, calls } = setup();

		expect(await worker.tick()).toBe(true);
		expect(await worker.tick()).toBe(true);
		expect(await worker.tick()).toBe(false);

		expect(calls.map((call) => call.tenantId)).toEqual([acme, globex]);
		expect(calls[1]?.items.map((item) => item.sku)).toEqual([
			"CAM-P",
			"CAN-01",
		]);
		expect(
			calls[1]?.items.find((item) => item.sku === "CAM-P")?.priceCents,
		).toBe(5490);
		const statuses = await db
			.select({ status: syncEvents.status })
			.from(syncEvents);
		expect(statuses.every(({ status }) => status === "sent")).toBe(true);
	});

	it("sends nothing and reports it when no event is due", async () => {
		await discardSeedEvents();
		const { worker, calls } = setup();

		expect(await worker.tick()).toBe(false);
		expect(calls).toEqual([]);
	});
});

describe("coalescing", () => {
	it("sends only the newest event of a product and supersedes the older ones", async () => {
		await discardSeedEvents();
		const camP = await productOf(acme, "CAM-P");
		await adjust(camP.id, 1);
		await adjust(camP.id, 2);
		await updateProduct(acme, camP.id, { priceCents: 5990 });
		const { worker, calls } = setup();

		await worker.tick();

		const events = (await eventsOf(camP.id)).slice(1);
		expect(events.map((event) => [event.trigger, event.status])).toEqual([
			["stock_changed", "superseded"],
			["stock_changed", "superseded"],
			["price_changed", "sent"],
		]);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.items).toEqual([
			{
				sku: "CAM-P",
				stock: 22,
				priceCents: 5990,
				version: events[2]?.version,
			},
		]);
	});

	it.each<[string, AdsResult]>([
		["fails", { kind: "error", error: "HTTP 500" }],
		["is rate limited", { kind: "rate_limited", retryAfterMs: 1000 }],
	])(
		"supersedes the older events of a product even when the send %s",
		async (_label, result) => {
			await discardSeedEvents();
			const camP = await productOf(acme, "CAM-P");
			await adjust(camP.id, 1);
			await adjust(camP.id, 2);
			await adjust(camP.id, 3);
			const { worker } = setup({ results: [result] });

			await worker.tick();

			const events = (await eventsOf(camP.id)).slice(1);
			expect(events.map((event) => event.status)).toEqual([
				"superseded",
				"superseded",
				"pending",
			]);
		},
	);

	it("sends a deleted and recreated SKU in version order", async () => {
		await discardSeedEvents();
		const camP = await productOf(acme, "CAM-P");
		await deleteProduct(acme, camP.id);
		const recreated = await createProduct(acme, acmeAdmin, {
			sku: "CAM-P",
			name: "Camiseta P",
			priceCents: 3990,
			stock: 4,
		});
		const { worker, calls } = setup();

		await worker.tick();

		const [deleted] = (await eventsOf(camP.id)).filter(
			(event) => event.trigger === "product_deleted",
		);
		const [created] = await eventsOf(recreated.id);
		expect(calls[0]?.items).toEqual([
			{ sku: "CAM-P", stock: 0, priceCents: 4990, version: deleted?.version },
			{ sku: "CAM-P", stock: 4, priceCents: 3990, version: created?.version },
		]);
	});
});

describe("retry", () => {
	it("ends sent with attempts = 2 after two failures and a success", async () => {
		const event = await oneEvent();
		const { worker, clock, calls } = setup({
			results: [
				{ kind: "error", error: "HTTP 500" },
				{ kind: "error", error: "timeout" },
			],
		});

		await worker.tick();
		let stored = await eventById(event.id);
		expect(stored).toMatchObject({
			status: "pending",
			attempts: 1,
			lastError: "HTTP 500",
		});
		expect(stored.nextAttemptAt.getTime()).toBe(clock.now().getTime() + 500);

		expect(await worker.tick()).toBe(false);
		expect(calls).toHaveLength(1);

		clock.advance(500);
		await worker.tick();
		stored = await eventById(event.id);
		expect(stored).toMatchObject({
			status: "pending",
			attempts: 2,
			lastError: "timeout",
		});
		expect(stored.nextAttemptAt.getTime()).toBe(clock.now().getTime() + 1000);

		clock.advance(1000);
		await worker.tick();
		stored = await eventById(event.id);
		expect(stored).toMatchObject({ status: "sent", attempts: 2 });
		expect(stored.sentAt).toEqual(clock.now());
		expect(calls).toHaveLength(3);
	});

	it("follows min(max, base × 2^(attempts−1)) × random and ends failed at the maximum", async () => {
		const event = await oneEvent();
		const failure: AdsResult = { kind: "error", error: "HTTP 503" };
		const { worker, clock } = setup({ results: Array(5).fill(failure) });
		const delays: number[] = [];

		for (let attempt = 1; attempt <= 4; attempt++) {
			await worker.tick();
			const stored = await eventById(event.id);
			expect(stored).toMatchObject({ status: "pending", attempts: attempt });
			const delay = stored.nextAttemptAt.getTime() - clock.now().getTime();
			delays.push(delay);
			clock.advance(delay);
		}
		await worker.tick();

		expect(delays).toEqual([500, 1000, 2000, 2500]);
		expect(await eventById(event.id)).toMatchObject({
			status: "failed",
			attempts: 5,
			lastError: "HTTP 503",
			sentAt: null,
		});
		clock.advance(60_000);
		expect(await worker.tick()).toBe(false);
	});

	it("applies the jitter drawn for each event", async () => {
		const event = await oneEvent();
		const { worker, clock } = setup({
			results: [{ kind: "error", error: "HTTP 500" }],
			random: () => 0.25,
			overrides: { backoffBaseMs: 4000 },
		});

		await worker.tick();

		const stored = await eventById(event.id);
		expect(stored.nextAttemptAt.getTime() - clock.now().getTime()).toBe(1000);
	});

	it("reschedules by Retry-After on 429 without counting an attempt", async () => {
		const event = await oneEvent();
		const { worker, clock, calls } = setup({
			results: [{ kind: "rate_limited", retryAfterMs: 2000 }],
		});

		await worker.tick();

		const stored = await eventById(event.id);
		expect(stored).toMatchObject({
			status: "pending",
			attempts: 0,
			lastError: "HTTP 429",
		});
		expect(stored.nextAttemptAt.getTime()).toBe(clock.now().getTime() + 2000);
		clock.advance(1999);
		expect(await worker.tick()).toBe(false);
		clock.advance(1);
		expect(await worker.tick()).toBe(true);
		expect(calls).toHaveLength(2);
		expect((await eventById(event.id)).status).toBe("sent");
	});
});

describe("superseding after a send", () => {
	it("marks an older failed event of the product superseded when a newer one is sent", async () => {
		const failedEvent = await oneEvent();
		const failing = setup({
			results: [{ kind: "error", error: "HTTP 500" }],
			overrides: { maxAttempts: 1 },
		});
		await failing.worker.tick();
		expect((await eventById(failedEvent.id)).status).toBe("failed");

		const camP = await productOf(acme, "CAM-P");
		await adjust(camP.id, 1);
		const { worker } = setup();
		await worker.tick();

		const events = (await eventsOf(camP.id)).slice(-2);
		expect(events.map((event) => [event.id, event.status])).toEqual([
			[failedEvent.id, "superseded"],
			[events[1]?.id, "sent"],
		]);
	});

	it("marks an older pending event that is not due yet superseded", async () => {
		const waiting = await oneEvent();
		const { worker, calls } = setup({
			results: [{ kind: "error", error: "HTTP 500" }],
		});
		await worker.tick();

		const camP = await productOf(acme, "CAM-P");
		await adjust(camP.id, 1);
		await worker.tick();

		expect(calls[1]?.items).toHaveLength(1);
		expect(await eventById(waiting.id)).toMatchObject({
			status: "superseded",
			attempts: 1,
		});
	});

	it("leaves the events of other products and tenants untouched", async () => {
		const { worker } = setup();
		const globexCamP = await productOf(globex, "CAM-P");
		const acmeBon = await productOf(acme, "BON-01");
		await discardSeedEvents();
		await db
			.update(syncEvents)
			.set({ status: "failed" })
			.where(inArray(syncEvents.productId, [globexCamP.id, acmeBon.id]));

		const camP = await productOf(acme, "CAM-P");
		await adjust(camP.id, 1);
		await worker.tick();

		expect((await eventsOf(globexCamP.id)).map((e) => e.status)).toEqual([
			"failed",
		]);
		expect((await eventsOf(acmeBon.id)).map((e) => e.status)).toEqual([
			"failed",
		]);
	});
});

describe("claiming", () => {
	function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) =>
				setTimeout(() => reject(new Error("tick blocked on a lock")), ms),
			),
		]);
	}

	it("skips a tenant whose due events are locked by another transaction", async () => {
		const { worker, calls } = setup();

		await db.transaction(async (tx) => {
			await tx.execute(
				sql`SELECT 1 FROM sync_events WHERE tenant_id = ${acme} FOR UPDATE`,
			);
			expect(await withTimeout(worker.tick())).toBe(true);
		});

		expect(calls.map((call) => call.tenantId)).toEqual([globex]);
	});

	it("claims only the unlocked events of the picked tenant", async () => {
		const camP = await productOf(acme, "CAM-P");
		const { worker, calls } = setup();

		await db.transaction(async (tx) => {
			await tx.execute(
				sql`SELECT 1 FROM sync_events WHERE product_id = ${camP.id} FOR UPDATE`,
			);
			expect(await withTimeout(worker.tick())).toBe(true);
		});

		expect(calls[0]?.tenantId).toBe(acme);
		expect(calls[0]?.items.map((item) => item.sku)).toEqual(["BON-01"]);
	});

	it("picks the tenant with the earliest next_attempt_at, even with a higher version", async () => {
		const { worker, clock, calls } = setup();
		const now = clock.now().getTime();
		await db
			.update(syncEvents)
			.set({ nextAttemptAt: new Date(now - 1000) })
			.where(eq(syncEvents.tenantId, acme));
		await db
			.update(syncEvents)
			.set({ nextAttemptAt: new Date(now - 5000) })
			.where(eq(syncEvents.tenantId, globex));

		await worker.tick();

		expect(calls.map((call) => call.tenantId)).toEqual([globex]);
	});

	it("breaks a next_attempt_at tie by the lowest version", async () => {
		const { worker, clock, calls } = setup();
		const due = new Date(clock.now().getTime() - 1000);
		await db.update(syncEvents).set({ nextAttemptAt: due });
		const globexCamP = await productOf(globex, "CAM-P");
		await db
			.update(syncEvents)
			.set({ nextAttemptAt: new Date(due.getTime() - 1) })
			.where(eq(syncEvents.productId, globexCamP.id));
		await worker.tick();
		await db
			.update(syncEvents)
			.set({ status: "pending", sentAt: null, nextAttemptAt: due });

		await worker.tick();

		expect(calls.map((call) => call.tenantId)).toEqual([globex, acme]);
	});

	it("claims at most SYNC_BATCH_SIZE events, lowest versions first", async () => {
		await discardSeedEvents();
		const camP = await productOf(acme, "CAM-P");
		const bon = await productOf(acme, "BON-01");
		await adjust(camP.id, 1);
		await createStockAdjustment(acme, acmeAdmin, bon.id, {
			direction: "in",
			quantity: 3,
			reason: "Restock",
		});
		const created = await createProduct(acme, acmeAdmin, {
			sku: "MEIA-01",
			name: "Meia",
			priceCents: 1500,
			stock: 7,
		});
		const { worker, calls } = setup({ overrides: { batchSize: 2 } });

		await worker.tick();
		await worker.tick();

		expect(calls.map((call) => call.items.map((item) => item.sku))).toEqual([
			["CAM-P", "BON-01"],
			["MEIA-01"],
		]);
		expect((await eventsOf(created.id))[0]?.status).toBe("sent");
	});
});

describe("crash mid-tick", () => {
	it("rolls back: the claimed events stay pending, due and untouched", async () => {
		await discardSeedEvents();
		const camP = await productOf(acme, "CAM-P");
		await adjust(camP.id, 1);
		await adjust(camP.id, 1);
		const before = (await eventsOf(camP.id)).slice(1);
		const clock = fakeClock();
		const worker = createSyncWorker({
			client: {
				async sendUpdates() {
					throw new Error("worker crashed");
				},
			},
			clock,
			random: () => 0.5,
			sleep: async () => {},
			config,
		});

		await expect(worker.tick()).rejects.toThrow("worker crashed");

		expect((await eventsOf(camP.id)).slice(1)).toEqual(before);
		expect(before.map((event) => event.status)).toEqual(["pending", "pending"]);
	});
});

describe("rate limit", () => {
	it("takes a token before each tick, spacing sends by 1000 / rate ms", async () => {
		const { worker, calls, sleeps } = setup({
			overrides: { rateLimitPerSecond: 5 },
		});

		await worker.tick();
		await worker.tick();
		const camP = await productOf(acme, "CAM-P");
		await adjust(camP.id, 1);
		await worker.tick();

		expect(calls.map((call) => call.tenantId)).toEqual([acme, globex, acme]);
		const [first, second, third] = calls.map((call) => call.at);
		expect([
			(second ?? 0) - (first ?? 0),
			(third ?? 0) - (second ?? 0),
		]).toEqual([200, 200]);
		expect(sleeps).toEqual([200, 200]);
	});
});

describe("token before the transaction", () => {
	it("holds no open transaction while waiting for a token", async () => {
		const clock = fakeClock();
		const { client } = fakeClient(clock);
		const openWhileWaiting: number[] = [];
		const worker = createSyncWorker({
			client,
			clock,
			random: () => 0.5,
			sleep: async (ms) => {
				const { rows } = await db.execute<{ open: number }>(
					sql`SELECT count(*)::int AS open FROM pg_stat_activity WHERE datname = current_database() AND state LIKE 'idle in transaction%'`,
				);
				openWhileWaiting.push(rows[0]?.open ?? -1);
				clock.advance(ms);
			},
			config: { ...config, rateLimitPerSecond: 5 },
		});

		await worker.tick();
		await worker.tick();

		expect(openWhileWaiting).toEqual([0]);
	});
});

describe("log", () => {
	it("binds the tenant and the batch id sent as the request id to every line", async () => {
		await discardSeedEvents();
		const camP = await productOf(acme, "CAM-P");
		await adjust(camP.id, 1);
		await adjust(camP.id, 1);
		const { worker, calls, lines } = setup();

		await worker.tick();

		const [call] = calls;
		expect(call?.requestId).toMatch(UUID);
		expect(lines()).toHaveLength(2);
		for (const line of lines()) {
			expect(line).toMatchObject({ tenantId: acme, batchId: call?.requestId });
		}
	});

	it("uses a new batch id for each batch", async () => {
		const { worker, calls } = setup();

		await worker.tick();
		await worker.tick();

		expect(calls).toHaveLength(2);
		expect(calls[0]?.requestId).not.toBe(calls[1]?.requestId);
	});

	it("logs the superseded and sent events with the service's counts", async () => {
		await discardSeedEvents();
		const camP = await productOf(acme, "CAM-P");
		const bon = await productOf(acme, "BON-01");
		await createStockAdjustment(acme, acmeAdmin, bon.id, {
			direction: "in",
			quantity: 1,
			reason: "Restock",
		});
		await adjust(camP.id, 1);
		await adjust(camP.id, 1);
		const [bonEvent] = (await eventsOf(bon.id)).slice(1);
		const [older, newer] = (await eventsOf(camP.id)).slice(1);
		const { worker, lines } = setup({
			results: [{ kind: "ok", outcome: { applied: 1, ignored: 1 } }],
		});

		await worker.tick();

		expect(lines()).toMatchObject([
			{
				level: LEVELS.debug,
				msg: "event superseded",
				sku: "CAM-P",
				version: older?.version,
				supersededBy: newer?.version,
			},
			{
				level: LEVELS.info,
				msg: "batch sent",
				items: [
					{ sku: "BON-01", version: bonEvent?.version },
					{ sku: "CAM-P", version: newer?.version },
				],
				applied: 1,
				ignored: 1,
				durationMs: 0,
			},
		]);
	});

	it("omits the counts when the service returns none", async () => {
		const event = await oneEvent();
		const { worker, lines } = setup();

		await worker.tick();

		const [line] = lines();
		expect(line).toMatchObject({
			level: LEVELS.info,
			msg: "batch sent",
			items: [{ sku: "CAM-P", version: event.version }],
		});
		expect(line).not.toHaveProperty("applied");
		expect(line).not.toHaveProperty("ignored");
	});

	it("logs the attempt and retry delay, then the move to failed", async () => {
		const event = await oneEvent();
		const failure: AdsResult = { kind: "error", error: "HTTP 500" };
		const { worker, clock, lines } = setup({
			results: [failure, failure],
			overrides: { maxAttempts: 2 },
		});

		await worker.tick();
		clock.advance(500);
		await worker.tick();

		const fields = {
			sku: "CAM-P",
			version: event.version,
			maxAttempts: 2,
			error: "HTTP 500",
		};
		expect(lines()).toMatchObject([
			{
				...fields,
				level: LEVELS.warn,
				msg: "event will retry",
				attempts: 1,
				retryInMs: 500,
			},
			{ ...fields, level: LEVELS.error, msg: "event failed", attempts: 2 },
		]);
		expect(lines()[1]).not.toHaveProperty("retryInMs");
	});

	it("logs the Retry-After of a rate-limited batch", async () => {
		const event = await oneEvent();
		const { worker, lines } = setup({
			results: [{ kind: "rate_limited", retryAfterMs: 2000 }],
		});

		await worker.tick();

		expect(lines()).toMatchObject([
			{
				level: LEVELS.warn,
				msg: "batch rate limited",
				items: [{ sku: "CAM-P", version: event.version }],
				retryAfterMs: 2000,
			},
		]);
	});
});

describe("run", () => {
	it("ticks while events are claimed, then waits the poll interval", async () => {
		const clock = fakeClock();
		const { calls, client } = fakeClient(clock);
		const controller = new AbortController();
		const sleeps: number[] = [];
		const worker = createSyncWorker({
			client,
			clock,
			random: () => 0.5,
			sleep: async (ms) => {
				sleeps.push(ms);
				clock.advance(ms);
				if (ms === config.pollIntervalMs) controller.abort();
			},
			config,
		});

		await worker.run(controller.signal);

		expect(calls.map((call) => call.tenantId)).toEqual([acme, globex]);
		expect(sleeps.filter((ms) => ms === config.pollIntervalMs)).toHaveLength(1);
		expect(sleeps.at(-1)).toBe(config.pollIntervalMs);
	});

	it("logs a failed tick once with its batch and keeps running", async () => {
		const clock = fakeClock();
		const controller = new AbortController();
		const memory = createMemoryLogger();
		const requestIds: string[] = [];
		let ticks = 0;
		const worker = createSyncWorker({
			client: {
				async sendUpdates(_tenantId, _items, requestId) {
					requestIds.push(requestId);
					ticks++;
					if (ticks === 1) throw new Error("connection reset");
					return { kind: "ok" };
				},
			},
			clock,
			random: () => 0.5,
			sleep: async (ms) => {
				if (ms === config.pollIntervalMs && ticks >= 3) controller.abort();
			},
			config,
			logger: memory.logger,
		});

		await worker.run(controller.signal);

		const failures = memory
			.lines()
			.filter((line) => line.level >= LEVELS.error);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatchObject({
			msg: "tick failed",
			batchId: requestIds[0],
			err: { message: "connection reset" },
		});
		expect(ticks).toBe(3);
		const statuses = await db
			.select({ status: syncEvents.status })
			.from(syncEvents);
		expect(statuses.every(({ status }) => status === "sent")).toBe(true);
	});

	it("logs a tick that fails before claiming without a batch id", async () => {
		const memory = createMemoryLogger();
		let reads = 0;
		const worker = createSyncWorker({
			client: fakeClient(fakeClock()).client,
			// The first read is the token bucket's; the second opens the claim.
			clock: {
				now: () => {
					reads++;
					if (reads === 2) throw new Error("clock broke");
					return new Date();
				},
			},
			random: () => 0.5,
			sleep: async () => {},
			config,
			logger: memory.logger,
		});

		await expect(worker.tick()).rejects.toThrow("clock broke");

		const [line] = memory.lines();
		expect(memory.lines()).toHaveLength(1);
		expect(line).toMatchObject({
			level: LEVELS.error,
			msg: "tick failed",
			err: { message: "clock broke" },
		});
		expect(line).not.toHaveProperty("batchId");
		expect(line).not.toHaveProperty("tenantId");
	});
});
