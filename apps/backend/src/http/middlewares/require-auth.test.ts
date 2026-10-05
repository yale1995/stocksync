import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import express from "express";
import { decodeJwt, decodeProtectedHeader, SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "../../infra/env.js";
import { type AccessTokenClaims, signAccessToken } from "../../infra/jwt.js";
import { errorHandler } from "./error-handler.js";
import { requireAuth } from "./require-auth.js";
import { requireRole } from "./require-role.js";

const unauthorizedBody = {
	error: { code: "UNAUTHORIZED", message: "Authentication required" },
};

function createTestApp() {
	const app = express();
	app.use(cookieParser());

	app.get("/whoami", requireAuth, (req, res) => {
		res.json(req.auth);
	});
	app.post("/admin-only", requireAuth, requireRole("admin"), (_req, res) => {
		res.json({ ok: true });
	});

	app.use(errorHandler);
	return app;
}

function claims(role: AccessTokenClaims["role"] = "admin"): AccessTokenClaims {
	return { userId: randomUUID(), tenantId: randomUUID(), role };
}

function signWith(
	secret: string,
	alg: string,
	{ userId, tenantId, role }: AccessTokenClaims,
	expiresAt: number | string = "1h",
) {
	return new SignJWT({ tenantId, role })
		.setProtectedHeader({ alg })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime(expiresAt)
		.sign(new TextEncoder().encode(secret));
}

describe("signAccessToken", () => {
	it("signs an HS256 token with sub, tenantId and role, valid for 1h", async () => {
		const input = claims("operator");

		const token = await signAccessToken(input);
		const payload = decodeJwt(token);

		expect(decodeProtectedHeader(token).alg).toBe("HS256");
		expect(payload.sub).toBe(input.userId);
		expect(payload.tenantId).toBe(input.tenantId);
		expect(payload.role).toBe("operator");
		expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(3600);
	});
});

describe("requireAuth", () => {
	it("sets req.auth from the token claims without a database lookup", async () => {
		const input = claims("operator");
		const token = await signAccessToken(input);

		const response = await request(createTestApp())
			.get("/whoami")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual(input);
	});

	it("returns 401 without the cookie", async () => {
		const response = await request(createTestApp()).get("/whoami");

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 for a malformed token", async () => {
		const response = await request(createTestApp())
			.get("/whoami")
			.set("Cookie", "access_token=not-a-jwt");

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 for a token signed with another secret", async () => {
		const token = await signWith(
			"another-secret-with-at-least-32-characters",
			"HS256",
			claims(),
		);

		const response = await request(createTestApp())
			.get("/whoami")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 for a token signed with an algorithm other than HS256", async () => {
		const token = await signWith(env.JWT_SECRET, "HS512", claims());

		const response = await request(createTestApp())
			.get("/whoami")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 for a validly signed token with an unknown role", async () => {
		const token = await signWith(env.JWT_SECRET, "HS256", {
			...claims(),
			role: "superuser" as AccessTokenClaims["role"],
		});

		const response = await request(createTestApp())
			.get("/whoami")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 for an expired token", async () => {
		const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
		const token = await signWith(
			env.JWT_SECRET,
			"HS256",
			claims(),
			oneMinuteAgo,
		);

		const response = await request(createTestApp())
			.get("/whoami")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});
});

describe("requireRole", () => {
	it("returns 403 when the role is not allowed", async () => {
		const token = await signAccessToken(claims("operator"));

		const response = await request(createTestApp())
			.post("/admin-only")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			error: {
				code: "FORBIDDEN",
				message: "You do not have permission to perform this action",
			},
		});
	});

	it("lets an allowed role through", async () => {
		const token = await signAccessToken(claims("admin"));

		const response = await request(createTestApp())
			.post("/admin-only")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ ok: true });
	});
});
