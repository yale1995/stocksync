import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { env } from "./infra/env.js";

describe("CORS", () => {
	it("allows credentialed requests from CORS_ORIGIN", async () => {
		const response = await request(createApp())
			.options("/auth/login")
			.set("Origin", env.CORS_ORIGIN)
			.set("Access-Control-Request-Method", "POST");

		expect(response.status).toBe(204);
		expect(response.headers["access-control-allow-origin"]).toBe(
			"http://localhost:5173",
		);
		expect(response.headers["access-control-allow-credentials"]).toBe("true");
	});
});
