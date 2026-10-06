import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { seedTenants } from "../infra/seed/seed.js";
import { loginSchema } from "./controllers/auth.validation.js";
import {
	createProductSchema,
	updateProductSchema,
} from "./controllers/products.validation.js";
import { createStockAdjustmentSchema } from "./controllers/stock-movements.validation.js";
import { createOpenApiDocument } from "./openapi.js";
import { apiDescription } from "./openapi-description.js";

// biome-ignore lint/suspicious/noExplicitAny: the test walks the generated JSON by path.
type Json = Record<string, any>;

const document = createOpenApiDocument({ showSeedUsers: true }) as Json;

function operation(method: string, path: string): Json {
	const found = document.paths?.[path]?.[method];
	if (!found) throw new Error(`${method.toUpperCase()} ${path} not documented`);
	return found;
}

function resolve(schema: Json): Json {
	if (typeof schema.$ref !== "string") return schema;
	const id = schema.$ref.replace("#/components/schemas/", "");
	return document.components.schemas[id];
}

function requestBodySchema(method: string, path: string): Json {
	return resolve(
		operation(method, path).requestBody.content["application/json"].schema,
	);
}

function parameter(
	method: string,
	path: string,
	location: string,
	name: string,
) {
	const found = operation(method, path).parameters?.find(
		(param: Json) => param.in === location && param.name === name,
	);
	if (!found) throw new Error(`${location} parameter ${name} not documented`);
	return found;
}

function responseRef(method: string, path: string, status: string): string {
	return operation(method, path).responses[status].content["application/json"]
		.schema.$ref;
}

const expectedResponses: [string, string, string[]][] = [
	["get", "/health", ["200"]],
	["post", "/auth/login", ["200", "400", "401"]],
	["post", "/auth/logout", ["204"]],
	["get", "/auth/me", ["200", "401"]],
	["get", "/products", ["200", "400", "401"]],
	["post", "/products", ["201", "400", "401", "403", "409"]],
	["get", "/products/{id}", ["200", "401", "404"]],
	["patch", "/products/{id}", ["200", "400", "401", "403", "404"]],
	["delete", "/products/{id}", ["204", "401", "403", "404"]],
	[
		"post",
		"/products/{id}/stock-adjustments",
		["201", "400", "401", "403", "404", "409"],
	],
	["get", "/products/{id}/stock-movements", ["200", "400", "401", "404"]],
	["post", "/sales", ["201", "400", "401", "404", "409"]],
	["get", "/sync/status", ["200", "401"]],
];

const adminOnly = [
	["post", "/products"],
	["patch", "/products/{id}"],
	["delete", "/products/{id}"],
	["post", "/products/{id}/stock-adjustments"],
];

const publicOperations = [
	["get", "/health"],
	["post", "/auth/login"],
	["post", "/auth/logout"],
];

describe("document", () => {
	it("is OpenAPI 3.1.0", () => {
		expect(document.openapi).toBe("3.1.0");
	});

	it("serves every path from /api/v1", () => {
		expect(document.servers).toEqual([{ url: "/api/v1" }]);
	});

	it("serves /health from the root", () => {
		expect(document.paths["/health"].servers).toEqual([{ url: "/" }]);
	});

	it("keeps the documented paths relative to the server", () => {
		expect(
			Object.keys(document.paths).filter((path) => path.startsWith("/api")),
		).toEqual([]);
	});

	it("uses the introduction with the seeded users when asked", () => {
		expect(document.info.description).toBe(
			apiDescription({ showSeedUsers: true }),
		);
	});

	it("uses the introduction without seeded credentials otherwise", () => {
		const description = createOpenApiDocument({ showSeedUsers: false }).info
			.description;

		expect(description).toBe(apiDescription({ showSeedUsers: false }));
		for (const { email, password } of seedTenants.flatMap((t) => t.users)) {
			expect(description).not.toContain(email);
			expect(description).not.toContain(password);
		}
	});

	it("declares a described tag for every tag an operation uses, and no other", () => {
		const used = new Set<string>(
			Object.values(document.paths).flatMap((item) =>
				Object.values(item as Json).flatMap((op: Json) => op.tags ?? []),
			),
		);
		const declared = document.tags.map((entry: Json) => entry.name);

		expect([...used].sort()).toEqual([...declared].sort());
		for (const entry of document.tags) {
			expect(entry.description.length).toBeGreaterThan(0);
		}
	});
});

describe("responses", () => {
	it.each(expectedResponses)(
		"%s %s declares exactly its statuses",
		(method, path, statuses) => {
			expect(Object.keys(operation(method, path).responses).sort()).toEqual(
				statuses,
			);
		},
	);

	it.each(expectedResponses)(
		"%s %s describes every error with the shared envelope",
		(method, path, statuses) => {
			for (const status of statuses.filter((code) => code >= "400")) {
				expect(responseRef(method, path, status)).toBe(
					"#/components/schemas/ErrorResponse",
				);
			}
		},
	);

	it("restricts the error code to the AppError codes", () => {
		const envelope = document.components.schemas.ErrorResponse;

		expect(envelope.properties.error.properties.code.enum).toEqual([
			"VALIDATION_ERROR",
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"CONFLICT",
			"INTERNAL_SERVER_ERROR",
		]);
		expect(envelope.properties.error.required).toEqual(["code", "message"]);
	});

	it.each([
		["get", "/health", "200", "Health"],
		["post", "/auth/login", "200", "CurrentUser"],
		["get", "/auth/me", "200", "CurrentUser"],
		["get", "/products", "200", "ProductList"],
		["post", "/products", "201", "Product"],
		["get", "/products/{id}", "200", "Product"],
		["patch", "/products/{id}", "200", "Product"],
		["post", "/products/{id}/stock-adjustments", "201", "StockMovement"],
		["get", "/products/{id}/stock-movements", "200", "StockMovementList"],
		["post", "/sales", "201", "Sale"],
		["get", "/sync/status", "200", "SyncStatus"],
	])("%s %s answers %s with the %s schema", (method, path, status, id) => {
		expect(responseRef(method, path, status)).toBe(
			`#/components/schemas/${id}`,
		);
	});

	it.each([
		"CurrentUser",
		"Product",
		"StockMovement",
		"Sale",
		"SyncStatus",
		"Health",
		"ErrorResponse",
	])("declares %s without additional properties", (id) => {
		expect(document.components.schemas[id].additionalProperties).toBe(false);
	});

	it.each([
		["delete", "/products/{id}"],
		["post", "/auth/logout"],
	])("%s %s answers 204 without content", (method, path) => {
		expect(operation(method, path).responses["204"].content).toBeUndefined();
	});
});

describe("request schemas", () => {
	it("takes the product body from createProductSchema", () => {
		const body = requestBodySchema("post", "/products");

		expect(body.required.sort()).toEqual([
			"name",
			"priceCents",
			"sku",
			"stock",
		]);
		expect(body.properties.sku).toMatchObject({
			maxLength: 64,
			pattern: "^[A-Z0-9._-]+$",
		});
		expect(body.properties.priceCents.maximum).toBe(100_000_000);
		expect(body.properties.stock.maximum).toBe(1_000_000);
	});

	it("takes the list query from listProductsQuerySchema, in the form the client sends", () => {
		expect(
			parameter("get", "/products", "query", "limit").schema,
		).toMatchObject({ minimum: 1, maximum: 100, default: 20 });
		expect(
			parameter("get", "/products", "query", "search").schema,
		).toMatchObject({ type: "string", maxLength: 100 });
		expect(
			parameter("get", "/products", "query", "outOfStock").schema.enum,
		).toEqual(["true", "false"]);
	});

	it("takes the stock adjustment body and the history query from their schemas", () => {
		const body = requestBodySchema("post", "/products/{id}/stock-adjustments");

		expect(body.properties.direction.enum).toEqual(["in", "out"]);
		expect(body.properties.reason.maxLength).toBe(500);
		expect(
			parameter("get", "/products/{id}/stock-movements", "query", "page")
				.schema,
		).toMatchObject({ minimum: 1, default: 1 });
	});

	it("takes the sale body from createSaleSchema", () => {
		const items = requestBodySchema("post", "/sales").properties.items;

		expect(items).toMatchObject({ minItems: 1, maxItems: 100 });
		expect(items.items.properties.productId.format).toBe("uuid");
	});

	it("takes the login body from loginSchema", () => {
		const body = requestBodySchema("post", "/auth/login");

		expect(body.properties.email.format).toBe("email");
		expect(body.properties.password.minLength).toBe(1);
	});

	it.each([
		[
			"patch",
			"/products/{id}",
			"At least one field is required: name or priceCents",
		],
		["post", "/sales", "Each productId can appear only once"],
	])("states the refine rule of %s %s", (method, path, rule) => {
		expect(requestBodySchema(method, path).description).toContain(rule);
	});

	it.each(expectedResponses.filter(([, path]) => path.includes("{id}")))(
		"%s %s takes a uuid id and answers 404 for it",
		(method, path) => {
			const id = parameter(method, path, "path", "id");

			expect(id.required).toBe(true);
			expect(id.schema.format).toBe("uuid");
			expect(operation(method, path).responses).toHaveProperty("404");
		},
	);
});

describe("authentication", () => {
	it("declares the access_token cookie as an apiKey scheme", () => {
		expect(document.components.securitySchemes).toEqual({
			cookieAuth: { type: "apiKey", in: "cookie", name: "access_token" },
		});
	});

	it.each(
		expectedResponses.filter(
			([method, path]) =>
				!publicOperations.some(([m, p]) => m === method && p === path),
		),
	)("%s %s requires the cookie", (method, path) => {
		expect(operation(method, path).security).toEqual([{ cookieAuth: [] }]);
	});

	it.each(publicOperations)("%s %s is public", (method, path) => {
		expect(operation(method, path).security).toBeUndefined();
		expect(document.security).toBeUndefined();
	});

	it("offers every seeded user as a login example, Acme admin first", () => {
		const examples = operation("post", "/auth/login").requestBody.content[
			"application/json"
		].examples;
		const values = Object.values(examples).map(
			(example) => (example as Json).value,
		);

		expect(values).toEqual(
			seedTenants.flatMap(({ users }) =>
				users.map(({ email, password }) => ({ email, password })),
			),
		);
		expect(values[0]).toEqual({
			email: "admin@acme.test",
			password: "acme-admin-password",
		});
	});

	it("offers no login example when seed users are hidden", () => {
		const hidden = createOpenApiDocument({ showSeedUsers: false }) as Json;

		expect(
			hidden.paths["/auth/login"].post.requestBody.content["application/json"]
				.examples,
		).toBeUndefined();
	});

	it("declares the Set-Cookie header on a successful login", () => {
		expect(
			operation("post", "/auth/login").responses["200"].headers,
		).toHaveProperty("Set-Cookie");
	});

	it.each(adminOnly)(
		"%s %s states that it requires the admin role",
		(method, path) => {
			expect(operation(method, path).description).toContain(
				"Requires the `admin` role",
			);
		},
	);

	it.each(
		expectedResponses.filter(
			([method, path]) =>
				!adminOnly.some(([m, p]) => m === method && p === path),
		),
	)("%s %s does not claim the admin role", (method, path) => {
		expect(operation(method, path).description ?? "").not.toContain("admin");
	});
});

describe("idempotency", () => {
	it("requires a uuid Idempotency-Key header on POST /sales", () => {
		const header = parameter("post", "/sales", "header", "Idempotency-Key");

		expect(header.required).toBe(true);
		expect(header.schema.format).toBe("uuid");
	});

	it("declares the optional Idempotent-Replayed header on the 201", () => {
		const replayed = operation("post", "/sales").responses["201"].headers[
			"Idempotent-Replayed"
		];

		expect(replayed.required ?? false).toBe(false);
		expect(replayed.schema.const).toBe("true");
	});
});

describe("request examples", () => {
	const hidden = createOpenApiDocument({ showSeedUsers: false }) as Json;

	function bodyExamples(doc: Json, method: string, path: string) {
		return doc.paths[path][method].requestBody.content["application/json"]
			.examples;
	}

	it.each([
		["post", "/products"],
		["patch", "/products/{id}"],
		["post", "/products/{id}/stock-adjustments"],
	])("%s %s offers one example in both modes", (method, path) => {
		expect(Object.keys(bodyExamples(document, method, path))).toHaveLength(1);
		expect(bodyExamples(hidden, method, path)).toEqual(
			bodyExamples(document, method, path),
		);
	});

	it("offers a fixed Idempotency-Key and says a new sale needs a new key", () => {
		const header = parameter("post", "/sales", "header", "Idempotency-Key");

		expect(header.example).toBe("0196a000-0000-7000-8000-0000000c0001");
		expect(header.description).toContain("Use a new UUID for each new sale");
	});

	const bodySchemas: [string, string, z.ZodType][] = [
		["post", "/auth/login", loginSchema],
		["post", "/products", createProductSchema],
		["patch", "/products/{id}", updateProductSchema],
		["post", "/products/{id}/stock-adjustments", createStockAdjustmentSchema],
	];

	it.each(bodySchemas)(
		"%s %s examples pass the request schema",
		(method, path, schema) => {
			const examples = Object.values(bodyExamples(document, method, path));

			expect(examples.length).toBeGreaterThan(0);
			for (const example of examples) {
				expect(schema.safeParse((example as Json).value).success).toBe(true);
			}
		},
	);

	it("leaves no request body example without a schema check", () => {
		const withExamples = expectedResponses
			.filter(
				([method, path]) =>
					operation(method, path).requestBody?.content["application/json"]
						.examples,
			)
			.map(([method, path]) => `${method} ${path}`);

		expect(withExamples.sort()).toEqual(
			bodySchemas.map(([method, path]) => `${method} ${path}`).sort(),
		);
	});
});
