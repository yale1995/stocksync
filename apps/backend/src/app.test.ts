import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { db } from "./infra/db.js";
import { env } from "./infra/env.js";
import { seed } from "./infra/seed/seed.js";

describe("CORS", () => {
	it("allows credentialed requests from CORS_ORIGIN", async () => {
		const response = await request(createApp())
			.options("/api/v1/auth/login")
			.set("Origin", env.CORS_ORIGIN)
			.set("Access-Control-Request-Method", "POST");

		expect(response.status).toBe(204);
		expect(response.headers["access-control-allow-origin"]).toBe(
			"http://localhost:5173",
		);
		expect(response.headers["access-control-allow-credentials"]).toBe("true");
	});
});

describe("versioning", () => {
	beforeEach(async () => {
		await seed(db);
	});

	it("serves the API under /api/v1 with the login cookie", async () => {
		const login = await request(createApp())
			.post("/api/v1/auth/login")
			.send({ email: "admin@acme.test", password: "acme-admin-password" });
		const cookie = login.headers["set-cookie"]?.[0]?.split(";")[0] ?? "";

		const response = await request(createApp())
			.get("/api/v1/products")
			.set("Cookie", cookie);

		expect(login.status).toBe(200);
		expect(response.status).toBe(200);
		expect(response.body.meta.total).toBe(2);
	});

	it.each([
		["post", "/auth/login"],
		["post", "/auth/logout"],
		["get", "/auth/me"],
		["get", "/products"],
		["post", "/sales"],
		["get", "/sync/status"],
		[
			"post",
			"/products/0190a8e2-0000-7000-8000-000000000000/stock-adjustments",
		],
		["get", "/products/0190a8e2-0000-7000-8000-000000000000/stock-movements"],
	] as const)(
		"answers 404 to %s %s without the prefix",
		async (method, path) => {
			const response = await request(createApp())[method](path);

			expect(response.status).toBe(404);
			expect(response.body.error.code).toBe("NOT_FOUND");
		},
	);

	it("serves /health at the root only", async () => {
		const root = await request(createApp()).get("/health");
		const versioned = await request(createApp()).get("/api/v1/health");

		expect(root.status).toBe(200);
		expect(root.body).toEqual({ status: "ok" });
		expect(versioned.status).toBe(404);
		expect(versioned.body.error.code).toBe("NOT_FOUND");
	});

	it("answers 404 NOT_FOUND to an unknown route under /api/v1", async () => {
		const response = await request(createApp()).get("/api/v1/unknown");

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			error: {
				code: "NOT_FOUND",
				message: "Route GET /api/v1/unknown not found",
			},
		});
	});
});
