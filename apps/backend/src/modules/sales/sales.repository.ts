import { and, asc, eq } from "drizzle-orm";
import { db, type Executor } from "../../infra/db.js";
import { products } from "../../infra/schemas/products.js";
import { saleItems, sales } from "../../infra/schemas/sales.js";
import { users } from "../../infra/schemas/users.js";

export async function insertSale(
	values: Omit<typeof sales.$inferInsert, "id" | "createdAt">,
	executor: Executor = db,
): Promise<string> {
	const [sale] = await executor
		.insert(sales)
		.values(values)
		.returning({ id: sales.id });
	if (!sale) throw new Error("Insert returned no sale");
	return sale.id;
}

export async function insertSaleItems(
	values: Omit<typeof saleItems.$inferInsert, "id">[],
	executor: Executor = db,
): Promise<void> {
	await executor.insert(saleItems).values(values);
}

export async function findSaleByKey(
	tenantId: string,
	idempotencyKey: string,
	executor: Executor = db,
) {
	const [sale] = await executor
		.select({ id: sales.id, requestHash: sales.requestHash })
		.from(sales)
		.where(
			and(
				eq(sales.tenantId, tenantId),
				eq(sales.idempotencyKey, idempotencyKey),
			),
		)
		.limit(1);
	return sale;
}

// No deleted_at filter on users or products: a sale is a past fact and still
// renders, including on a replay, after its product or user is soft deleted.
export async function findSaleById(
	tenantId: string,
	id: string,
	executor: Executor = db,
) {
	const [sale] = await executor
		.select({
			id: sales.id,
			createdAt: sales.createdAt,
			user: { id: users.id, email: users.email },
		})
		.from(sales)
		.innerJoin(
			users,
			and(eq(users.tenantId, sales.tenantId), eq(users.id, sales.userId)),
		)
		.where(and(eq(sales.tenantId, tenantId), eq(sales.id, id)))
		.limit(1);
	if (!sale) return undefined;

	const items = await executor
		.select({
			productId: saleItems.productId,
			sku: products.sku,
			name: products.name,
			quantity: saleItems.quantity,
			unitPriceCents: saleItems.unitPriceCents,
		})
		.from(saleItems)
		.innerJoin(
			products,
			and(
				eq(products.tenantId, saleItems.tenantId),
				eq(products.id, saleItems.productId),
			),
		)
		.where(and(eq(saleItems.tenantId, tenantId), eq(saleItems.saleId, id)))
		.orderBy(asc(saleItems.productId));

	return { ...sale, items };
}
