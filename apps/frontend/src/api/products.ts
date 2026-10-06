import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { Page, Product } from "./types";

export const PAGE_SIZE = 20;

export interface ProductListParams {
	search?: string;
	outOfStock?: boolean;
	page: number;
}

export async function listProducts({
	search,
	outOfStock,
	page,
}: ProductListParams) {
	const { data } = await api.get<Page<Product>>("/products", {
		// Axios drops undefined params; an empty search means no filter too.
		params: { page, limit: PAGE_SIZE, search: search || undefined, outOfStock },
	});
	return data;
}

export async function getProduct(id: string) {
	const { data } = await api.get<Product>(`/products/${id}`);
	return data;
}

export const productKeys = {
	all: ["products"] as const,
	list: (params: ProductListParams) => ["products", "list", params] as const,
	detail: (id: string) => ["products", "detail", id] as const,
};

export function productsQuery(params: ProductListParams) {
	return queryOptions({
		queryKey: productKeys.list(params),
		queryFn: () => listProducts(params),
		placeholderData: keepPreviousData,
	});
}

// Seeded with the product the caller already has (e.g. a search result), then
// refreshed from the API; invalidating `productKeys.all` refetches it.
export function productQuery(id: string, initialData?: Product) {
	return queryOptions({
		queryKey: productKeys.detail(id),
		queryFn: () => getProduct(id),
		initialData,
	});
}
