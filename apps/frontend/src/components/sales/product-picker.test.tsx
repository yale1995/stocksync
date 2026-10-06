import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serveCatalog } from "@/test/catalog";
import { makeProduct } from "@/test/fixtures";
import { ProductPicker } from "./product-picker";

afterEach(() => {
	vi.useRealTimers();
});

describe("product picker search", () => {
	it("searches 300 ms after the last keystroke, not before", async () => {
		const catalog = serveCatalog([makeProduct({ name: "Camiseta P" })]);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<ProductPicker
					lineNumber={1}
					value={undefined}
					excludedIds={[]}
					onPick={() => {}}
				/>
			</QueryClientProvider>,
		);
		fireEvent.click(screen.getByRole("combobox", { name: "Product, line 1" }));
		const input = await screen.findByRole("combobox", {
			name: "Search products",
		});
		await waitFor(() => expect(catalog.listRequests).toHaveLength(1));
		const searched = (search: string) =>
			queryClient
				.getQueryCache()
				.find({ queryKey: ["products", "list", { search, page: 1 }] });

		vi.useFakeTimers();
		fireEvent.change(input, { target: { value: "c" } });
		act(() => vi.advanceTimersByTime(200));
		fireEvent.change(input, { target: { value: "ca" } });
		act(() => vi.advanceTimersByTime(299));
		expect(searched("ca")).toBeUndefined();

		act(() => vi.advanceTimersByTime(1));
		expect(searched("ca")).toBeDefined();
		expect(searched("c")).toBeUndefined();
	});
});
