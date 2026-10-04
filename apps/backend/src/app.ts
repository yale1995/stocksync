import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./http/error-handler.js";
import { env } from "./infra/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";

export function createApp(): Express {
	const app = express();

	app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
	app.use(cookieParser());
	app.use(express.json());
	app.use("/health", healthRouter);
	app.use("/auth", authRouter);

	app.use(errorHandler);

	return app;
}
