import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { errorHandler, notFoundHandler } from "./http/error-handler.js";
import { env } from "./infra/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { stockMovementsRouter } from "./modules/stock-movements/stock-movements.routes.js";

export function createApp(): Express {
	const app = express();

	app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
	app.use(cookieParser());
	app.use(express.json());
	app.use("/health", healthRouter);
	app.use("/auth", authRouter);
	app.use("/products/:id", stockMovementsRouter);
	app.use("/products", productsRouter);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
