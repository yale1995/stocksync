import { Router } from "express";
import { formatZodIssues, ValidationError } from "../../http/errors.js";
import { requireAuth } from "../../http/require-auth.js";
import { createSale } from "./sales.service.js";
import { createSaleSchema, idempotencyKeySchema } from "./sales.validation.js";

export const salesRouter = Router();

salesRouter.post("/", requireAuth, async (req, res) => {
	const key = idempotencyKeySchema.safeParse(req.get("Idempotency-Key"));
	if (!key.success) {
		throw new ValidationError("Idempotency-Key header must be a UUID");
	}
	const result = createSaleSchema.safeParse(req.body);
	if (!result.success) throw new ValidationError(formatZodIssues(result.error));

	const { tenantId, userId } = req.auth;
	const { sale, replayed } = await createSale(
		tenantId,
		userId,
		key.data,
		result.data,
	);
	if (replayed) res.set("Idempotent-Replayed", "true");
	res.status(201).json(sale);
});
