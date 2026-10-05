import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../../app.js";
import {
	ConflictError,
	formatZodIssues,
	NotFoundError,
	ValidationError,
} from "../../infra/errors.js";
import { errorHandler } from "./error-handler.js";

const bodySchema = z.object({
	name: z.string(),
	price: z.object({ amount: z.number() }),
});

function createTestApp() {
	const app = express();
	app.use(express.json());

	app.get("/not-found", () => {
		throw new NotFoundError();
	});
	app.get("/conflict", () => {
		throw new ConflictError("SKU already exists");
	});
	app.post("/validate", (req, res) => {
		const result = bodySchema.safeParse(req.body);
		if (!result.success)
			throw new ValidationError(formatZodIssues(result.error));
		res.json(result.data);
	});
	app.get("/unknown", () => {
		throw new Error("boom: SELECT * FROM users");
	});
	app.get("/async", async () => {
		await Promise.resolve();
		throw new ConflictError();
	});

	app.use(errorHandler);
	return app;
}

describe("errorHandler", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns the status, code and default message of an AppError subclass", async () => {
		const response = await request(createTestApp()).get("/not-found");

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			error: { code: "NOT_FOUND", message: "Resource not found" },
		});
	});

	it("returns a custom message passed to the subclass", async () => {
		const response = await request(createTestApp()).get("/conflict");

		expect(response.status).toBe(409);
		expect(response.body).toEqual({
			error: { code: "CONFLICT", message: "SKU already exists" },
		});
	});

	it("returns 400 with every Zod issue joined as path: message", async () => {
		const response = await request(createTestApp())
			.post("/validate")
			.send({ name: 1, price: { amount: "ten" } });

		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			error: {
				code: "VALIDATION_ERROR",
				message:
					"name: Invalid input: expected string, received number; price.amount: Invalid input: expected number, received string",
			},
		});
	});

	it("returns a generic 500 for unknown errors without leaking details", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});

		const response = await request(createTestApp()).get("/unknown");

		expect(response.status).toBe(500);
		expect(response.body).toEqual({
			error: {
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
			},
		});
		expect(response.text).not.toContain("boom");
	});

	it("handles errors thrown inside async routes", async () => {
		const response = await request(createTestApp()).get("/async");

		expect(response.status).toBe(409);
		expect(response.body).toEqual({
			error: {
				code: "CONFLICT",
				message: "Request conflicts with the current state",
			},
		});
	});
});

describe("createApp", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers the error handler", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});

		const response = await request(createApp())
			.post("/health")
			.set("Content-Type", "application/json")
			.send("{");

		expect(response.status).toBe(500);
		expect(response.body).toEqual({
			error: {
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
			},
		});
	});

	it("returns 404 for an unknown path", async () => {
		const response = await request(createApp()).get("/unknown?page=2");

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			error: { code: "NOT_FOUND", message: "Route GET /unknown not found" },
		});
	});

	it("returns 404 for an unsupported method on a known path", async () => {
		const response = await request(createApp()).delete("/health");

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			error: { code: "NOT_FOUND", message: "Route DELETE /health not found" },
		});
	});
});
