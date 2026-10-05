import type {
	CreateProductInput,
	ListProductsQuery,
	UpdateProductInput,
} from "../../http/controllers/products.validation.js";
import { db, type Transaction } from "../../infra/db.js";
import { ConflictError, NotFoundError } from "../../infra/errors.js";
import { recordInitialMovement } from "../stock-movements/stock-movements.service.js";
import { recordSyncEvent } from "../sync/sync.service.js";
import type { Product } from "./products.repository.js";
import * as repository from "./products.repository.js";

const PRODUCT_NOT_FOUND = "Product not found";

export async function listProducts(tenantId: string, query: ListProductsQuery) {
	const { rows, total } = await repository.listProducts(tenantId, query);
	return {
		data: rows,
		meta: { page: query.page, limit: query.limit, total },
	};
}

export async function getProduct(
	tenantId: string,
	id: string,
): Promise<Product> {
	const product = await repository.findActiveProductById(tenantId, id);
	if (!product) throw new NotFoundError(PRODUCT_NOT_FOUND);
	return product;
}

export function createProduct(
	tenantId: string,
	userId: string,
	input: CreateProductInput,
): Promise<Product> {
	return db.transaction(async (tx) => {
		const existing = await repository.findActiveProductBySku(
			tenantId,
			input.sku,
			tx,
		);
		if (existing) {
			throw new ConflictError(`A product with SKU ${input.sku} already exists`);
		}
		const product = await repository.insertProduct(tenantId, input, tx);
		await recordInitialMovement(tx, {
			tenantId,
			productId: product.id,
			userId,
			quantity: product.stock,
		});
		await recordSyncEvent(tx, {
			tenantId,
			productId: product.id,
			trigger: "product_created",
			sku: product.sku,
			stock: product.stock,
			priceCents: product.priceCents,
		});
		return product;
	});
}

// Lock, decide, write: the price comparison and the event snapshot must come
// from the locked row, or two concurrent PATCHes could compare against a stale
// price and leave the ad with the wrong one.
async function lockProduct(tx: Transaction, tenantId: string, id: string) {
	const [locked] = await repository.lockActiveProductsStock(tenantId, [id], tx);
	if (!locked) throw new NotFoundError(PRODUCT_NOT_FOUND);
	return locked;
}

export function updateProduct(
	tenantId: string,
	id: string,
	input: UpdateProductInput,
): Promise<Product> {
	return db.transaction(async (tx) => {
		const locked = await lockProduct(tx, tenantId, id);

		const updated = await repository.updateProduct(tenantId, id, input, tx);
		if (!updated) throw new NotFoundError(PRODUCT_NOT_FOUND);

		if (
			input.priceCents !== undefined &&
			input.priceCents !== locked.priceCents
		) {
			await recordSyncEvent(tx, {
				tenantId,
				productId: updated.id,
				trigger: "price_changed",
				sku: updated.sku,
				stock: updated.stock,
				priceCents: updated.priceCents,
			});
		}
		return updated;
	});
}

export function deleteProduct(tenantId: string, id: string): Promise<void> {
	return db.transaction(async (tx) => {
		const locked = await lockProduct(tx, tenantId, id);

		if (!(await repository.softDeleteProduct(tenantId, id, tx))) {
			throw new NotFoundError(PRODUCT_NOT_FOUND);
		}
		// The ad shows no stock once the product is gone; the product row keeps
		// its stock and no movement is recorded.
		await recordSyncEvent(tx, {
			tenantId,
			productId: locked.id,
			trigger: "product_deleted",
			sku: locked.sku,
			stock: 0,
			priceCents: locked.priceCents,
		});
	});
}
