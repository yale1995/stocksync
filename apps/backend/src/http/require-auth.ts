import type { RequestHandler } from "express";
import { verifyAccessToken } from "../infra/jwt.js";
import { UnauthorizedError } from "./errors.js";

export const ACCESS_TOKEN_COOKIE = "access_token";

export const requireAuth: RequestHandler = async (req, _res, next) => {
	const token: unknown = req.cookies?.[ACCESS_TOKEN_COOKIE];
	if (typeof token !== "string") throw new UnauthorizedError();

	try {
		req.auth = await verifyAccessToken(token);
	} catch {
		throw new UnauthorizedError();
	}

	next();
};
