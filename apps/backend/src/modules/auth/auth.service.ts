import { UnauthorizedError } from "../../infra/errors.js";
import { type AccessTokenClaims, signAccessToken } from "../../infra/jwt.js";
import { verifyPassword } from "../../infra/password.js";
import {
	type CurrentUser,
	findActiveUserByEmail,
	findActiveUserById,
} from "./auth.repository.js";

// Hash of a random string at the same cost as real hashes: comparing against it
// makes an unknown email take about as long as a wrong password.
const DUMMY_PASSWORD_HASH =
	"$2b$10$9QqsSIUQDXMIt46XGErR7./ShYfRldyGvgU8ZtqH/92aKY3UdhVOa";

const INVALID_CREDENTIALS = "Invalid email or password";

export async function login(
	email: string,
	password: string,
): Promise<{ user: CurrentUser; token: string }> {
	const found = await findActiveUserByEmail(email.toLowerCase());

	if (!found) {
		await verifyPassword(password, DUMMY_PASSWORD_HASH);
		throw new UnauthorizedError(INVALID_CREDENTIALS);
	}

	const { passwordHash, ...user } = found;
	if (!(await verifyPassword(password, passwordHash))) {
		throw new UnauthorizedError(INVALID_CREDENTIALS);
	}

	const token = await signAccessToken({
		userId: user.id,
		tenantId: user.tenant.id,
		role: user.role,
	});
	return { user, token };
}

export async function getCurrentUser(
	auth: AccessTokenClaims,
): Promise<CurrentUser> {
	const user = await findActiveUserById(auth.tenantId, auth.userId);
	if (!user) throw new UnauthorizedError();
	return user;
}
