import { api } from "./client";
import type { Sale } from "./types";

export interface SaleItemInput {
	productId: string;
	quantity: number;
}

export async function createSale(
	items: SaleItemInput[],
	idempotencyKey: string,
) {
	const { data } = await api.post<Sale>(
		"/sales",
		{ items },
		{ headers: { "Idempotency-Key": idempotencyKey } },
	);
	return data;
}
