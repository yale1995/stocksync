import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Page, Product } from "./types";

export const PAGE_SIZE = 20;

export interface ProductListParams {
	search?: string;
	outOfStock?: boolean;
	page: number;
}

export function listProducts({ search, outOfStock, page }: ProductListParams) {
	const params = new URLSearchParams({
		page: String(page),
		limit: String(PAGE_SIZE),
	});
	if (search) params.set("search", search);
	if (outOfStock !== undefined) params.set("outOfStock", String(outOfStock));
	return apiFetch<Page<Product>>(`/products?${params}`);
}

export const productKeys = {
	all: ["products"] as const,
	list: (params: ProductListParams) => ["products", "list", params] as const,
};

export function productsQuery(params: ProductListParams) {
	return queryOptions({
		queryKey: productKeys.list(params),
		queryFn: () => listProducts(params),
		placeholderData: keepPreviousData,
	});
}
