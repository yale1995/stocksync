import { act, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import type { Page, Product } from "@/api/types";
import { apiUrl } from "@/test/api-url";
import { makeProduct, page } from "@/test/fixtures";
import { signedIn } from "@/test/handlers";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";

const camiseta = makeProduct({
	sku: "CAM-P",
	name: "Camiseta P",
	priceCents: 4990,
	stock: 25,
});
const bone = makeProduct({
	sku: "BON-01",
	name: "Boné",
	priceCents: 2990,
	stock: 0,
});

function serveProducts(
	respond: (url: URL) => Page<Product> | Response | Promise<Response>,
) {
	const requests: URL[] = [];
	server.use(
		http.get(apiUrl("/products"), ({ request }) => {
			const url = new URL(request.url);
			requests.push(url);
			const result = respond(url);
			return result instanceof Response || result instanceof Promise
				? result
				: HttpResponse.json(result);
		}),
	);
	return requests;
}

function queryOf(url: URL | undefined) {
	return Object.fromEntries(url?.searchParams ?? []);
}

function renderProducts(path = "/products") {
	signedIn();
	return renderApp(path);
}

async function findTable() {
	return screen.findByRole("table", { name: "Products" });
}

describe("products page", () => {
	it("lists the products in API order with SKU, name, price and stock", async () => {
		serveProducts(() => page([camiseta, bone]));
		renderProducts();

		const table = await findTable();
		const headers = within(table)
			.getAllByRole("columnheader")
			.map((cell) => cell.textContent);
		expect(headers).toEqual(["SKU", "Name", "Price", "Stock"]);

		const rows = within(table).getAllByRole("row").slice(1);
		expect(
			rows.map((row) =>
				within(row)
					.getAllByRole("cell")
					.map((cell) => cell.textContent),
			),
		).toEqual([
			["CAM-P", "Camiseta P", "$49.90", "25"],
			["BON-01", "Boné", "$29.90", "Out of stock0"],
		]);
	});

	it("shows an Out of stock badge only on products with stock 0", async () => {
		serveProducts(() => page([camiseta, bone]));
		renderProducts();

		const table = await findTable();
		const [, inStockRow, outOfStockRow] = within(table).getAllByRole("row");
		expect(
			within(outOfStockRow as HTMLElement).getByText("Out of stock"),
		).toBeVisible();
		expect(
			within(inStockRow as HTMLElement).queryByText("Out of stock"),
		).not.toBeInTheDocument();
	});

	it("shows skeleton rows and a loading status while the first page loads", async () => {
		let respond: () => void = () => {};
		const requests = serveProducts(
			() =>
				new Promise<Response>((resolve) => {
					respond = () => resolve(HttpResponse.json(page([camiseta])));
				}),
		);
		renderProducts();

		expect(await screen.findByRole("status")).toHaveTextContent(
			"Loading products…",
		);
		const skeletonRows = [
			...document.querySelectorAll("[aria-hidden=true] tbody tr"),
		].filter((row) => row.querySelector("[data-slot=skeleton]"));
		expect(skeletonRows).toHaveLength(5);

		await waitFor(() => expect(requests).toHaveLength(1));
		respond();
		await findTable();
		expect(screen.queryByText("Loading products…")).not.toBeInTheDocument();
	});

	it("shows the error and requests the same page again on Retry", async () => {
		let fail = true;
		const requests = serveProducts(() =>
			fail
				? HttpResponse.json(
						{
							error: {
								code: "INTERNAL_SERVER_ERROR",
								message: "Internal server error",
							},
						},
						{ status: 500 },
					)
				: page([camiseta], { page: 2, total: 21 }),
		);
		const { user } = renderProducts("/products?page=2");

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Internal server error",
		);
		fail = false;
		await user.click(screen.getByRole("button", { name: "Retry" }));

		await findTable();
		expect(requests).toHaveLength(2);
		expect(queryOf(requests[1])).toEqual(queryOf(requests[0]));
		expect(queryOf(requests[1]).page).toBe("2");
	});

	it("says there are no products yet when the catalog is empty", async () => {
		serveProducts(() => page([]));
		renderProducts();

		expect(await screen.findByText("No products yet")).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Clear filters" }),
		).not.toBeInTheDocument();
	});

	it.each([
		{ filter: "a search", path: "/products?search=xyz" },
		{ filter: "a stock filter", path: "/products?outOfStock=true" },
	])("offers Clear filters when nothing matches $filter", async ({ path }) => {
		const requests = serveProducts((url) =>
			url.searchParams.size > 2 ? page([]) : page([camiseta, bone]),
		);
		const { user, router } = renderProducts(path);

		expect(
			await screen.findByText("No products match your filters"),
		).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Clear filters" }));

		await findTable();
		expect(router.state.location.searchStr).toBe("");
		expect(queryOf(requests.at(-1))).toEqual({ page: "1", limit: "20" });
	});

	it("requests the URL's search, stock filter and page with limit 20", async () => {
		const requests = serveProducts(() => page([bone], { page: 2, total: 21 }));
		renderProducts("/products?search=bon&outOfStock=true&page=2");

		await findTable();
		expect(queryOf(requests[0])).toEqual({
			search: "bon",
			outOfStock: "true",
			page: "2",
			limit: "20",
		});
	});

	it.each([
		{ param: "page=abc", path: "/products?page=abc" },
		{ param: "page=0", path: "/products?page=0" },
		{ param: "page=1.5", path: "/products?page=1.5" },
		{ param: "outOfStock=maybe", path: "/products?outOfStock=maybe" },
	])("falls back to the defaults for $param", async ({ path }) => {
		const requests = serveProducts(() => page([camiseta]));
		renderProducts(path);

		await findTable();
		expect(queryOf(requests[0])).toEqual({ page: "1", limit: "20" });
	});

	it("reads a numeric search from a shared link as text", async () => {
		const requests = serveProducts(() => page([camiseta]));
		renderProducts("/products?search=123");

		await findTable();
		expect(queryOf(requests[0]).search).toBe("123");
	});
});

describe("products filters", () => {
	it("labels the search input and the stock filter", async () => {
		serveProducts(() => page([camiseta]));
		renderProducts();

		expect(await screen.findByLabelText("Search products")).toHaveAttribute(
			"maxLength",
			"100",
		);
		expect(screen.getByRole("combobox", { name: "Stock" })).toHaveTextContent(
			"All",
		);
	});

	it("writes the search to the URL after typing stops and resets the page", async () => {
		const requests = serveProducts(() => page([camiseta], { total: 60 }));
		const { user, router } = renderProducts("/products?page=3");
		await findTable();

		await user.type(screen.getByLabelText("Search products"), "cam");

		await waitFor(() =>
			expect(router.state.location.searchStr).toBe("?search=cam"),
		);
		await waitFor(() =>
			expect(queryOf(requests.at(-1))).toEqual({
				search: "cam",
				page: "1",
				limit: "20",
			}),
		);
		const searches = requests.map((url) => url.searchParams.get("search"));
		expect(searches).not.toContain("c");
		expect(searches).not.toContain("ca");
	});

	it("keeps what the user is typing when the URL changes mid-typing", async () => {
		serveProducts(() => page([camiseta]));
		const { user, router } = renderProducts();
		await findTable();
		const input = screen.getByLabelText("Search products");

		await user.type(input, "cam");
		await act(() =>
			router.navigate({ to: "/products", search: { search: "old" } }),
		);

		expect(input).toHaveValue("cam");
		await waitFor(() =>
			expect(router.state.location.searchStr).toBe("?search=cam"),
		);
		expect(input).toHaveValue("cam");
	});

	it.each([
		{
			option: "Out of stock",
			from: "/products?page=2",
			param: "true",
			searchStr: "?outOfStock=true",
		},
		{
			option: "In stock",
			from: "/products?page=2",
			param: "false",
			searchStr: "?outOfStock=false",
		},
		{
			option: "All",
			from: "/products?outOfStock=true&page=2",
			param: null,
			searchStr: "",
		},
	])(
		"sets the stock filter for $option and resets the page",
		async ({ option, from, param, searchStr }) => {
			const requests = serveProducts(() =>
				page([camiseta, bone], { total: 60 }),
			);
			const { user, router } = renderProducts(from);
			await findTable();

			await user.click(screen.getByRole("combobox", { name: "Stock" }));
			await user.click(await screen.findByRole("option", { name: option }));

			await waitFor(() =>
				expect(router.state.location.searchStr).toBe(searchStr),
			);
			await waitFor(() =>
				expect(requests.at(-1)?.searchParams.get("page")).toBe("1"),
			);
			expect(requests.at(-1)?.searchParams.get("outOfStock")).toBe(param);
		},
	);

	it("shows the URL's values again after going back", async () => {
		serveProducts(() => page([camiseta, bone]));
		const { user, router } = renderProducts("/products?search=cam");
		await findTable();
		expect(screen.getByLabelText("Search products")).toHaveValue("cam");

		await user.click(screen.getByRole("combobox", { name: "Stock" }));
		await user.click(
			await screen.findByRole("option", { name: "Out of stock" }),
		);
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({ outOfStock: true }),
		);
		await user.clear(screen.getByLabelText("Search products"));
		await waitFor(() =>
			expect(router.state.location.searchStr).toBe("?outOfStock=true"),
		);

		await act(() => router.history.back());
		await waitFor(() =>
			expect(screen.getByLabelText("Search products")).toHaveValue("cam"),
		);
		expect(screen.getByRole("combobox", { name: "Stock" })).toHaveTextContent(
			"Out of stock",
		);

		await act(() => router.history.back());
		await waitFor(() =>
			expect(screen.getByRole("combobox", { name: "Stock" })).toHaveTextContent(
				"All",
			),
		);
		expect(screen.getByLabelText("Search products")).toHaveValue("cam");
	});
});

describe("products pagination", () => {
	function pageOf(url: URL) {
		return Number(url.searchParams.get("page"));
	}

	it.each([
		{ total: 45, at: 1, label: "Page 1 of 3", previous: false, next: true },
		{ total: 45, at: 2, label: "Page 2 of 3", previous: true, next: true },
		{ total: 45, at: 3, label: "Page 3 of 3", previous: true, next: false },
		{ total: 20, at: 1, label: "Page 1 of 1", previous: false, next: false },
		{ total: 21, at: 2, label: "Page 2 of 2", previous: true, next: false },
	])(
		"shows $label for $total products on page $at",
		async ({ total, at, label, previous, next }) => {
			serveProducts((url) => page([camiseta], { page: pageOf(url), total }));
			renderProducts(`/products?page=${at}`);

			const nav = await screen.findByRole("navigation", { name: "Pagination" });
			expect(within(nav).getByText(label)).toBeVisible();
			const previousButton = within(nav).getByRole("button", {
				name: "Previous",
			});
			const nextButton = within(nav).getByRole("button", { name: "Next" });
			expect(previousButton).toHaveProperty("disabled", !previous);
			expect(nextButton).toHaveProperty("disabled", !next);
		},
	);

	it("moves to the next and previous page through the URL", async () => {
		const requests = serveProducts((url) =>
			page([makeProduct({ name: `Item ${pageOf(url)}` })], {
				page: pageOf(url),
				total: 45,
			}),
		);
		const { user, router } = renderProducts("/products?search=item");
		await screen.findByText("Item 1");

		await user.click(screen.getByRole("button", { name: "Next" }));
		expect(await screen.findByText("Item 2")).toBeVisible();
		expect(router.state.location.search).toMatchObject({
			search: "item",
			page: 2,
		});
		expect(queryOf(requests.at(-1))).toEqual({
			search: "item",
			page: "2",
			limit: "20",
		});

		await user.click(screen.getByRole("button", { name: "Previous" }));
		expect(await screen.findByText("Item 1")).toBeVisible();
		expect(router.state.location.searchStr).toBe("?search=item");
	});

	it("goes from page 3 to page 2 with Previous", async () => {
		const requests = serveProducts((url) =>
			page([makeProduct({ name: `Item ${pageOf(url)}` })], {
				page: pageOf(url),
				total: 45,
			}),
		);
		const { user, router } = renderProducts("/products?page=3");
		await screen.findByText("Item 3");

		await user.click(screen.getByRole("button", { name: "Previous" }));

		expect(await screen.findByText("Item 2")).toBeVisible();
		expect(router.state.location.search).toMatchObject({ page: 2 });
		expect(requests.at(-1)?.searchParams.get("page")).toBe("2");
	});

	it("keeps the previous page's rows visible while the next page loads", async () => {
		let releasePage2: () => void = () => {};
		const requests = serveProducts((url) => {
			const current = pageOf(url);
			const body = page([makeProduct({ name: `Item ${current}` })], {
				page: current,
				total: 45,
			});
			if (current === 1) return body;
			return new Promise<Response>((resolve) => {
				releasePage2 = () => resolve(HttpResponse.json(body));
			});
		});
		const { user, router } = renderProducts();
		await screen.findByText("Item 1");

		await user.click(screen.getByRole("button", { name: "Next" }));
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({ page: 2 }),
		);
		expect(screen.getByText("Item 1")).toBeVisible();
		expect(screen.getByRole("table", { name: "Products" })).toHaveAttribute(
			"aria-busy",
			"true",
		);
		expect(screen.queryByRole("status")).not.toBeInTheDocument();

		await waitFor(() =>
			expect(requests.at(-1)?.searchParams.get("page")).toBe("2"),
		);
		releasePage2();
		expect(await screen.findByText("Item 2")).toBeVisible();
		expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
	});

	it("explains an empty page past the end and goes back to the first page", async () => {
		const requests = serveProducts((url) =>
			pageOf(url) === 9
				? page([], { page: 9, total: 25 })
				: page([camiseta], { page: pageOf(url), total: 25 }),
		);
		const { user, router } = renderProducts(
			"/products?outOfStock=false&page=9",
		);

		expect(await screen.findByText("This page is empty")).toBeVisible();
		expect(screen.queryByText("No products yet")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Go to first page" }));

		await findTable();
		expect(router.state.location.searchStr).toBe("?outOfStock=false");
		expect(queryOf(requests.at(-1))).toEqual({
			outOfStock: "false",
			page: "1",
			limit: "20",
		});
	});
});
