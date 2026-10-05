import { type Request, Router } from "express";
import { formatZodIssues, ValidationError } from "../../infra/errors.js";
import {
	createStockAdjustment,
	listProductStockMovements,
} from "../../modules/stock-movements/stock-movements.service.js";
import { requireAuth } from "../middlewares/require-auth.js";
import { requireRole } from "../middlewares/require-role.js";
import { parseProductId } from "./products.controller.js";
import {
	createStockAdjustmentSchema,
	listStockMovementsQuerySchema,
} from "./stock-movements.validation.js";

type ProductParams = { id: string };

// Mounted under /products/:id; mergeParams exposes :id to these handlers.
export const stockMovementsRouter = Router({ mergeParams: true });

stockMovementsRouter.post(
	"/stock-adjustments",
	requireAuth,
	requireRole("admin"),
	async (req: Request<ProductParams>, res) => {
		const productId = parseProductId(req.params.id);
		const result = createStockAdjustmentSchema.safeParse(req.body);
		if (!result.success) {
			throw new ValidationError(formatZodIssues(result.error));
		}

		const { tenantId, userId } = req.auth;
		res
			.status(201)
			.json(
				await createStockAdjustment(tenantId, userId, productId, result.data),
			);
	},
);

stockMovementsRouter.get(
	"/stock-movements",
	requireAuth,
	async (req: Request<ProductParams>, res) => {
		const productId = parseProductId(req.params.id);
		const result = listStockMovementsQuerySchema.safeParse(req.query);
		if (!result.success) {
			throw new ValidationError(formatZodIssues(result.error));
		}

		res.json(
			await listProductStockMovements(
				req.auth.tenantId,
				productId,
				result.data,
			),
		);
	},
);
