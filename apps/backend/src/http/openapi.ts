import { z } from "zod";
import {
	createDocument,
	type ZodOpenApiExamplesObject,
	type ZodOpenApiObject,
	type ZodOpenApiOperationObject,
	type ZodOpenApiResponsesObject,
} from "zod-openapi";
import { seedTenants } from "../infra/seed/seed.js";
import { API_PREFIX } from "./api-prefix.js";
import {
	currentUserSchema,
	loginSchema,
} from "./controllers/auth.validation.js";
import { errorResponseSchema } from "./controllers/common.validation.js";
import { healthSchema } from "./controllers/health.validation.js";
import {
	createProductSchema,
	listProductsQuerySchema,
	productIdSchema,
	productListSchema,
	productSchema,
	updateProductSchema,
} from "./controllers/products.validation.js";
import {
	createSaleSchema,
	idempotencyKeySchema,
	saleSchema,
} from "./controllers/sales.validation.js";
import {
	createStockAdjustmentSchema,
	listStockMovementsQuerySchema,
	stockMovementListSchema,
	stockMovementSchema,
} from "./controllers/stock-movements.validation.js";
import { syncStatusSchema } from "./controllers/sync.validation.js";
import { ACCESS_TOKEN_COOKIE } from "./middlewares/require-auth.js";
import { apiDescription, tagDescriptions } from "./openapi-description.js";

const errorDescriptions = {
	400: "Invalid input",
	401: "Missing, invalid or expired access token",
	403: "The user's role is not allowed",
	404: "Not found in the caller's tenant",
	409: "Conflicts with the current state",
} as const;

type ErrorStatus = keyof typeof errorDescriptions;

function json(description: string, schema: z.ZodType) {
	return { description, content: { "application/json": { schema } } };
}

function errors(...statuses: ErrorStatus[]): ZodOpenApiResponsesObject {
	return Object.fromEntries(
		statuses.map((status) => [
			status,
			json(errorDescriptions[status], errorResponseSchema),
		]),
	);
}

function body(schema: z.ZodType, examples?: ZodOpenApiExamplesObject) {
	return {
		required: true,
		content: { "application/json": { schema, examples } },
	};
}

// The first example is the one Scalar fills in by default.
function seedLoginExamples(): ZodOpenApiExamplesObject {
	return Object.fromEntries(
		seedTenants.flatMap(({ name, users }) =>
			users.map(({ email, password, role }) => [
				`${name.toLowerCase()}-${role}`,
				{ summary: `${name} ${role}`, value: { email, password } },
			]),
		),
	);
}

const createProductExamples: ZodOpenApiExamplesObject = {
	mug: {
		summary: "A new product",
		value: { sku: "MUG-01", name: "Caneca", priceCents: 2490, stock: 50 },
	},
};

const updateProductExamples: ZodOpenApiExamplesObject = {
	"name-and-price": {
		summary: "New name and price",
		value: { name: "Camiseta P Azul", priceCents: 5990 },
	},
};

const stockAdjustmentExamples: ZodOpenApiExamplesObject = {
	"physical-count": {
		summary: "Add 10 units",
		value: { direction: "in", quantity: 10, reason: "Physical count" },
	},
};

const idempotencyKeyExample = "0196a000-0000-7000-8000-0000000c0001";

const authenticated = { security: [{ cookieAuth: [] }] };
const adminOnly = "Requires the `admin` role.";

const productPath = { path: z.object({ id: productIdSchema }) };

const products: Record<string, Record<string, ZodOpenApiOperationObject>> = {
	"/products": {
		get: {
			tags: ["Products"],
			summary: "List products",
			...authenticated,
			requestParams: { query: listProductsQuerySchema },
			responses: {
				200: json("A page of products", productListSchema),
				...errors(400, 401),
			},
		},
		post: {
			tags: ["Products"],
			summary: "Create a product",
			description: adminOnly,
			...authenticated,
			requestBody: body(createProductSchema, createProductExamples),
			responses: {
				201: json("The created product", productSchema),
				...errors(400, 401, 403, 409),
			},
		},
	},
	"/products/{id}": {
		get: {
			tags: ["Products"],
			summary: "Get a product",
			...authenticated,
			requestParams: productPath,
			responses: {
				200: json("The product", productSchema),
				...errors(401, 404),
			},
		},
		patch: {
			tags: ["Products"],
			summary: "Update a product's name or price",
			description: adminOnly,
			...authenticated,
			requestParams: productPath,
			requestBody: body(updateProductSchema, updateProductExamples),
			responses: {
				200: json("The updated product", productSchema),
				...errors(400, 401, 403, 404),
			},
		},
		delete: {
			tags: ["Products"],
			summary: "Soft delete a product",
			description: adminOnly,
			...authenticated,
			requestParams: productPath,
			responses: {
				204: { description: "Deleted" },
				...errors(401, 403, 404),
			},
		},
	},
	"/products/{id}/stock-adjustments": {
		post: {
			tags: ["Stock movements"],
			summary: "Adjust a product's stock",
			description: adminOnly,
			...authenticated,
			requestParams: productPath,
			requestBody: body(createStockAdjustmentSchema, stockAdjustmentExamples),
			responses: {
				201: json("The recorded movement", stockMovementSchema),
				...errors(400, 401, 403, 404, 409),
			},
		},
	},
	"/products/{id}/stock-movements": {
		get: {
			tags: ["Stock movements"],
			summary: "List a product's stock movements, newest first",
			...authenticated,
			requestParams: { ...productPath, query: listStockMovementsQuerySchema },
			responses: {
				200: json("A page of movements", stockMovementListSchema),
				...errors(400, 401, 404),
			},
		},
	},
};

function apiPaths(showSeedUsers: boolean): ZodOpenApiObject["paths"] {
	return {
		"/health": {
			servers: [{ url: "/" }],
			get: {
				tags: ["Health"],
				summary: "Health check",
				responses: {
					200: json("The API and its database are up", healthSchema),
					503: json("The database is unreachable", healthSchema),
				},
			},
		},
		"/auth/login": {
			post: {
				tags: ["Auth"],
				summary: "Log in",
				requestBody: body(
					loginSchema,
					showSeedUsers ? seedLoginExamples() : undefined,
				),
				responses: {
					200: {
						...json("The logged-in user", currentUserSchema),
						headers: z.object({
							"Set-Cookie": z.string().meta({
								description: `httpOnly \`${ACCESS_TOKEN_COOKIE}\` cookie valid for 1 hour`,
							}),
						}),
					},
					...errors(400, 401),
				},
			},
		},
		"/auth/logout": {
			post: {
				tags: ["Auth"],
				summary: "Log out",
				responses: { 204: { description: "The cookie was cleared" } },
			},
		},
		"/auth/me": {
			get: {
				tags: ["Auth"],
				summary: "Get the current user",
				...authenticated,
				responses: {
					200: json("The current user", currentUserSchema),
					...errors(401),
				},
			},
		},
		...products,
		"/sales": {
			post: {
				tags: ["Sales"],
				summary: "Register a sale",
				...authenticated,
				requestParams: {
					header: z.object({
						"Idempotency-Key": idempotencyKeySchema.meta({
							description:
								"Retrying with the same key and items replays the original sale. Use a new UUID for each new sale.",
							param: { example: idempotencyKeyExample },
						}),
					}),
				},
				requestBody: body(createSaleSchema),
				responses: {
					201: {
						...json("The sale", saleSchema),
						headers: z.object({
							"Idempotent-Replayed": z
								.literal("true")
								.optional()
								.meta({ description: "Present when the sale was replayed" }),
						}),
					},
					...errors(400, 401, 404, 409),
				},
			},
		},
		"/sync/status": {
			get: {
				tags: ["Sync"],
				summary: "Get the tenant's sync status with the ads service",
				...authenticated,
				responses: {
					200: json("The sync status", syncStatusSchema),
					...errors(401),
				},
			},
		},
	};
}

export function createOpenApiDocument({
	showSeedUsers,
}: {
	showSeedUsers: boolean;
}) {
	return createDocument({
		openapi: "3.1.0",
		info: {
			title: "StockSync API",
			version: "1.0.0",
			description: apiDescription({ showSeedUsers }),
		},
		servers: [{ url: API_PREFIX }],
		tags: tagDescriptions,
		components: {
			securitySchemes: {
				cookieAuth: {
					type: "apiKey",
					in: "cookie",
					name: ACCESS_TOKEN_COOKIE,
				},
			},
		},
		paths: apiPaths(showSeedUsers),
	});
}
