import { type CookieOptions, Router } from "express";
import { formatZodIssues, ValidationError } from "../../http/errors.js";
import { ACCESS_TOKEN_COOKIE, requireAuth } from "../../http/require-auth.js";
import { env } from "../../infra/env.js";
import { ACCESS_TOKEN_TTL_SECONDS } from "../../infra/jwt.js";
import { getCurrentUser, login } from "./auth.service.js";
import { loginSchema } from "./auth.validation.js";

const cookieOptions: CookieOptions = {
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite: "lax",
	path: "/",
};

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
	const result = loginSchema.safeParse(req.body);
	if (!result.success) throw new ValidationError(formatZodIssues(result.error));

	const { user, token } = await login(result.data.email, result.data.password);

	res.cookie(ACCESS_TOKEN_COOKIE, token, {
		...cookieOptions,
		maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
	});
	res.json(user);
});

authRouter.post("/logout", (_req, res) => {
	res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions);
	res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
	res.json(await getCurrentUser(req.auth));
});
