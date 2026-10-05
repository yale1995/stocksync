import { z } from "zod";

export const MAX_STOCK = 1_000_000;

const sku = z
	.string()
	.trim()
	.toUpperCase()
	.min(1)
	.max(64)
	.regex(
		/^[A-Z0-9._-]+$/,
		"Only letters, digits, '-', '_' and '.' are allowed",
	);
const name = z.string().trim().min(1).max(200);
const priceCents = z.number().int().min(0).max(100_000_000);
const stock = z.number().int().min(0).max(MAX_STOCK);

export const createProductSchema = z.object({ sku, name, priceCents, stock });

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
	.object({ name: name.optional(), priceCents: priceCents.optional() })
	.refine(
		(input) => input.name !== undefined || input.priceCents !== undefined,
		"At least one field is required: name or priceCents",
	);

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productIdSchema = z.uuid();

export const listProductsQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	search: z
		.string()
		.trim()
		.max(100)
		.optional()
		.transform((value) => value || undefined),
	outOfStock: z
		.enum(["true", "false"])
		.optional()
		.transform((value) => (value === undefined ? undefined : value === "true")),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
