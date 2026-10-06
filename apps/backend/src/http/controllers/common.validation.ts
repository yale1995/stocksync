import { z } from "zod";

export const errorResponseSchema = z
	.strictObject({
		error: z.strictObject({
			code: z.enum([
				"VALIDATION_ERROR",
				"UNAUTHORIZED",
				"FORBIDDEN",
				"NOT_FOUND",
				"CONFLICT",
				"INTERNAL_SERVER_ERROR",
			]),
			message: z.string(),
		}),
	})
	.meta({ id: "ErrorResponse" });

export const timestampSchema = z.iso.datetime({ offset: true });

export function paginated<Item extends z.ZodType>(item: Item) {
	return z.strictObject({
		data: z.array(item),
		meta: z.strictObject({
			page: z.int().min(1),
			limit: z.int().min(1).max(100),
			total: z.int().min(0),
		}),
	});
}
