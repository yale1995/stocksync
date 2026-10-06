import { Router } from "express";
import { getHealth } from "../../modules/health/health.service.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
	const health = await getHealth();
	res
		.set("Cache-Control", "no-store")
		.status(health.status === "ok" ? 200 : 503)
		.json(health);
});
