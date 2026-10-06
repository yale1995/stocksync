import { z } from "zod";
import {
	stockMovementDirection,
	stockMovementSource,
} from "../../infra/schemas/stock-movements.js";
import { paginated, timestampSchema } from "./common.validation.js";
import { MAX_STOCK } from "./products.validation.js";

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

export const stockMovementSchema = z
	.strictObject({
		id: z.uuid(),
		direction: z.enum(stockMovementDirection.enumValues),
		quantity: z.int().min(0),
		stockAfter: z.int().min(0),
		source: z.enum(stockMovementSource.enumValues),
		reason: z.string().nullable(),
		saleId: z.uuid().nullable(),
		createdAt: timestampSchema,
		user: z.strictObject({ id: z.uuid(), email: z.email() }),
	})
	.meta({ id: "StockMovement" });

export const stockMovementListSchema = paginated(stockMovementSchema).meta({
	id: "StockMovementList",
});
