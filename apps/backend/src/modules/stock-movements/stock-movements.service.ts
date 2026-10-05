import { MAX_STOCK } from "../../http/controllers/products.validation.js";
import type {
	CreateStockAdjustmentInput,
	ListStockMovementsQuery,
} from "../../http/controllers/stock-movements.validation.js";
import { db, type Transaction } from "../../infra/db.js";
import { ConflictError, NotFoundError } from "../../infra/errors.js";
import type {
	StockMovementDirection,
	StockMovementSource,
} from "../../infra/schemas/stock-movements.js";
import * as productsRepository from "../products/products.repository.js";
import { recordSyncEvent } from "../sync/sync.service.js";
import type { StockMovement } from "./stock-movements.repository.js";
import * as repository from "./stock-movements.repository.js";

const PRODUCT_NOT_FOUND = "Product not found";

export type StockChangeItem = {
	productId: string;
	direction: StockMovementDirection;
	quantity: number;
	reason: string | null;
};

export type StockChanges = {
	tenantId: string;
	userId: string;
	source: Exclude<StockMovementSource, "initial">;
	saleId: string | null;
	notFoundMessage: string;
	items: StockChangeItem[];
};

export type AppliedStockChange = {
	productId: string;
	quantity: number;
	movementId: string;
	priceCents: number;
};

type LockedProduct = { sku: string; stock: number };

function nextStock(product: LockedProduct, item: StockChangeItem): number {
	return item.direction === "in"
		? product.stock + item.quantity
		: product.stock - item.quantity;
}

function insufficientStockMessage(
	shortages: { product: LockedProduct; item: StockChangeItem }[],
): string {
	const details = shortages.map(
		({ product, item }) =>
			`${product.sku} (available: ${product.stock}, requested: ${item.quantity})`,
	);
	return `Insufficient stock for ${details.join(", ")}`;
}

// The only path that changes the stock of an existing product. Runs inside the
// caller's transaction so the sale, the stock, its movements and the sync
// events commit atomically. Items are processed in productId order, the same
// order the rows are locked in.
export async function applyStockChanges(
	tx: Transaction,
	{ tenantId, userId, source, saleId, notFoundMessage, items }: StockChanges,
): Promise<AppliedStockChange[]> {
	// Postgres returns uuids in lowercase whatever case the caller sent.
	const sorted = items
		.map((item) => ({ ...item, productId: item.productId.toLowerCase() }))
		.toSorted((a, b) => (a.productId < b.productId ? -1 : 1));

	const locked = await productsRepository.lockActiveProductsStock(
		tenantId,
		sorted.map((item) => item.productId),
		tx,
	);
	const productsById = new Map(locked.map((product) => [product.id, product]));
	const changes = sorted.map((item) => {
		const product = productsById.get(item.productId);
		if (!product) throw new NotFoundError(notFoundMessage);
		return { item, product, stockAfter: nextStock(product, item) };
	});

	const shortages = changes.filter((change) => change.stockAfter < 0);
	if (shortages.length > 0) {
		throw new ConflictError(insufficientStockMessage(shortages));
	}
	if (changes.some((change) => change.stockAfter > MAX_STOCK)) {
		throw new ConflictError(`Stock cannot exceed ${MAX_STOCK}`);
	}

	const applied: AppliedStockChange[] = [];
	for (const { item, product, stockAfter } of changes) {
		await productsRepository.updateProductStock(
			tenantId,
			product.id,
			stockAfter,
			tx,
		);
		const movementId = await repository.insertStockMovement(
			{ ...item, tenantId, userId, source, saleId, stockAfter },
			tx,
		);
		await recordSyncEvent(tx, {
			tenantId,
			productId: product.id,
			trigger: "stock_changed",
			sku: product.sku,
			stock: stockAfter,
			priceCents: product.priceCents,
		});
		applied.push({
			productId: product.id,
			quantity: item.quantity,
			movementId,
			priceCents: product.priceCents,
		});
	}
	return applied;
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
		const [applied] = await applyStockChanges(tx, {
			tenantId,
			userId,
			source: "adjustment",
			saleId: null,
			notFoundMessage: PRODUCT_NOT_FOUND,
			items: [{ ...input, productId }],
		});
		if (!applied) throw new Error("Stock adjustment applied no change");
		const movement = await repository.findStockMovementById(
			tenantId,
			applied.movementId,
			tx,
		);
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
