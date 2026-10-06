import { eq } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../infra/db.js";
import { env } from "../../infra/env.js";
import { users } from "../../infra/schemas/users.js";
import { seed } from "../../infra/seed/seed.js";
import {
	createMemoryLogger,
	LEVELS,
	type LogLine,
} from "../../infra/test/memory-logger.js";
import { genReqId } from "./http-logger.js";

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL = "admin@acme.test";
const PASSWORD = "acme-admin-password";

function setup() {
	const memory = createMemoryLogger();
	const app = createApp({ logger: memory.logger });

	// The access line is written on the response's finish event, which can
	// land just after supertest resolves.
	async function accessLine(requestId: string | undefined): Promise<LogLine> {
		return vi.waitFor(() => {
			const line = memory
				.lines()
				.find(
					(l) =>
						"responseTime" in l &&
						(l.req as { id?: string } | undefined)?.id === requestId,
				);
			if (!line) throw new Error(`no access line for ${requestId}`);
			return line;
		});
	}

	return { app, memory, accessLine };
}

async function login(app: ReturnType<typeof createApp>) {
	const response = await request(app)
		.post("/api/v1/auth/login")
		.send({ email: EMAIL, password: PASSWORD });
	const cookie = response.headers["set-cookie"]?.[0]?.split(";")[0] ?? "";
	return { response, cookie, token: cookie.split("=")[1] ?? "" };
}

beforeEach(async () => {
	await seed(db);
});

describe("request id", () => {
	it("generates a UUID when the request has none", async () => {
		const { app, accessLine } = setup();

		const response = await request(app).get("/health");

		expect(response.headers["x-request-id"]).toMatch(UUID);
		await accessLine(response.headers["x-request-id"]);
	});

	it.each(["abc-123", "trace.ID_9", "a".repeat(128)])(
		"echoes the valid incoming id %s",
		async (id) => {
			const { app, accessLine } = setup();

			const response = await request(app)
				.get("/health")
				.set("X-Request-Id", id);

			expect(response.headers["x-request-id"]).toBe(id);
			await accessLine(id);
		},
	);

	it.each([
		["too long", "a".repeat(129)],
		["with spaces", "abc 123"],
		["with a tab", "abc\t123"],
		["with other characters", "abc/123"],
		["empty", ""],
	])("replaces an incoming id %s with a UUID", async (_case, id) => {
		const { app } = setup();

		const response = await request(app).get("/health").set("X-Request-Id", id);

		expect(response.headers["x-request-id"]).toMatch(UUID);
	});

	// Node refuses to send a header with a newline, so the rule is checked on
	// the function itself.
	it("replaces an incoming id with a newline with a UUID", () => {
		const req = { headers: { "x-request-id": "abc\n123" } };
		const headers: Record<string, string> = {};
		const res = { setHeader: (k: string, v: string) => (headers[k] = v) };

		const id = genReqId(req as never, res as never);

		expect(id).toMatch(UUID);
		expect(headers["X-Request-Id"]).toBe(id);
	});

	it("lets a cross-origin browser read the header", async () => {
		const { app } = setup();

		const response = await request(app)
			.get("/health")
			.set("Origin", env.CORS_ORIGIN);

		const exposed = response.headers["access-control-expose-headers"] ?? "";
		expect(exposed.split(",").map((h: string) => h.trim())).toContain(
			"X-Request-Id",
		);
	});
});

describe("access line", () => {
	it("carries the request id, status, response time and the caller", async () => {
		const { app, accessLine } = setup();
		const { cookie } = await login(app);
		const [user] = await db.select().from(users).where(eq(users.email, EMAIL));

		const response = await request(app)
			.get("/api/v1/products?page=1")
			.set("Cookie", cookie);
		const line = await accessLine(response.headers["x-request-id"]);

		expect(response.status).toBe(200);
		expect(line).toMatchObject({
			level: LEVELS.info,
			msg: "GET /api/v1/products?page=1 200",
			req: {
				id: response.headers["x-request-id"],
				method: "GET",
				url: "/api/v1/products?page=1",
			},
			res: { statusCode: 200 },
			tenantId: user?.tenantId,
			userId: user?.id,
			role: "admin",
		});
		expect(line.responseTime).toEqual(expect.any(Number));
	});

	it("has no caller fields on a 401", async () => {
		const { app, accessLine } = setup();

		const response = await request(app)
			.get("/api/v1/products")
			.set("Cookie", "access_token=not-a-jwt");
		const line = await accessLine(response.headers["x-request-id"]);

		expect(response.status).toBe(401);
		expect(line).toMatchObject({ res: { statusCode: 401 } });
		expect(line).not.toHaveProperty("tenantId");
		expect(line).not.toHaveProperty("userId");
		expect(line).not.toHaveProperty("role");
	});

	it.each([
		["a successful request", "get", "/api/v1/products", true, 200, "info"],
		["a 401", "get", "/api/v1/products", false, 401, "warn"],
		["a 404", "get", "/unknown", false, 404, "warn"],
		["a successful /health", "get", "/health", false, 200, "debug"],
		[
			"a successful /health with a query",
			"get",
			"/health?x=1",
			false,
			200,
			"debug",
		],
		["an unexpected error", "post", "/health", false, 500, "error"],
	] as const)(
		"logs %s at the matching level",
		async (_case, method, path, authenticated, status, level) => {
			const { app, accessLine } = setup();
			const { cookie } = authenticated ? await login(app) : { cookie: "" };

			let req = request(app)[method](path);
			if (cookie) req = req.set("Cookie", cookie);
			if (method === "post")
				req = req.set("Content-Type", "application/json").send("{");
			const response = await req;
			const line = await accessLine(response.headers["x-request-id"]);

			expect(response.status).toBe(status);
			expect(line.level).toBe(LEVELS[level]);
		},
	);
});

describe("unexpected errors", () => {
	it("keeps the generic body and writes one error line with the stack", async () => {
		const { app, memory, accessLine } = setup();

		const response = await request(app)
			.post("/health")
			.set("Content-Type", "application/json")
			.send("{");
		const id = response.headers["x-request-id"];
		await accessLine(id);

		expect(response.status).toBe(500);
		expect(response.body).toEqual({
			error: {
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
			},
		});
		expect(response.text).not.toContain(id);
		const errorLines = memory
			.lines()
			.filter((line) => line.level >= LEVELS.error);
		expect(errorLines).toHaveLength(1);
		expect(errorLines[0]).toMatchObject({
			msg: "POST /health 500",
			req: { id },
			err: { stack: expect.stringContaining("SyntaxError") },
		});
	});
});

describe("secrets", () => {
	it("never logs the body of a request that fails unexpectedly", async () => {
		const { app, memory, accessLine } = setup();

		const response = await request(app)
			.post("/health")
			.set("Content-Type", "application/json")
			.send(`{"password":"${PASSWORD}"`);
		await accessLine(response.headers["x-request-id"]);

		expect(response.status).toBe(500);
		expect(memory.raw()).not.toContain(PASSWORD);
		expect(memory.lines()[0]?.err).toEqual({
			type: "SyntaxError",
			message: expect.any(String),
			stack: expect.any(String),
		});
	});

	it("never logs the cookie, the password, Set-Cookie or a body", async () => {
		const { app, memory, accessLine } = setup();

		const { response: loginResponse, token } = await login(app);
		const me = await request(app)
			.get("/api/v1/auth/me")
			.set("Cookie", `access_token=${token}`)
			.set("Authorization", `Bearer ${token}`);
		await accessLine(loginResponse.headers["x-request-id"]);
		await accessLine(me.headers["x-request-id"]);

		const raw = memory.raw();
		expect(token).not.toBe("");
		expect(raw).not.toContain(token);
		expect(raw).not.toContain(PASSWORD);
		expect(raw).not.toContain(EMAIL);
		expect(raw.toLowerCase()).not.toContain("set-cookie");
		expect(raw.toLowerCase()).not.toContain("headers");
		expect(raw).not.toContain('"body"');
	});
});
