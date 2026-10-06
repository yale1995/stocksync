import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductFilters } from "./product-filters";

describe("product search debounce", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("commits the search 300 ms after the last keystroke, not before", () => {
		const onChange = vi.fn();
		render(<ProductFilters values={{}} onChange={onChange} />);
		const input = screen.getByLabelText("Search products");

		fireEvent.change(input, { target: { value: "ca" } });
		act(() => vi.advanceTimersByTime(200));
		fireEvent.change(input, { target: { value: "cam" } });
		act(() => vi.advanceTimersByTime(299));
		expect(onChange).not.toHaveBeenCalled();

		act(() => vi.advanceTimersByTime(1));
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith({ search: "cam" });
	});
});
