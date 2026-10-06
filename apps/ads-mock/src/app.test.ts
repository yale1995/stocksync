import { Writable } from "node:stream";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { type AppOptions, createApp } from "./app.js";
import { loggerOptions } from "./logger.js";

const API_KEY = "test-api-key";
const ACME = "0199a000-0000-7000-8000-000000000001";
const GLOBEX = "0199a000-0000-7000-8000-000000000002";
const NOW = Date.parse("2026-10-05T12:00:00.000Z");

function setup(options: Partial<AppOptions> = {}) {
	let current = NOW;
	const app = createApp({
		apiKey: API_KEY,
		failureRate: 0,
		rateLimitPerSecond: 1000,
		timeoutDelayMs: 20,
		random: () => 0.99,
		now: () => current,
		...options,
	});
	return {
		advance(ms: number) {
			current += ms;
		},
		post(body: unknown, key: string | null = API_KEY) {
			const req = request(app).post("/updates");
			return key === null
				? req.send(body as object)
				: req.set("X-Api-Key", key).send(body as object);
		},
		ads(tenantId: string, key: string | null = API_KEY) {
			const req = request(app).get("/ads").query({ tenantId });
			return key === null ? req : req.set("X-Api-Key", key);
		},
	};
}

function item(
	overrides: Partial<{
		sku: string;
		stock: number;
		priceCents: number;
		version: number;
	}> = {},
) {
	return {
		sku: "CAM-P",
		stock: 10,
		priceCents: 4990,
		version: 1,
		...overrides,
	};
}

// Returns the given values in order, then repeats the last one.
function sequence(...values: number[]) {
	let index = 0;
	return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

describe("POST /updates", () => {
	it("applies new items and responds with the counts", async () => {
		const mock = setup();

		const response = await mock
			.post({
				tenantId: ACME,
				items: [item(), item({ sku: "BON-01", stock: 0, version: 2 })],
			})
			.expect(200);

		expect(response.body).toEqual({ applied: 2, ignored: 0 });
		const ads = await mock.ads(ACME).expect(200);
		expect(ads.body).toEqual({
			ads: [
				{
					sku: "BON-01",
					stock: 0,
					priceCents: 4990,
					version: 2,
					updatedAt: "2026-10-05T12:00:00.000Z",
				},
				{
					sku: "CAM-P",
					stock: 10,
					priceCents: 4990,
					version: 1,
					updatedAt: "2026-10-05T12:00:00.000Z",
				},
			],
		});
	});

	it.each([
		["an older", 4],
		["an equal", 5],
	])(
		"ignores %s version and keeps the stored state",
		async (_label, version) => {
			const mock = setup();
			await mock
				.post({ tenantId: ACME, items: [item({ stock: 7, version: 5 })] })
				.expect(200);
			mock.advance(1000);

			const response = await mock
				.post({
					tenantId: ACME,
					items: [item({ stock: 1, priceCents: 1, version })],
				})
				.expect(200);

			expect(response.body).toEqual({ applied: 0, ignored: 1 });
			const ads = await mock.ads(ACME);
			expect(ads.body.ads).toEqual([
				{
					sku: "CAM-P",
					stock: 7,
					priceCents: 4990,
					version: 5,
					updatedAt: "2026-10-05T12:00:00.000Z",
				},
			]);
		},
	);

	it("applies a newer version", async () => {
		const mock = setup();
		await mock
			.post({ tenantId: ACME, items: [item({ version: 5 })] })
			.expect(200);
		mock.advance(1000);

		await mock
			.post({ tenantId: ACME, items: [item({ stock: 3, version: 6 })] })
			.expect(200);

		const ads = await mock.ads(ACME);
		expect(ads.body.ads).toEqual([
			{
				sku: "CAM-P",
				stock: 3,
				priceCents: 4990,
				version: 6,
				updatedAt: "2026-10-05T12:00:01.000Z",
			},
		]);
	});

	it("applies the same SKU twice in one batch against the state left by the first", async () => {
		const mock = setup();

		const response = await mock
			.post({
				tenantId: ACME,
				items: [
					item({ stock: 1, version: 2 }),
					item({ stock: 2, version: 1 }),
					item({ stock: 3, version: 3 }),
				],
			})
			.expect(200);

		expect(response.body).toEqual({ applied: 2, ignored: 1 });
		expect((await mock.ads(ACME)).body.ads).toMatchObject([
			{ stock: 3, version: 3 },
		]);
	});

	it("stores the same SKU of two tenants independently", async () => {
		const mock = setup();

		await mock
			.post({ tenantId: ACME, items: [item({ stock: 25, version: 10 })] })
			.expect(200);
		await mock
			.post({
				tenantId: GLOBEX,
				items: [item({ stock: 4, priceCents: 5490, version: 3 })],
			})
			.expect(200);

		expect((await mock.ads(ACME)).body.ads).toMatchObject([
			{ sku: "CAM-P", stock: 25, priceCents: 4990, version: 10 },
		]);
		expect((await mock.ads(GLOBEX)).body.ads).toMatchObject([
			{ sku: "CAM-P", stock: 4, priceCents: 5490, version: 3 },
		]);
	});

	it.each([
		["a missing tenantId", { items: [item()] }],
		["a tenantId that is not a uuid", { tenantId: "acme", items: [item()] }],
		["no items", { tenantId: ACME, items: [] }],
		[
			"more than 100 items",
			{
				tenantId: ACME,
				items: Array.from({ length: 101 }, (_, i) => item({ version: i + 1 })),
			},
		],
		["an empty sku", { tenantId: ACME, items: [item({ sku: "" })] }],
		["negative stock", { tenantId: ACME, items: [item({ stock: -1 })] }],
		["fractional stock", { tenantId: ACME, items: [item({ stock: 1.5 })] }],
		["negative price", { tenantId: ACME, items: [item({ priceCents: -1 })] }],
		[
			"fractional price",
			{ tenantId: ACME, items: [item({ priceCents: 49.9 })] },
		],
		["version 0", { tenantId: ACME, items: [item({ version: 0 })] }],
		[
			"a fractional version",
			{ tenantId: ACME, items: [item({ version: 1.5 })] },
		],
		[
			"a missing version",
			{ tenantId: ACME, items: [{ sku: "CAM-P", stock: 1, priceCents: 1 }] },
		],
	])("responds 400 for %s and applies nothing", async (_label, body) => {
		const mock = setup();

		await mock.post(body).expect(400);

		expect((await mock.ads(ACME)).body.ads).toEqual([]);
	});

	it("accepts exactly 100 items", async () => {
		const mock = setup();
		const items = Array.from({ length: 100 }, (_, i) =>
			item({ sku: `SKU-${i}` }),
		);

		const response = await mock.post({ tenantId: ACME, items }).expect(200);

		expect(response.body).toEqual({ applied: 100, ignored: 0 });
	});

	it("responds 400 for a body that is not JSON", async () => {
		const mock = setup();

		await mock
			.post("{not json")
			.set("Content-Type", "application/json")
			.expect(400, { error: "Invalid JSON body" });
	});
});

describe("API key", () => {
	it.each([
		["missing", null],
		["wrong", "other-key"],
	])("responds 401 on both routes when the key is %s", async (_label, key) => {
		const mock = setup();

		await mock
			.post({ tenantId: ACME, items: [item()] }, key)
			.expect(401, { error: "Invalid API key" });
		await mock.ads(ACME, key).expect(401, { error: "Invalid API key" });
		expect((await mock.ads(ACME)).body.ads).toEqual([]);
	});
});

describe("GET /ads", () => {
	it("responds 400 when tenantId is not a uuid", async () => {
		await setup().ads("acme").expect(400);
	});

	it("is not rate limited", async () => {
		const mock = setup({ rateLimitPerSecond: 1 });
		await mock.post({ tenantId: ACME, items: [item()] }).expect(200);

		for (let i = 0; i < 3; i++) await mock.ads(ACME).expect(200);
	});
});

describe("rate limit", () => {
	it("responds 429 with Retry-After above the limit across tenants, without applying", async () => {
		const mock = setup({ rateLimitPerSecond: 5 });
		for (let i = 0; i < 5; i++) {
			const tenantId = i % 2 === 0 ? ACME : GLOBEX;
			await mock
				.post({ tenantId, items: [item({ sku: `SKU-${i}` })] })
				.expect(200);
		}

		const response = await mock
			.post({ tenantId: GLOBEX, items: [item({ sku: "LATE" })] })
			.expect(429);

		expect(response.headers["retry-after"]).toBe("1");
		expect(
			(await mock.ads(GLOBEX)).body.ads.map((ad: { sku: string }) => ad.sku),
		).toEqual(["SKU-1", "SKU-3"]);
	});

	it("accepts again once the window has passed", async () => {
		const mock = setup({ rateLimitPerSecond: 2 });
		await mock
			.post({ tenantId: ACME, items: [item({ version: 1 })] })
			.expect(200);
		mock.advance(400);
		await mock
			.post({ tenantId: ACME, items: [item({ version: 2 })] })
			.expect(200);
		await mock
			.post({ tenantId: ACME, items: [item({ version: 3 })] })
			.expect(429);

		mock.advance(599);
		await mock
			.post({ tenantId: ACME, items: [item({ version: 3 })] })
			.expect(429);
		mock.advance(1);
		await mock
			.post({ tenantId: ACME, items: [item({ version: 3 })] })
			.expect(200);
		await mock
			.post({ tenantId: ACME, items: [item({ version: 4 })] })
			.expect(429);
	});

	it("does not count rejected requests", async () => {
		const mock = setup({ rateLimitPerSecond: 1 });
		await mock.post({ tenantId: ACME, items: [item()] }, "wrong").expect(401);
		await mock.post({ tenantId: ACME, items: [item()] }).expect(200);
		await mock
			.post({ tenantId: ACME, items: [item({ version: 2 })] })
			.expect(429);
		mock.advance(1000);

		await mock
			.post({ tenantId: ACME, items: [item({ version: 2 })] })
			.expect(200);
	});

	it("rounds Retry-After up to whole seconds", async () => {
		const mock = setup({ rateLimitPerSecond: 1 });
		await mock.post({ tenantId: ACME, items: [item()] }).expect(200);
		mock.advance(1);

		const response = await mock
			.post({ tenantId: ACME, items: [item({ version: 2 })] })
			.expect(429);

		expect(response.headers["retry-after"]).toBe("1");
	});
});

describe("failures", () => {
	it("responds 500 immediately without applying", async () => {
		const mock = setup({ failureRate: 0.2, random: sequence(0.1, 0.1) });

		await mock.post({ tenantId: ACME, items: [item()] }).expect(500);

		expect((await mock.ads(ACME)).body.ads).toEqual([]);
	});

	it("holds the response for the timeout delay, then responds 500 without applying", async () => {
		const mock = setup({
			failureRate: 0.2,
			timeoutDelayMs: 50,
			random: sequence(0.1, 0.5),
		});

		const started = performance.now();
		await mock.post({ tenantId: ACME, items: [item()] }).expect(500);

		expect(performance.now() - started).toBeGreaterThanOrEqual(45);
		expect((await mock.ads(ACME)).body.ads).toEqual([]);
	});

	it("applies the batch, then responds 500", async () => {
		const mock = setup({ failureRate: 0.2, random: sequence(0.1, 0.9) });

		await mock
			.post({ tenantId: ACME, items: [item({ stock: 8, version: 4 })] })
			.expect(500);

		expect((await mock.ads(ACME)).body.ads).toMatchObject([
			{ sku: "CAM-P", stock: 8, version: 4 },
		]);
	});

	it("ignores the retried delivery of a batch applied before a 500", async () => {
		const mock = setup({ failureRate: 0.2, random: sequence(0.1, 0.9, 0.99) });
		const body = { tenantId: ACME, items: [item({ version: 4 })] };
		await mock.post(body).expect(500);

		const retry = await mock.post(body).expect(200);

		expect(retry.body).toEqual({ applied: 0, ignored: 1 });
	});

	it("does not fail when the draw is at or above the failure rate", async () => {
		const mock = setup({ failureRate: 0.2, random: sequence(0.2) });

		await mock.post({ tenantId: ACME, items: [item()] }).expect(200);
	});

	it("never fails with a failure rate of 0", async () => {
		const mock = setup({ failureRate: 0, random: sequence(0) });

		for (let i = 1; i <= 20; i++) {
			await mock
				.post({ tenantId: ACME, items: [item({ version: i })] })
				.expect(200);
		}
	});

	it("fails every request with a failure rate of 1", async () => {
		const mock = setup({ failureRate: 1, random: sequence(0.99, 0.1) });

		await mock.post({ tenantId: ACME, items: [item()] }).expect(500);
	});
});

type LogLine = Record<string, unknown> & {
	level: number;
	msg?: string;
	req?: { id?: string };
};

function memoryLogger() {
	const chunks: string[] = [];
	const logger = pino(
		{ ...loggerOptions, level: "trace" },
		new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(chunk.toString());
				callback();
			},
		}),
	);
	const lines = (): LogLine[] =>
		chunks
			.join("")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));
	// The access line is written on the response's finish event, which can
	// land just after supertest resolves.
	const accessLine = (id: string) =>
		vi.waitFor(() => {
			const line = lines().find((l) => "responseTime" in l && l.req?.id === id);
			if (!line) throw new Error(`no access line for ${id}`);
			return line;
		});
	return { logger, lines, accessLine, raw: () => chunks.join("") };
}

const REQUEST_ID = "0199a000-0000-4000-8000-0000000000aa";

describe("logs", () => {
	it("echoes the incoming request id and logs it on the access and outcome lines", async () => {
		const memory = memoryLogger();
		const mock = setup({ logger: memory.logger });

		const response = await mock
			.post({ tenantId: ACME, items: [item(), item({ sku: "BON-01" })] })
			.set("X-Request-Id", REQUEST_ID);
		const access = await memory.accessLine(REQUEST_ID);

		expect(response.headers["x-request-id"]).toBe(REQUEST_ID);
		expect(access).toMatchObject({
			level: pino.levels.values.info,
			msg: "POST /updates 200",
			req: { id: REQUEST_ID, method: "POST", url: "/updates" },
			res: { statusCode: 200 },
		});
		const outcome = memory.lines().filter((l) => l.msg === "updates handled");
		expect(outcome).toEqual([
			expect.objectContaining({
				req: expect.objectContaining({ id: REQUEST_ID }),
				tenantId: ACME,
				items: 2,
				outcome: "applied",
				applied: 2,
				ignored: 0,
			}),
		]);
	});

	it.each([
		["error", sequence(0.1, 0.1)],
		["timeout", sequence(0.1, 0.5)],
		["apply-then-error", sequence(0.1, 0.9)],
	] as const)(
		"names the simulated %s on the outcome line",
		async (mode, random) => {
			const memory = memoryLogger();
			const mock = setup({ logger: memory.logger, failureRate: 0.2, random });

			const response = await mock
				.post({ tenantId: ACME, items: [item()] })
				.set("X-Request-Id", REQUEST_ID);
			await memory.accessLine(REQUEST_ID);

			expect(response.status).toBe(500);
			const outcome = memory.lines().filter((l) => l.msg === "updates handled");
			expect(outcome).toEqual([
				expect.objectContaining({
					level: pino.levels.values.warn,
					req: expect.objectContaining({ id: REQUEST_ID }),
					tenantId: ACME,
					items: 1,
					outcome: mode,
				}),
			]);
			expect(outcome[0]).not.toHaveProperty("applied");
		},
	);

	it.each([
		["401", API_KEY.replace("test", "wrong"), 1000, 401],
		["429", API_KEY, 1, 429],
	] as const)(
		"writes only the access line on a %s",
		async (_case, key, rate, status) => {
			const memory = memoryLogger();
			const mock = setup({ logger: memory.logger, rateLimitPerSecond: rate });
			if (status === 429) await mock.post({ tenantId: ACME, items: [item()] });

			const response = await mock
				.post({ tenantId: ACME, items: [item({ version: 2 })] }, key)
				.set("X-Request-Id", REQUEST_ID);
			await memory.accessLine(REQUEST_ID);

			expect(response.status).toBe(status);
			const lines = memory.lines().filter((l) => l.req?.id === REQUEST_ID);
			expect(lines).toHaveLength(1);
			expect(lines[0]).toMatchObject({
				level: pino.levels.values.warn,
				res: { statusCode: status },
			});
		},
	);

	it("generates an id when the incoming one is invalid", async () => {
		const memory = memoryLogger();
		const mock = setup({ logger: memory.logger });

		const response = await mock
			.post({ tenantId: ACME, items: [item()] })
			.set("X-Request-Id", "not valid");

		expect(response.headers["x-request-id"]).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		await memory.accessLine(response.headers["x-request-id"] ?? "");
	});

	it("never logs the API key", async () => {
		const memory = memoryLogger();
		const mock = setup({ logger: memory.logger });

		await mock
			.post({ tenantId: ACME, items: [item()] })
			.set("X-Request-Id", REQUEST_ID);
		await mock.ads(ACME, "wrong-key").set("X-Request-Id", "second");
		await memory.accessLine(REQUEST_ID);
		await memory.accessLine("second");

		expect(memory.raw()).not.toContain(API_KEY);
		expect(memory.raw()).not.toContain("wrong-key");
		expect(memory.raw().toLowerCase()).not.toContain("x-api-key");
	});
});
