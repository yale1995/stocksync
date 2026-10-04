import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "./env.js";
import { type UserRole, userRole } from "./schemas/users.js";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h

const ALGORITHM = "HS256";
const secret = new TextEncoder().encode(env.JWT_SECRET);

const claimsSchema = z.object({
	sub: z.string(),
	tenantId: z.string(),
	role: z.enum(userRole.enumValues),
});

export type AccessTokenClaims = {
	userId: string;
	tenantId: string;
	role: UserRole;
};

export function signAccessToken({
	userId,
	tenantId,
	role,
}: AccessTokenClaims): Promise<string> {
	return new SignJWT({ tenantId, role })
		.setProtectedHeader({ alg: ALGORITHM })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
		.sign(secret);
}

export async function verifyAccessToken(
	token: string,
): Promise<AccessTokenClaims> {
	const { payload } = await jwtVerify(token, secret, {
		algorithms: [ALGORITHM],
	});

	const claims = claimsSchema.parse(payload);
	return { userId: claims.sub, tenantId: claims.tenantId, role: claims.role };
}
