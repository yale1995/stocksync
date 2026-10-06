import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Router } from "express";
import type { Logger } from "pino";
import { API_PREFIX } from "./http/api-prefix.js";
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
import { createHttpLogger } from "./http/middlewares/http-logger.js";
import { env } from "./infra/env.js";
import { logger as rootLogger } from "./infra/logger.js";

type MountedRouter = { path: string; router: Router };

// Infrastructure routes stay unversioned so probes survive API version changes.
export const rootRoutes: MountedRouter[] = [
	{ path: "/health", router: healthRouter },
];

export const apiRoutes: MountedRouter[] = [
	{ path: "/auth", router: authRouter },
	{ path: "/products/:id", router: stockMovementsRouter },
	{ path: "/products", router: productsRouter },
	{ path: "/sales", router: salesRouter },
	{ path: "/sync", router: syncRouter },
];

export function createApp({
	logger = rootLogger,
}: {
	logger?: Logger;
} = {}): Express {
	const app = express();

	// First, so CORS failures and 404s also get a request id and an access line.
	app.use(createHttpLogger(logger));
	app.use(
		cors({
			origin: env.CORS_ORIGIN,
			credentials: true,
			exposedHeaders: ["X-Request-Id"],
		}),
	);
	app.use(cookieParser());
	app.use(express.json());
	app.use(docsRouter);
	for (const { path, router } of rootRoutes) app.use(path, router);

	const v1 = express.Router();
	for (const { path, router } of apiRoutes) v1.use(path, router);
	app.use(API_PREFIX, v1);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
