import type { CurrentUser, Page, Product } from "@/api/types";

export const currentUser: CurrentUser = {
	id: "8c1f7a52-3d2e-4b8a-9f61-0a4c2d1e5b73",
	email: "operator@acme.test",
	role: "operator",
	tenant: { id: "1b9e4c3a-7f2d-4e6b-8a15-c2d3e4f5a6b7", name: "Acme" },
};

export const unauthorized = {
	error: { code: "UNAUTHORIZED", message: "Authentication required" },
};

export function makeProduct(overrides: Partial<Product> = {}): Product {
	return {
		id: crypto.randomUUID(),
		sku: "CAM-P",
		name: "Camiseta P",
		priceCents: 4990,
		stock: 25,
		createdAt: "2026-10-01T12:00:00.000Z",
		updatedAt: "2026-10-01T12:00:00.000Z",
		...overrides,
	};
}

export function page<T>(
	data: T[],
	meta: Partial<Page<T>["meta"]> = {},
): Page<T> {
	return {
		data,
		meta: { page: 1, limit: 20, total: data.length, ...meta },
	};
}
