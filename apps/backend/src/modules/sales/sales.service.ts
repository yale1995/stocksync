import { createHash } from "node:crypto";
import type {
	CreateSaleInput,
	SaleItemInput,
} from "../../http/controllers/sales.validation.js";
import { db } from "../../infra/db.js";
import { ConflictError } from "../../infra/errors.js";
import { applyStockChanges } from "../stock-movements/stock-movements.service.js";
import * as repository from "./sales.repository.js";

const PRODUCTS_NOT_FOUND = "One or more products were not found";

export type Sale = Awaited<ReturnType<typeof findSale>>;

// Detects a key reused for a different sale. Item order, the key, the user and
// prices are left out, so the same items in another order hash the same.
export function requestHash(items: SaleItemInput[]): string {
	const canonical = items
		.map(({ productId, quantity }) => ({
			productId: productId.toLowerCase(),
			quantity,
		}))
		.toSorted((a, b) => (a.productId < b.productId ? -1 : 1));
	return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

// Drizzle wraps the pg error in `cause`.
function isUniqueViolation(err: unknown): boolean {
	const pgError = err instanceof Error && err.cause ? err.cause : err;
	return (
		typeof pgError === "object" &&
		pgError !== null &&
		"code" in pgError &&
		pgError.code === "23505"
	);
}

async function findSale(tenantId: string, id: string) {
	const sale = await repository.findSaleById(tenantId, id);
	if (!sale) throw new Error("Sale not found after insert");
	const totalCents = sale.items.reduce(
		(total, item) => total + item.quantity * item.unitPriceCents,
		0,
	);
	return {
		id: sale.id,
		items: sale.items,
		totalCents,
		createdAt: sale.createdAt,
		user: sale.user,
	};
}

export async function createSale(
	tenantId: string,
	userId: string,
	idempotencyKey: string,
	{ items }: CreateSaleInput,
): Promise<{ sale: Sale; replayed: boolean }> {
	const hash = requestHash(items);

	try {
		const saleId = await db.transaction(async (tx) => {
			const saleId = await repository.insertSale(
				{ tenantId, userId, idempotencyKey, requestHash: hash },
				tx,
			);
			const applied = await applyStockChanges(tx, {
				tenantId,
				userId,
				source: "sale",
				saleId,
				notFoundMessage: PRODUCTS_NOT_FOUND,
				items: items.map((item) => ({
					...item,
					direction: "out",
					reason: null,
				})),
			});
			await repository.insertSaleItems(
				applied.map(({ productId, quantity, priceCents }) => ({
					tenantId,
					saleId,
					productId,
					quantity,
					unitPriceCents: priceCents,
				})),
				tx,
			);
			return saleId;
		});
		return { sale: await findSale(tenantId, saleId), replayed: false };
	} catch (err) {
		// Deliberate exception to checking before writing: a retried or
		// concurrent request with the same key hits the idempotency unique index
		// (the only unique this transaction can violate) and is replayed. A
		// concurrent insert waits for the first transaction, so the sale is
		// committed by the time it is read here.
		if (!isUniqueViolation(err)) throw err;

		const existing = await repository.findSaleByKey(tenantId, idempotencyKey);
		if (!existing) throw err;
		if (existing.requestHash !== hash) {
			throw new ConflictError(
				"Idempotency key was already used with a different request",
			);
		}
		return { sale: await findSale(tenantId, existing.id), replayed: true };
	}
}
