import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Router } from "express";
import { authRouter } from "./http/controllers/auth.controller.js";
import { docsRouter } from "./http/controllers/docs.controller.js";
import { healthRouter } from "./http/controllers/health.controller.js";
import { productsRouter } from "./http/controllers/products.controller.js";
import { salesRouter } from "./http/controllers/sales.controller.js";
import { stockMovementsRouter } from "./http/controllers/stock-movements.controller.js";
import { syncRouter } from "./http/controllers/sync.controller.js";
import {
	errorHandler,
	notFoundHandler,
} from "./http/middlewares/error-handler.js";
import { env } from "./infra/env.js";

export const apiRoutes: { path: string; router: Router }[] = [
	{ path: "/health", router: healthRouter },
	{ path: "/auth", router: authRouter },
	{ path: "/products/:id", router: stockMovementsRouter },
	{ path: "/products", router: productsRouter },
	{ path: "/sales", router: salesRouter },
	{ path: "/sync", router: syncRouter },
];

export function createApp(): Express {
	const app = express();

	app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
	app.use(cookieParser());
	app.use(express.json());
	app.use(docsRouter);
	for (const { path, router } of apiRoutes) app.use(path, router);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
