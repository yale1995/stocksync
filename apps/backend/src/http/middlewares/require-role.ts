import type { RequestHandler } from "express";
import { ForbiddenError } from "../../infra/errors.js";
import type { UserRole } from "../../infra/schemas/users.js";

export function requireRole(...roles: UserRole[]): RequestHandler {
	return (req, _res, next) => {
		if (!roles.includes(req.auth.role)) throw new ForbiddenError();
		next();
	};
}
