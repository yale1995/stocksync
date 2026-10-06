import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { currentUserSchema } from "./auth.validation.js";
import { errorResponseSchema } from "./common.validation.js";
import { healthSchema } from "./health.validation.js";
import { productListSchema, productSchema } from "./products.validation.js";
import { saleSchema } from "./sales.validation.js";
import {
	stockMovementListSchema,
	stockMovementSchema,
} from "./stock-movements.validation.js";
import { syncStatusSchema } from "./sync.validation.js";

const id = "0190a8e2-0000-7000-8000-000000000001";
const timestamp = "2026-10-05T12:00:00.000Z";
const user = { id, email: "admin@acme.test" };

const product = {
	id,
	sku: "CAM-P",
	name: "Camiseta P",
	priceCents: 4990,
	stock: 25,
	createdAt: timestamp,
	updatedAt: timestamp,
};

const movement = {
	id,
	direction: "in",
	quantity: 25,
	stockAfter: 25,
	source: "initial",
	reason: null,
	saleId: null,
	createdAt: timestamp,
	user,
};

const meta = { page: 1, limit: 20, total: 1 };

// Each case names the object levels of a valid sample that must reject an
// extra key, so swapping a strictObject for an object fails here.
const cases: [string, z.ZodType, Record<string, unknown>, string[][]][] = [
	[
		"ErrorResponse",
		errorResponseSchema,
		{ error: { code: "NOT_FOUND", message: "Product not found" } },
		[[], ["error"]],
	],
	[
		"CurrentUser",
		currentUserSchema,
		{ ...user, role: "admin", tenant: { id, name: "Acme" } },
		[[], ["tenant"]],
	],
	["Product", productSchema, product, [[]]],
	[
		"ProductList",
		productListSchema,
		{ data: [product], meta },
		[[], ["meta"], ["data", "0"]],
	],
	["StockMovement", stockMovementSchema, movement, [[], ["user"]]],
	[
		"StockMovementList",
		stockMovementListSchema,
		{ data: [movement], meta },
		[[], ["meta"], ["data", "0"], ["data", "0", "user"]],
	],
	[
		"Sale",
		saleSchema,
		{
			id,
			items: [
				{
					productId: id,
					sku: "CAM-P",
					name: "Camiseta P",
					quantity: 2,
					unitPriceCents: 4990,
				},
			],
			totalCents: 9980,
			createdAt: timestamp,
			user,
		},
		[[], ["items", "0"], ["user"]],
	],
	[
		"SyncStatus",
		syncStatusSchema,
		{
			pending: 0,
			sent: 1,
			failed: 1,
			superseded: 0,
			lastSuccessfulSyncAt: timestamp,
			failedEvents: [
				{
					id,
					productId: id,
					sku: "CAM-P",
					trigger: "stock_changed",
					attempts: 5,
					lastError: "HTTP 500",
					updatedAt: timestamp,
				},
			],
		},
		[[], ["failedEvents", "0"]],
	],
	[
		"Health",
		healthSchema,
		{
			status: "ok",
			server: {
				status: "up",
				version: "0.0.0",
				nodeVersion: "v22.12.0",
				environment: "development",
				provider: "local",
			},
			database: {
				status: "up",
				version: "18.0",
				maxConnections: 100,
				openConnections: 7,
				latencyMs: 3,
			},
			sync: {
				pending: 12,
				failed: 2,
				oldestPendingAt: timestamp,
				lastSuccessfulSyncAt: timestamp,
			},
		},
		[[], ["server"], ["database"], ["sync"]],
	],
];

function withExtraKey(
	sample: Record<string, unknown>,
	path: string[],
): Record<string, unknown> {
	const copy = structuredClone(sample);
	let target: Record<string, unknown> = copy;
	for (const key of path) target = target[key] as Record<string, unknown>;
	target.unexpected = true;
	return copy;
}

describe.each(cases)("%s", (_name, schema, sample, levels) => {
	it("accepts the valid sample", () => {
		expect(schema.safeParse(sample).success).toBe(true);
	});

	it.each(levels.map((path) => [path.join(".") || "(root)", path]))(
		"rejects an extra key at %s",
		(_label, path) => {
			expect(schema.safeParse(withExtraKey(sample, path)).success).toBe(false);
		},
	);
});
