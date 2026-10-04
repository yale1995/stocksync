import express, { type Express } from "express";
import { errorHandler } from "./http/error-handler.js";
import { healthRouter } from "./modules/health/health.routes.js";

export function createApp(): Express {
	const app = express();

	app.use(express.json());
	app.use("/health", healthRouter);

	app.use(errorHandler);

	return app;
}
