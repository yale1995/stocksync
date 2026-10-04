import { and, eq, isNull } from "drizzle-orm";
import { db, type Executor } from "../../infra/db.js";
import { tenants } from "../../infra/schemas/tenants.js";
import { users } from "../../infra/schemas/users.js";

const currentUserColumns = {
	id: users.id,
	email: users.email,
	role: users.role,
	tenant: { id: tenants.id, name: tenants.name },
};

const isActive = and(isNull(users.deletedAt), isNull(tenants.deletedAt));

// Login happens before the tenant is known, so this is the one query not scoped
// by tenantId; emails are globally unique among active users.
export async function findActiveUserByEmail(
	email: string,
	executor: Executor = db,
) {
	const [user] = await executor
		.select({ ...currentUserColumns, passwordHash: users.passwordHash })
		.from(users)
		.innerJoin(tenants, eq(users.tenantId, tenants.id))
		.where(and(eq(users.email, email), isActive))
		.limit(1);
	return user;
}

export async function findActiveUserById(
	tenantId: string,
	userId: string,
	executor: Executor = db,
) {
	const [user] = await executor
		.select(currentUserColumns)
		.from(users)
		.innerJoin(tenants, eq(users.tenantId, tenants.id))
		.where(and(eq(users.tenantId, tenantId), eq(users.id, userId), isActive))
		.limit(1);
	return user;
}

export type CurrentUser = NonNullable<
	Awaited<ReturnType<typeof findActiveUserById>>
>;
