import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Router } from "express";
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
import { env } from "./infra/env.js";

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

export function createApp(): Express {
	const app = express();

	app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
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
