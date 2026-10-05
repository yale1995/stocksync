import { z } from "zod";
import { stockMovementDirection } from "../../infra/schemas/stock-movements.js";
import { MAX_STOCK } from "../products/products.validation.js";

export const createStockAdjustmentSchema = z.object({
	direction: z.enum(stockMovementDirection.enumValues),
	quantity: z.number().int().min(1).max(MAX_STOCK),
	reason: z.string().trim().min(1).max(500),
});

export type CreateStockAdjustmentInput = z.infer<
	typeof createStockAdjustmentSchema
>;

export const listStockMovementsQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListStockMovementsQuery = z.infer<
	typeof listStockMovementsQuerySchema
>;
