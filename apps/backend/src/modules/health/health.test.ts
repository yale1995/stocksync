import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { healthSchema } from "../../http/controllers/health.validation.js";

describe("GET /health", () => {
	it("returns ok", async () => {
		const response = await request(createApp()).get("/health");

		expect(response.status).toBe(200);
		healthSchema.parse(response.body);
		expect(response.body).toEqual({ status: "ok" });
	});
});
