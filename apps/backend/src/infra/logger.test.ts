import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";
import { formatMessage, prettyDestination, prettyOptions } from "./pretty.js";
import { createMemoryLogger } from "./test/memory-logger.js";

const validEnv = {
	PORT: "3000",
	DATABASE_URL: "postgres://user:pass@localhost:5432/db",
	JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
	CORS_ORIGIN: "http://localhost:5173",
	ADS_API_URL: "http://localhost:4000",
	ADS_API_KEY: "key",
};

describe("LOG_LEVEL", () => {
	it("defaults to info", () => {
		expect(envSchema.parse(validEnv).LOG_LEVEL).toBe("info");
	});

	it.each(["fatal", "error", "warn", "info", "debug", "trace", "silent"])(
		"accepts %s",
		(level) => {
			expect(envSchema.parse({ ...validEnv, LOG_LEVEL: level }).LOG_LEVEL).toBe(
				level,
			);
		},
	);

	it.each(["verbose", "INFO", ""])("rejects %j", (level) => {
		expect(envSchema.safeParse({ ...validEnv, LOG_LEVEL: level }).success).toBe(
			false,
		);
	});
});

describe("pretty output", () => {
	it("is used only in development", async () => {
		expect(await prettyDestination("development")).toBeDefined();
		expect(await prettyDestination("test")).toBeUndefined();
		expect(await prettyDestination("production")).toBeUndefined();
	});

	it("leads an access line with the short request id and ends with the time", () => {
		const message = formatMessage(
			{
				msg: "GET /api/v1/products 200",
				req: { id: "09894ae7-280d-4912-bd65-865ae28aa965" },
				responseTime: 12,
			},
			"msg",
		);

		expect(message).toBe("[09894ae7] GET /api/v1/products 200 12ms");
	});

	it("leads a worker line with the short batch id", () => {
		const message = formatMessage(
			{ msg: "batch sent", batchId: "5f2c9a1e-7b3d-4c11-9e2a-0d4f6b8c1a22" },
			"msg",
		);

		expect(message).toBe("[5f2c9a1e] batch sent");
	});

	it("prints one line and hides the fields already in the message", () => {
		expect(prettyOptions.singleLine).toBe(true);
		expect(String(prettyOptions.ignore).split(",")).toEqual([
			"pid",
			"hostname",
			"req",
			"res",
			"responseTime",
			"component",
			"tenantId",
			"batchId",
		]);
	});

	it("leaves a line without an id as it is", () => {
		expect(formatMessage({ msg: "stocksync-api listening" }, "msg")).toBe(
			"stocksync-api listening",
		);
	});
});

describe("redact", () => {
	it("censors secret headers even if a serializer passes them through", () => {
		const memory = createMemoryLogger();

		memory.logger.info({
			req: {
				headers: {
					cookie: "access_token=secret-cookie",
					authorization: "Bearer secret-token",
					"x-api-key": "secret-key",
				},
			},
			res: { headers: { "set-cookie": "access_token=secret-set-cookie" } },
		});

		expect(memory.lines()[0]).toMatchObject({
			req: {
				headers: {
					cookie: "[Redacted]",
					authorization: "[Redacted]",
					"x-api-key": "[Redacted]",
				},
			},
			res: { headers: { "set-cookie": "[Redacted]" } },
		});
		expect(memory.raw()).not.toContain("secret");
	});
});

describe("errors", () => {
	it("logs only the type, message and stack of an error", () => {
		const memory = createMemoryLogger();
		const err = Object.assign(new Error("boom"), {
			body: "secret-body",
			detail: "secret-detail",
		});

		memory.logger.error({ err }, "tick failed");

		expect(memory.lines()[0]?.err).toEqual({
			type: "Error",
			message: "boom",
			stack: expect.any(String),
		});
		expect(memory.raw()).not.toContain("secret");
	});
});
