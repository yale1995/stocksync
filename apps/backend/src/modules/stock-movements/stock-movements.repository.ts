import { and, count, desc, eq } from "drizzle-orm";
import { db, type Executor } from "../../infra/db.js";
import { stockMovements } from "../../infra/schemas/stock-movements.js";
import { users } from "../../infra/schemas/users.js";
import type { ListStockMovementsQuery } from "./stock-movements.validation.js";

const movementColumns = {
	id: stockMovements.id,
	direction: stockMovements.direction,
	quantity: stockMovements.quantity,
	stockAfter: stockMovements.stockAfter,
	source: stockMovements.source,
	reason: stockMovements.reason,
	createdAt: stockMovements.createdAt,
	user: { id: users.id, email: users.email },
};

// No deleted_at filter on users: the history keeps showing who made a
// movement after that user is soft deleted.
const movementUserJoin = and(
	eq(users.tenantId, stockMovements.tenantId),
	eq(users.id, stockMovements.userId),
);

export type NewStockMovement = Omit<
	typeof stockMovements.$inferInsert,
	"id" | "createdAt"
>;

export async function insertStockMovement(
	values: NewStockMovement,
	executor: Executor = db,
): Promise<string> {
	const [movement] = await executor
		.insert(stockMovements)
		.values(values)
		.returning({ id: stockMovements.id });
	if (!movement) throw new Error("Insert returned no stock movement");
	return movement.id;
}

export async function findStockMovementById(
	tenantId: string,
	id: string,
	executor: Executor = db,
) {
	const [movement] = await executor
		.select(movementColumns)
		.from(stockMovements)
		.innerJoin(users, movementUserJoin)
		.where(
			and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.id, id)),
		)
		.limit(1);
	return movement;
}

export type StockMovement = NonNullable<
	Awaited<ReturnType<typeof findStockMovementById>>
>;

export async function listStockMovements(
	tenantId: string,
	productId: string,
	{ page, limit }: ListStockMovementsQuery,
	executor: Executor = db,
): Promise<{ rows: StockMovement[]; total: number }> {
	const where = and(
		eq(stockMovements.tenantId, tenantId),
		eq(stockMovements.productId, productId),
	);

	const rows = await executor
		.select(movementColumns)
		.from(stockMovements)
		.innerJoin(users, movementUserJoin)
		.where(where)
		.orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
		.limit(limit)
		.offset((page - 1) * limit);
	const [counted] = await executor
		.select({ total: count() })
		.from(stockMovements)
		.where(where);

	return { rows, total: counted?.total ?? 0 };
}
