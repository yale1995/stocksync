import { Router } from "express";
import {
	formatZodIssues,
	NotFoundError,
	ValidationError,
} from "../../infra/errors.js";
import {
	createProduct,
	deleteProduct,
	getProduct,
	listProducts,
	updateProduct,
} from "../../modules/products/products.service.js";
import { requireAuth } from "../middlewares/require-auth.js";
import { requireRole } from "../middlewares/require-role.js";
import {
	createProductSchema,
	listProductsQuerySchema,
	productIdSchema,
	updateProductSchema,
} from "./products.validation.js";

// A malformed id cannot match any product, and letting it reach Postgres would
// fail the uuid cast with a 500.
export function parseProductId(value: unknown): string {
	const result = productIdSchema.safeParse(value);
	if (!result.success) throw new NotFoundError("Product not found");
	return result.data;
}

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get("/", async (req, res) => {
	const result = listProductsQuerySchema.safeParse(req.query);
	if (!result.success) throw new ValidationError(formatZodIssues(result.error));

	res.json(await listProducts(req.auth.tenantId, result.data));
});

productsRouter.get("/:id", async (req, res) => {
	const id = parseProductId(req.params.id);
	res.json(await getProduct(req.auth.tenantId, id));
});

productsRouter.post("/", requireRole("admin"), async (req, res) => {
	const result = createProductSchema.safeParse(req.body);
	if (!result.success) throw new ValidationError(formatZodIssues(result.error));

	const { tenantId, userId } = req.auth;
	res.status(201).json(await createProduct(tenantId, userId, result.data));
});

productsRouter.patch("/:id", requireRole("admin"), async (req, res) => {
	const id = parseProductId(req.params.id);
	const result = updateProductSchema.safeParse(req.body);
	if (!result.success) throw new ValidationError(formatZodIssues(result.error));

	res.json(await updateProduct(req.auth.tenantId, id, result.data));
});

productsRouter.delete("/:id", requireRole("admin"), async (req, res) => {
	const id = parseProductId(req.params.id);
	await deleteProduct(req.auth.tenantId, id);
	res.status(204).end();
});
