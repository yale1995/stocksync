import { Router } from "express";
import { getSyncStatus } from "../../modules/sync/sync.service.js";
import { requireAuth } from "../middlewares/require-auth.js";

export const syncRouter = Router();

syncRouter.get("/status", requireAuth, async (req, res) => {
	res.json(await getSyncStatus(req.auth.tenantId));
});
