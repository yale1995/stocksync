import { ConflictError, NotFoundError } from "../../http/errors.js";
import { db } from "../../infra/db.js";
import type { Product } from "./products.repository.js";
import * as repository from "./products.repository.js";
import type {
	CreateProductInput,
	ListProductsQuery,
	UpdateProductInput,
} from "./products.validation.js";

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
		return repository.insertProduct(tenantId, input, tx);
	});
}

export function updateProduct(
	tenantId: string,
	id: string,
	input: UpdateProductInput,
): Promise<Product> {
	return db.transaction(async (tx) => {
		const existing = await repository.findActiveProductById(tenantId, id, tx);
		if (!existing) throw new NotFoundError(PRODUCT_NOT_FOUND);

		const updated = await repository.updateProduct(tenantId, id, input, tx);
		if (!updated) throw new NotFoundError(PRODUCT_NOT_FOUND);
		return updated;
	});
}

export function deleteProduct(tenantId: string, id: string): Promise<void> {
	return db.transaction(async (tx) => {
		const existing = await repository.findActiveProductById(tenantId, id, tx);
		if (!existing) throw new NotFoundError(PRODUCT_NOT_FOUND);

		if (!(await repository.softDeleteProduct(tenantId, id, tx))) {
			throw new NotFoundError(PRODUCT_NOT_FOUND);
		}
	});
}
