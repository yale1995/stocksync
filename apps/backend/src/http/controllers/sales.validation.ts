import { z } from "zod";
import { timestampSchema } from "./common.validation.js";
import { MAX_STOCK } from "./products.validation.js";

export const idempotencyKeySchema = z.uuid();

const saleItem = z.object({
	productId: z.uuid().toLowerCase(),
	quantity: z.number().int().min(1).max(MAX_STOCK),
});

const uniqueProducts = "Each productId can appear only once";

export const createSaleSchema = z
	.object({
		items: z
			.array(saleItem)
			.min(1)
			.max(100)
			.refine(
				(items) =>
					new Set(items.map((item) => item.productId)).size === items.length,
				uniqueProducts,
			),
	})
	.meta({ description: uniqueProducts });

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = CreateSaleInput["items"][number];

export const saleSchema = z
	.strictObject({
		id: z.uuid(),
		items: z.array(
			z.strictObject({
				productId: z.uuid(),
				sku: z.string(),
				name: z.string(),
				quantity: z.int().min(1),
				unitPriceCents: z.int().min(0),
			}),
		),
		totalCents: z.int().min(0),
		createdAt: timestampSchema,
		user: z.strictObject({ id: z.uuid(), email: z.email() }),
	})
	.meta({ id: "Sale" });
