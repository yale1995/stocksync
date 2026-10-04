import type { AccessTokenClaims } from "../infra/jwt.js";

declare global {
	namespace Express {
		interface Request {
			// Set by requireAuth; only read on routes mounted behind it.
			auth: AccessTokenClaims;
		}
	}
}
