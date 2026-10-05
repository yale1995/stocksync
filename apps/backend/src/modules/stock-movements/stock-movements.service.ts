import { ConflictError, NotFoundError } from "../../http/errors.js";
import { db, type Transaction } from "../../infra/db.js";
import type {
	StockMovementDirection,
	StockMovementSource,
} from "../../infra/schemas/stock-movements.js";
import * as productsRepository from "../products/products.repository.js";
import { MAX_STOCK } from "../products/products.validation.js";
import type { StockMovement } from "./stock-movements.repository.js";
import * as repository from "./stock-movements.repository.js";
import type {
	CreateStockAdjustmentInput,
	ListStockMovementsQuery,
} from "./stock-movements.validation.js";

const PRODUCT_NOT_FOUND = "Product not found";

export type StockChange = {
	tenantId: string;
	productId: string;
	userId: string;
	direction: StockMovementDirection;
	quantity: number;
	source: Exclude<StockMovementSource, "initial">;
	reason: string | null;
};

// The only path that changes the stock of an existing product. Runs inside the
// caller's transaction so sales and the Part B sync event commit atomically
// with the stock and its movement.
export async function applyStockChange(
	tx: Transaction,
	change: StockChange,
): Promise<string> {
	const product = await productsRepository.lockActiveProductStock(
		change.tenantId,
		change.productId,
		tx,
	);
	if (!product) {
		throw new NotFoundError(PRODUCT_NOT_FOUND);
	}

	const stockAfter =
		change.direction === "in"
			? product.stock + change.quantity
			: product.stock - change.quantity;

	if (stockAfter < 0) {
		throw new ConflictError("Insufficient stock");
	}

	if (stockAfter > MAX_STOCK) {
		throw new ConflictError(`Stock cannot exceed ${MAX_STOCK}`);
	}

	await productsRepository.updateProductStock(
		change.tenantId,
		change.productId,
		stockAfter,
		tx,
	);

	return repository.insertStockMovement({ ...change, stockAfter }, tx);
}

// The product row was inserted in the same transaction, so there is nothing to
// lock and its stock already equals the initial quantity.
export async function recordInitialMovement(
	tx: Transaction,
	{
		tenantId,
		productId,
		userId,
		quantity,
	}: { tenantId: string; productId: string; userId: string; quantity: number },
): Promise<void> {
	await repository.insertStockMovement(
		{
			tenantId,
			productId,
			userId,
			direction: "in",
			source: "initial",
			quantity,
			stockAfter: quantity,
			reason: null,
		},
		tx,
	);
}

export function createStockAdjustment(
	tenantId: string,
	userId: string,
	productId: string,
	input: CreateStockAdjustmentInput,
): Promise<StockMovement> {
	return db.transaction(async (tx) => {
		const id = await applyStockChange(tx, {
			...input,
			tenantId,
			productId,
			userId,
			source: "adjustment",
		});
		const movement = await repository.findStockMovementById(tenantId, id, tx);
		if (!movement) throw new Error("Created stock movement not found");
		return movement;
	});
}

export async function listProductStockMovements(
	tenantId: string,
	productId: string,
	query: ListStockMovementsQuery,
) {
	const product = await productsRepository.findActiveProductById(
		tenantId,
		productId,
	);
	if (!product) throw new NotFoundError(PRODUCT_NOT_FOUND);

	const { rows, total } = await repository.listStockMovements(
		tenantId,
		productId,
		query,
	);
	return {
		data: rows,
		meta: { page: query.page, limit: query.limit, total },
	};
}
