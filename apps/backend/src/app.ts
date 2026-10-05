import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { authRouter } from "./http/controllers/auth.controller.js";
import { healthRouter } from "./http/controllers/health.controller.js";
import { productsRouter } from "./http/controllers/products.controller.js";
import { salesRouter } from "./http/controllers/sales.controller.js";
import { stockMovementsRouter } from "./http/controllers/stock-movements.controller.js";
import {
	errorHandler,
	notFoundHandler,
} from "./http/middlewares/error-handler.js";
import { env } from "./infra/env.js";

export function createApp(): Express {
	const app = express();

	app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
	app.use(cookieParser());
	app.use(express.json());
	app.use("/health", healthRouter);
	app.use("/auth", authRouter);
	app.use("/products/:id", stockMovementsRouter);
	app.use("/products", productsRouter);
	app.use("/sales", salesRouter);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
