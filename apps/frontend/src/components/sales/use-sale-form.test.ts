import { describe, expect, it } from "vitest";
import { makeProduct } from "@/test/fixtures";
import {
	initialSaleForm,
	type SaleFormState,
	saleFormReducer,
	validateLine,
} from "./use-sale-form";

const camiseta = makeProduct({ name: "Camiseta P", stock: 25 });
const bone = makeProduct({ name: "Boné", stock: 2 });

function withPickedLine(): SaleFormState {
	const state = initialSaleForm();
	const [line] = state.lines;
	return saleFormReducer(state, {
		type: "pick",
		lineId: line?.id ?? "",
		product: camiseta,
	});
}

describe("sale form reducer", () => {
	it("opens with one empty line and a UUID key", () => {
		const state = initialSaleForm();

		expect(state.lines).toHaveLength(1);
		expect(state.lines[0]).toMatchObject({ product: undefined, quantity: "" });
		expect(state.idempotencyKey).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});

	it("sets quantity 1 when a product is picked", () => {
		const state = withPickedLine();

		expect(state.lines[0]).toMatchObject({ product: camiseta, quantity: "1" });
	});

	it.each([
		{ action: "add" as const },
		{ action: "pick" as const },
		{ action: "setQuantity" as const },
		{ action: "remove" as const },
		{ action: "reset" as const },
	])("generates a new key on $action", ({ action }) => {
		let state = saleFormReducer(withPickedLine(), { type: "add" });
		const [first, second] = state.lines;
		const before = state.idempotencyKey;

		switch (action) {
			case "add":
				state = saleFormReducer(state, { type: "add" });
				break;
			case "pick":
				state = saleFormReducer(state, {
					type: "pick",
					lineId: second?.id ?? "",
					product: bone,
				});
				break;
			case "setQuantity":
				state = saleFormReducer(state, {
					type: "setQuantity",
					lineId: first?.id ?? "",
					quantity: "3",
				});
				break;
			case "remove":
				state = saleFormReducer(state, {
					type: "remove",
					lineId: second?.id ?? "",
				});
				break;
			case "reset":
				state = saleFormReducer(state, { type: "reset" });
				break;
		}

		expect(state.idempotencyKey).not.toBe(before);
	});

	it("keeps the key when nothing changes", () => {
		const state = withPickedLine();
		const [line] = state.lines;

		const next = saleFormReducer(state, {
			type: "setQuantity",
			lineId: line?.id ?? "",
			quantity: "1",
		});

		expect(next).toBe(state);
	});

	it("never removes the last line", () => {
		const state = withPickedLine();
		const [line] = state.lines;

		const next = saleFormReducer(state, {
			type: "remove",
			lineId: line?.id ?? "",
		});

		expect(next).toBe(state);
	});

	it("resets to one empty line", () => {
		const state = saleFormReducer(
			saleFormReducer(withPickedLine(), { type: "add" }),
			{ type: "reset" },
		);

		expect(state.lines).toHaveLength(1);
		expect(state.lines[0]).toMatchObject({ product: undefined, quantity: "" });
	});
});

describe("validateLine", () => {
	const line = (quantity: string) => ({
		id: "line-1",
		product: bone,
		quantity,
	});

	it.each([
		{ quantity: "1", stock: 2, expected: { valid: true, quantity: 1 } },
		{ quantity: "2", stock: 2, expected: { valid: true, quantity: 2 } },
		{
			quantity: "3",
			stock: 2,
			expected: { valid: false, message: "Only 2 available" },
		},
		{
			quantity: "1",
			stock: 0,
			expected: { valid: false, message: "Only 0 available" },
		},
		{
			quantity: "0",
			stock: 2,
			expected: { valid: false, message: "Enter at least 1" },
		},
		{
			quantity: "-1",
			stock: 2,
			expected: { valid: false, message: "Enter at least 1" },
		},
		{
			quantity: "1.5",
			stock: 2,
			expected: { valid: false, message: "Enter a whole number" },
		},
		{
			quantity: "",
			stock: 2,
			expected: { valid: false, message: "Enter a whole number" },
		},
		{
			quantity: "abc",
			stock: 2,
			expected: { valid: false, message: "Enter a whole number" },
		},
	])(
		"quantity $quantity with stock $stock",
		({ quantity, stock, expected }) => {
			expect(validateLine(line(quantity), { stock })).toEqual(expected);
		},
	);

	it("is incomplete without a product, with no message", () => {
		expect(
			validateLine(
				{ id: "line-1", product: undefined, quantity: "" },
				undefined,
			),
		).toEqual({ valid: false });
	});

	it("reports a product that is no longer available", () => {
		expect(validateLine(line("1"), "unavailable")).toEqual({
			valid: false,
			message: "This product is no longer available",
		});
	});
});
