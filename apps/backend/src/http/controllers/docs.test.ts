import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRoutes, createApp } from "../../app.js";
import { seedTenants } from "../../infra/seed/seed.js";

type RouteLayer = {
	route?: { path: string; methods: Record<string, boolean> };
};

function toOpenApiPath(mountPath: string, routePath: string): string {
	const joined = `${mountPath}${routePath === "/" ? "" : routePath}`;
	return joined.replace(/:(\w+)/g, "{$1}");
}

function registeredOperations(): string[] {
	return apiRoutes
		.flatMap(({ path, router }) =>
			(router.stack as RouteLayer[]).flatMap((layer) =>
				layer.route
					? Object.keys(layer.route.methods).map(
							(method) =>
								`${method.toUpperCase()} ${toOpenApiPath(path, layer.route?.path ?? "")}`,
						)
					: [],
			),
		)
		.sort();
}

function documentedOperations(paths: Record<string, object>): string[] {
	return Object.entries(paths)
		.flatMap(([path, item]) =>
			Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`),
		)
		.sort();
}

describe("GET /openapi.json", () => {
	it("returns the OpenAPI 3.1.0 document without a cookie", async () => {
		const response = await request(createApp()).get("/openapi.json");

		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/^application\/json/);
		expect(response.body.openapi).toBe("3.1.0");
	});

	it("documents every mounted route and nothing else", async () => {
		const response = await request(createApp()).get("/openapi.json");

		expect(documentedOperations(response.body.paths)).toEqual(
			registeredOperations(),
		);
	});

	it("leaves the docs routes out of the document", async () => {
		const response = await request(createApp()).get("/openapi.json");

		expect(Object.keys(response.body.paths)).not.toContain("/docs");
		expect(Object.keys(response.body.paths)).not.toContain("/openapi.json");
	});

	it("shows the seeded users outside production", async () => {
		const response = await request(createApp()).get("/openapi.json");

		expect(response.body.info.description).toContain("admin@acme.test");
	});
});

describe("in production", () => {
	afterEach(() => {
		vi.doUnmock("../../infra/env.js");
		vi.resetModules();
	});

	it("serves a document without seeded emails or passwords", async () => {
		vi.resetModules();
		const { env } = await import("../../infra/env.js");
		vi.doMock("../../infra/env.js", () => ({
			env: { ...env, NODE_ENV: "production" },
		}));
		const { docsRouter } = await import("./docs.controller.js");
		const app = express().use(docsRouter);

		const response = await request(app).get("/openapi.json");

		expect(response.status).toBe(200);
		const served = JSON.stringify(response.body);
		for (const { email, password } of seedTenants.flatMap((t) => t.users)) {
			expect(served).not.toContain(email);
			expect(served).not.toContain(password);
		}
	});
});

describe("GET /docs", () => {
	it("returns the Scalar page pointing to /openapi.json without a cookie", async () => {
		const response = await request(createApp()).get("/docs");

		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toMatch(/^text\/html/);
		expect(response.text).toContain("@scalar/api-reference");
		expect(response.text).toContain("/openapi.json");
	});

	it("selects HTTPie as the default HTTP client", async () => {
		const response = await request(createApp()).get("/docs");

		expect(response.text).toMatch(
			/"defaultHttpClient":\s*\{\s*"targetKey":\s*"shell",\s*"clientKey":\s*"httpie"\s*\}/,
		);
	});
});
