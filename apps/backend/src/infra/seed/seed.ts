import { and, eq, isNull } from "drizzle-orm";
import type { Executor } from "../db.js";
import { hashPassword } from "../password.js";
import { products } from "../schemas/products.js";
import { stockMovements } from "../schemas/stock-movements.js";
import { tenants } from "../schemas/tenants.js";
import { type UserRole, users } from "../schemas/users.js";

type SeedUser = { email: string; password: string; role: UserRole };

type SeedProduct = {
	sku: string;
	name: string;
	priceCents: number;
	stock: number;
};

export const seedTenants: {
	name: string;
	users: SeedUser[];
	products: SeedProduct[];
}[] = [
	{
		name: "Acme",
		users: [
			{
				email: "admin@acme.test",
				password: "acme-admin-password",
				role: "admin",
			},
			{
				email: "operator@acme.test",
				password: "acme-operator-password",
				role: "operator",
			},
		],
		products: [
			{ sku: "CAM-P", name: "Camiseta P", priceCents: 4990, stock: 25 },
			{ sku: "BON-01", name: "Boné", priceCents: 2990, stock: 0 },
		],
	},
	{
		name: "Globex",
		users: [
			{
				email: "admin@globex.test",
				password: "globex-admin-password",
				role: "admin",
			},
			{
				email: "operator@globex.test",
				password: "globex-operator-password",
				role: "operator",
			},
		],
		products: [
			{ sku: "CAM-P", name: "Camiseta P", priceCents: 5490, stock: 10 },
			{ sku: "CAN-01", name: "Caneca", priceCents: 1990, stock: 0 },
		],
	},
];

async function findOrCreateTenant(
	executor: Executor,
	name: string,
): Promise<string> {
	const [existing] = await executor
		.select({ id: tenants.id })
		.from(tenants)
		.where(and(eq(tenants.name, name), isNull(tenants.deletedAt)))
		.limit(1);
	if (existing) return existing.id;

	const [created] = await executor
		.insert(tenants)
		.values({ name })
		.returning({ id: tenants.id });
	if (!created) throw new Error(`Failed to create tenant ${name}`);
	return created.id;
}

async function createUserIfMissing(
	executor: Executor,
	tenantId: string,
	user: SeedUser,
): Promise<string> {
	const email = user.email.toLowerCase();
	const [existing] = await executor
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.email, email), isNull(users.deletedAt)))
		.limit(1);
	if (existing) return existing.id;

	const [created] = await executor
		.insert(users)
		.values({
			tenantId,
			email,
			passwordHash: await hashPassword(user.password),
			role: user.role,
		})
		.returning({ id: users.id });
	if (!created) throw new Error(`Failed to create user ${email}`);
	return created.id;
}

async function createProductIfMissing(
	executor: Executor,
	tenantId: string,
	adminId: string,
	product: SeedProduct,
) {
	const [existing] = await executor
		.select({ id: products.id })
		.from(products)
		.where(
			and(
				eq(products.tenantId, tenantId),
				eq(products.sku, product.sku),
				isNull(products.deletedAt),
			),
		)
		.limit(1);
	if (existing) return;

	await executor.transaction(async (tx) => {
		const [created] = await tx
			.insert(products)
			.values({ tenantId, ...product })
			.returning({ id: products.id });
		if (!created) throw new Error(`Failed to create product ${product.sku}`);

		await tx.insert(stockMovements).values({
			tenantId,
			productId: created.id,
			userId: adminId,
			direction: "in",
			source: "initial",
			quantity: product.stock,
			stockAfter: product.stock,
		});
	});
}

export async function seed(executor: Executor) {
	for (const tenant of seedTenants) {
		const tenantId = await findOrCreateTenant(executor, tenant.name);
		let adminId: string | undefined;
		for (const user of tenant.users) {
			const userId = await createUserIfMissing(executor, tenantId, user);
			if (user.role === "admin") adminId = userId;
		}
		if (!adminId) throw new Error(`Seed tenant ${tenant.name} has no admin`);
		for (const product of tenant.products) {
			await createProductIfMissing(executor, tenantId, adminId, product);
		}
	}
}
