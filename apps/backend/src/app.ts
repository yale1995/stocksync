import express, { type Express } from "express";
import { healthRouter } from "./modules/health/health.routes.js";

export function createApp(): Express {
	const app = express();

	app.use(express.json());
	app.use("/health", healthRouter);

	return app;
}
