import { useReducer } from "react";
import type { Product } from "@/api/types";

export interface SaleLine {
	id: string;
	product: Product | undefined;
	quantity: string;
}

export interface SaleFormState {
	lines: SaleLine[];
	idempotencyKey: string;
}

export type SaleFormAction =
	| { type: "add" }
	| { type: "remove"; lineId: string }
	| { type: "pick"; lineId: string; product: Product }
	| { type: "setQuantity"; lineId: string; quantity: string }
	| { type: "reset" };

function emptyLine(): SaleLine {
	return { id: crypto.randomUUID(), product: undefined, quantity: "" };
}

// Any change to the lines is a different request, so it gets a new key. Only
// resubmitting unchanged lines reuses the key, which makes retries safe.
function withLines(lines: SaleLine[]): SaleFormState {
	return { lines, idempotencyKey: crypto.randomUUID() };
}

export function initialSaleForm(): SaleFormState {
	return withLines([emptyLine()]);
}

export function saleFormReducer(
	state: SaleFormState,
	action: SaleFormAction,
): SaleFormState {
	switch (action.type) {
		case "add":
			return withLines([...state.lines, emptyLine()]);
		case "remove":
			if (state.lines.length === 1) return state;
			return withLines(state.lines.filter((line) => line.id !== action.lineId));
		case "pick":
			return withLines(
				state.lines.map((line) =>
					line.id === action.lineId
						? { ...line, product: action.product, quantity: "1" }
						: line,
				),
			);
		case "setQuantity": {
			const line = state.lines.find((item) => item.id === action.lineId);
			if (!line || line.quantity === action.quantity) return state;
			return withLines(
				state.lines.map((item) =>
					item === line ? { ...item, quantity: action.quantity } : item,
				),
			);
		}
		case "reset":
			return initialSaleForm();
	}
}

export function useSaleForm() {
	return useReducer(saleFormReducer, undefined, initialSaleForm);
}

export type LineStatus =
	| { valid: true; quantity: number }
	| { valid: false; message?: string };

export function validateLine(
	line: SaleLine,
	availability: { stock: number } | "unavailable" | undefined,
): LineStatus {
	if (!line.product) return { valid: false };
	if (availability === "unavailable") {
		return { valid: false, message: "This product is no longer available" };
	}

	const trimmed = line.quantity.trim();
	const quantity = Number(trimmed);
	if (trimmed === "" || !Number.isInteger(quantity)) {
		return { valid: false, message: "Enter a whole number" };
	}
	if (quantity < 1) return { valid: false, message: "Enter at least 1" };

	const stock = availability?.stock ?? line.product.stock;
	if (quantity > stock) {
		return { valid: false, message: `Only ${stock} available` };
	}
	return { valid: true, quantity };
}
