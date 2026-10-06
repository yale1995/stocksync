import { apiReference } from "@scalar/express-api-reference";
import { Router } from "express";
import { env } from "../../infra/env.js";
import { createOpenApiDocument } from "../openapi.js";

const document = createOpenApiDocument({
	showSeedUsers: env.NODE_ENV !== "production",
});

export const docsRouter = Router();

docsRouter.get("/openapi.json", (_req, res) => {
	res.json(document);
});

docsRouter.get(
	"/docs",
	apiReference({
		url: "/openapi.json",
		defaultHttpClient: { targetKey: "shell", clientKey: "httpie" },
	}),
);
