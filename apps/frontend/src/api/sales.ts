import { apiFetch } from "./client";
import type { Sale } from "./types";

export interface SaleItemInput {
	productId: string;
	quantity: number;
}

export function createSale(items: SaleItemInput[], idempotencyKey: string) {
	return apiFetch<Sale>("/sales", {
		method: "POST",
		body: { items },
		headers: { "Idempotency-Key": idempotencyKey },
	});
}
