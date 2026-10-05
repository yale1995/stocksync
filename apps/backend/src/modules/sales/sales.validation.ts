import { z } from "zod";
import { MAX_STOCK } from "../products/products.validation.js";

export const idempotencyKeySchema = z.uuid();

const saleItem = z.object({
	productId: z.uuid().toLowerCase(),
	quantity: z.number().int().min(1).max(MAX_STOCK),
});

export const createSaleSchema = z.object({
	items: z
		.array(saleItem)
		.min(1)
		.max(100)
		.refine(
			(items) =>
				new Set(items.map((item) => item.productId)).size === items.length,
			"Each productId can appear only once",
		),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = CreateSaleInput["items"][number];
