import {
	and,
	asc,
	count,
	eq,
	gt,
	ilike,
	isNull,
	or,
	type SQL,
} from "drizzle-orm";
import { db, type Executor } from "../../infra/db.js";
import { products } from "../../infra/schemas/products.js";
import type {
	CreateProductInput,
	ListProductsQuery,
	UpdateProductInput,
} from "./products.validation.js";

const productColumns = {
	id: products.id,
	sku: products.sku,
	name: products.name,
	priceCents: products.priceCents,
	stock: products.stock,
	createdAt: products.createdAt,
	updatedAt: products.updatedAt,
};

function isActiveInTenant(tenantId: string): SQL | undefined {
	return and(eq(products.tenantId, tenantId), isNull(products.deletedAt));
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, "\\$&");
}

export async function findActiveProductById(
	tenantId: string,
	id: string,
	executor: Executor = db,
) {
	const [product] = await executor
		.select(productColumns)
		.from(products)
		.where(and(isActiveInTenant(tenantId), eq(products.id, id)))
		.limit(1);
	return product;
}

export async function findActiveProductBySku(
	tenantId: string,
	sku: string,
	executor: Executor = db,
) {
	const [product] = await executor
		.select(productColumns)
		.from(products)
		.where(and(isActiveInTenant(tenantId), eq(products.sku, sku)))
		.limit(1);
	return product;
}

export async function insertProduct(
	tenantId: string,
	input: CreateProductInput,
	executor: Executor = db,
): Promise<Product> {
	const [product] = await executor
		.insert(products)
		.values({ ...input, tenantId })
		.returning(productColumns);
	if (!product) throw new Error("Insert returned no product");
	return product;
}

export async function updateProduct(
	tenantId: string,
	id: string,
	input: UpdateProductInput,
	executor: Executor = db,
) {
	const [product] = await executor
		.update(products)
		.set(input)
		.where(and(isActiveInTenant(tenantId), eq(products.id, id)))
		.returning(productColumns);
	return product;
}

export async function softDeleteProduct(
	tenantId: string,
	id: string,
	executor: Executor = db,
): Promise<boolean> {
	const deleted = await executor
		.update(products)
		.set({ deletedAt: new Date() })
		.where(and(isActiveInTenant(tenantId), eq(products.id, id)))
		.returning({ id: products.id });
	return deleted.length > 0;
}

export type Product = NonNullable<
	Awaited<ReturnType<typeof findActiveProductById>>
>;

export async function listProducts(
	tenantId: string,
	{ page, limit, search, outOfStock }: ListProductsQuery,
	executor: Executor = db,
): Promise<{ rows: Product[]; total: number }> {
	const pattern = search && `%${escapeLikePattern(search)}%`;
	const where = and(
		isActiveInTenant(tenantId),
		pattern
			? or(ilike(products.name, pattern), ilike(products.sku, pattern))
			: undefined,
		outOfStock === undefined
			? undefined
			: outOfStock
				? eq(products.stock, 0)
				: gt(products.stock, 0),
	);

	const rows = await executor
		.select(productColumns)
		.from(products)
		.where(where)
		.orderBy(asc(products.name), asc(products.id))
		.limit(limit)
		.offset((page - 1) * limit);
	const [counted] = await executor
		.select({ total: count() })
		.from(products)
		.where(where);

	return { rows, total: counted?.total ?? 0 };
}
