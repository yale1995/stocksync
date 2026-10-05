import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import { currentUserSchema } from "../../http/controllers/auth.validation.js";
import { db } from "../../infra/db.js";
import { env } from "../../infra/env.js";
import { signAccessToken } from "../../infra/jwt.js";
import { tenants } from "../../infra/schemas/tenants.js";
import { users } from "../../infra/schemas/users.js";
import { seed } from "../../infra/seed/seed.js";

const acmeAdmin = { email: "admin@acme.test", password: "acme-admin-password" };
const globexOperator = {
	email: "operator@globex.test",
	password: "globex-operator-password",
};

const invalidCredentialsBody = {
	error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
};
const unauthorizedBody = {
	error: { code: "UNAUTHORIZED", message: "Authentication required" },
};

function login(credentials: { email: string; password: string }) {
	return request(createApp()).post("/auth/login").send(credentials);
}

function setCookieHeader(response: request.Response): string {
	const header = response.headers["set-cookie"] as unknown as
		| string[]
		| undefined;
	const cookie = header?.find((value) => value.startsWith("access_token="));
	if (!cookie) throw new Error("access_token cookie not set");
	return cookie;
}

function accessTokenFrom(response: request.Response): string {
	return (
		setCookieHeader(response).split(";")[0]?.slice("access_token=".length) ?? ""
	);
}

async function findUser(email: string) {
	const [user] = await db.select().from(users).where(eq(users.email, email));
	if (!user) throw new Error(`user ${email} not seeded`);
	return user;
}

async function findTenant(name: string) {
	const [tenant] = await db
		.select()
		.from(tenants)
		.where(eq(tenants.name, name));
	if (!tenant) throw new Error(`tenant ${name} not seeded`);
	return tenant;
}

function expiredTokenFor(user: { id: string; tenantId: string; role: string }) {
	const now = Math.floor(Date.now() / 1000);
	return new SignJWT({ tenantId: user.tenantId, role: user.role })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(user.id)
		.setIssuedAt(now - 7200)
		.setExpirationTime(now - 3600)
		.sign(new TextEncoder().encode(env.JWT_SECRET));
}

beforeEach(async () => {
	await seed(db);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("POST /auth/login", () => {
	it("returns the current user with their tenant", async () => {
		const user = await findUser(acmeAdmin.email);
		const tenant = await findTenant("Acme");

		const response = await login(acmeAdmin);

		expect(response.status).toBe(200);
		currentUserSchema.parse(response.body);
		expect(response.body).toEqual({
			id: user.id,
			email: "admin@acme.test",
			role: "admin",
			tenant: { id: tenant.id, name: "Acme" },
		});
	});

	it("sets an httpOnly, SameSite=Lax access_token cookie valid for 1h and keeps the token out of the body", async () => {
		const response = await login(acmeAdmin);
		const cookie = setCookieHeader(response);

		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("Max-Age=3600");
		expect(cookie).not.toContain("Secure");
		expect(response.text).not.toContain(accessTokenFrom(response));
	});

	it("sets the Secure flag in production", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.resetModules();
		const { createApp: createProductionApp } = await import("../../app.js");
		const { pool: productionPool } = await import("../../infra/db.js");

		try {
			const response = await request(createProductionApp())
				.post("/auth/login")
				.send(acmeAdmin);

			expect(response.status).toBe(200);
			expect(setCookieHeader(response)).toContain("Secure");
		} finally {
			await productionPool.end();
			vi.resetModules();
		}
	});

	it("matches the email case-insensitively", async () => {
		const response = await login({ ...acmeAdmin, email: "ADMIN@Acme.Test" });

		expect(response.status).toBe(200);
		expect(response.body.email).toBe("admin@acme.test");
	});

	it("returns 401 for a wrong password", async () => {
		const response = await login({ ...acmeAdmin, password: "wrong-password" });

		expect(response.status).toBe(401);
		expect(response.body).toEqual(invalidCredentialsBody);
		expect(response.headers["set-cookie"]).toBeUndefined();
	});

	it("returns 401 with the same message for an unknown email, still comparing against a dummy hash", async () => {
		const compare = vi.spyOn(bcrypt, "compare");

		const response = await login({
			email: "nobody@acme.test",
			password: "any-password",
		});

		expect(response.status).toBe(401);
		expect(response.body).toEqual(invalidCredentialsBody);
		expect(compare).toHaveBeenCalledTimes(1);
		expect(compare.mock.calls[0]?.[0]).toBe("any-password");
		expect(compare.mock.calls[0]?.[1]).toMatch(/^\$2[aby]\$10\$/);
	});

	it("returns 401 for a soft-deleted user", async () => {
		await db
			.update(users)
			.set({ deletedAt: new Date() })
			.where(eq(users.email, acmeAdmin.email));

		const response = await login(acmeAdmin);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(invalidCredentialsBody);
	});

	it("returns 401 for a user of a soft-deleted tenant", async () => {
		await db
			.update(tenants)
			.set({ deletedAt: new Date() })
			.where(eq(tenants.name, "Acme"));

		const response = await login(acmeAdmin);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(invalidCredentialsBody);
	});

	it("returns 400 for an invalid email", async () => {
		const response = await login({
			email: "not-an-email",
			password: "any-password",
		});

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
		expect(response.body.error.message).toMatch(/^email: /);
	});

	it("returns 400 for an empty password", async () => {
		const response = await login({ email: acmeAdmin.email, password: "" });

		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
		expect(response.body.error.message).toMatch(/^password: /);
	});
});

describe("GET /auth/me", () => {
	it("returns the same body as login", async () => {
		const loginResponse = await login(acmeAdmin);

		const response = await request(createApp())
			.get("/auth/me")
			.set("Cookie", `access_token=${accessTokenFrom(loginResponse)}`);

		expect(response.status).toBe(200);
		currentUserSchema.parse(response.body);
		expect(response.body).toEqual(loginResponse.body);
	});

	it("returns the user with their own tenant", async () => {
		const loginResponse = await login(globexOperator);
		const globex = await findTenant("Globex");

		const response = await request(createApp())
			.get("/auth/me")
			.set("Cookie", `access_token=${accessTokenFrom(loginResponse)}`);

		expect(response.status).toBe(200);
		expect(response.body.email).toBe("operator@globex.test");
		expect(response.body.role).toBe("operator");
		expect(response.body.tenant).toEqual({ id: globex.id, name: "Globex" });
	});

	it("ignores a tenantId passed in the query string", async () => {
		const loginResponse = await login(acmeAdmin);
		const globex = await findTenant("Globex");

		const response = await request(createApp())
			.get(`/auth/me?tenantId=${globex.id}`)
			.set("Cookie", `access_token=${accessTokenFrom(loginResponse)}`);

		expect(response.status).toBe(200);
		expect(response.body.tenant.name).toBe("Acme");
	});

	it("returns 401 without a cookie", async () => {
		const response = await request(createApp()).get("/auth/me");

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 for an invalid token", async () => {
		const response = await request(createApp())
			.get("/auth/me")
			.set("Cookie", "access_token=invalid.token.value");

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 for an expired token", async () => {
		const user = await findUser(acmeAdmin.email);
		const token = await expiredTokenFor(user);

		const response = await request(createApp())
			.get("/auth/me")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 when the user was soft deleted after login", async () => {
		const loginResponse = await login(acmeAdmin);
		await db
			.update(users)
			.set({ deletedAt: new Date() })
			.where(eq(users.email, acmeAdmin.email));

		const response = await request(createApp())
			.get("/auth/me")
			.set("Cookie", `access_token=${accessTokenFrom(loginResponse)}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 when the user's tenant was soft deleted after login", async () => {
		const loginResponse = await login(acmeAdmin);
		await db
			.update(tenants)
			.set({ deletedAt: new Date() })
			.where(eq(tenants.name, "Acme"));

		const response = await request(createApp())
			.get("/auth/me")
			.set("Cookie", `access_token=${accessTokenFrom(loginResponse)}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});

	it("returns 401 when the token's tenant does not own the user", async () => {
		const user = await findUser(acmeAdmin.email);
		const globex = await findTenant("Globex");
		const token = await signAccessToken({
			userId: user.id,
			tenantId: globex.id,
			role: "admin",
		});

		const response = await request(createApp())
			.get("/auth/me")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(401);
		expect(response.body).toEqual(unauthorizedBody);
	});
});

describe("POST /auth/logout", () => {
	const clearedCookie =
		"access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax";

	it("returns 204 and clears the cookie with the same options", async () => {
		const response = await request(createApp()).post("/auth/logout");

		expect(response.status).toBe(204);
		expect(setCookieHeader(response)).toBe(clearedCookie);
	});

	it("works with an expired token", async () => {
		const token = await expiredTokenFor(await findUser(acmeAdmin.email));

		const response = await request(createApp())
			.post("/auth/logout")
			.set("Cookie", `access_token=${token}`);

		expect(response.status).toBe(204);
		expect(setCookieHeader(response)).toBe(clearedCookie);
	});

	it("ends the session for a client that keeps cookies", async () => {
		const agent = request.agent(createApp());
		await agent.post("/auth/login").send(acmeAdmin).expect(200);
		await agent.get("/auth/me").expect(200);

		await agent.post("/auth/logout").expect(204);

		const response = await agent.get("/auth/me");
		expect(response.status).toBe(401);
	});
});
