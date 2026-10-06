import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import type { Sale } from "@/api/types";
import { apiUrl } from "@/test/api-url";
import { serveCatalog } from "@/test/catalog";
import { makeProduct } from "@/test/fixtures";
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
const caneca = makeProduct({
	sku: "CAN-01",
	name: "Caneca",
	priceCents: 1500,
	stock: 2,
});

type User = ReturnType<typeof renderApp>["user"];

async function renderNewSale(products = [camiseta, bone, caneca]) {
	signedIn();
	const catalog = serveCatalog(products);
	const app = renderApp("/sales/new");
	await screen.findByRole("heading", { level: 1, name: "New sale" });
	return { ...app, catalog };
}

function picker(line: number) {
	return screen.getByRole("combobox", {
		name: new RegExp(`^Product, line ${line}`),
	});
}

async function pickProduct(user: User, line: number, name: string) {
	await user.click(picker(line));
	await user.type(
		await screen.findByRole("combobox", { name: "Search products" }),
		name.slice(0, 3),
	);
	await user.click(
		await screen.findByRole("option", { name: new RegExp(`^${name}`) }),
	);
}

function lineRow(line: number) {
	const row = picker(line).closest("tr");
	if (!row) throw new Error(`line ${line} has no row`);
	return row;
}

describe("new sale form", () => {
	it("opens with one empty line and an Add product button", async () => {
		await renderNewSale();

		expect(picker(1)).toHaveTextContent("Choose a product");
		expect(
			screen.queryByRole("combobox", { name: /^Product, line 2/ }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add product" })).toBeEnabled();
	});

	it("adds an empty line", async () => {
		const { user } = await renderNewSale();

		await user.click(screen.getByRole("button", { name: "Add product" }));

		expect(picker(2)).toHaveTextContent("Choose a product");
	});

	it("removes a line and never the last one", async () => {
		const { user } = await renderNewSale();
		expect(
			screen.getByRole("button", { name: "Remove line 1" }),
		).toBeDisabled();

		await pickProduct(user, 1, "Camiseta P");
		await user.click(screen.getByRole("button", { name: "Add product" }));
		await pickProduct(user, 2, "Caneca");
		await user.click(screen.getByRole("button", { name: "Remove line 1" }));

		expect(picker(1)).toHaveAccessibleName("Product, line 1: Caneca");
		expect(
			screen.queryByRole("combobox", { name: /^Product, line 2/ }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Remove line 1" }),
		).toBeDisabled();
	});

	it("searches the API after typing stops and lists name, SKU and stock", async () => {
		const { user, catalog } = await renderNewSale();

		await user.click(picker(1));
		await user.type(
			screen.getByRole("combobox", { name: "Search products" }),
			"ca",
		);

		const option = await screen.findByRole("option", { name: /^Camiseta P/ });
		expect(option).toHaveTextContent("CAM-P");
		expect(option).toHaveTextContent("25 in stock");
		expect(screen.getByRole("option", { name: /^Caneca/ })).toHaveTextContent(
			"2 in stock",
		);
		await waitFor(() =>
			expect(catalog.listRequests.at(-1)?.searchParams.get("search")).toBe(
				"ca",
			),
		);
		expect(
			catalog.listRequests.map((url) => url.searchParams.get("search")),
		).not.toContain("c");
		expect(catalog.listRequests.at(-1)?.searchParams.get("page")).toBe("1");
	});

	it("labels out-of-stock products in the picker", async () => {
		const { user } = await renderNewSale();

		await user.click(picker(1));
		await user.type(
			screen.getByRole("combobox", { name: "Search products" }),
			"bon",
		);

		expect(
			await screen.findByRole("option", { name: /^Boné/ }),
		).toHaveTextContent("Out of stock");
	});

	it("does not offer a product already chosen in another line", async () => {
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");
		await user.click(screen.getByRole("button", { name: "Add product" }));

		await user.click(picker(2));
		await user.type(
			screen.getByRole("combobox", { name: "Search products" }),
			"ca",
		);

		expect(
			await screen.findByRole("option", { name: /^Caneca/ }),
		).toBeVisible();
		expect(
			screen.queryByRole("option", { name: /^Camiseta P/ }),
		).not.toBeInTheDocument();
	});

	it("shows the picked product with its stock from GET /products/:id", async () => {
		const { user, catalog } = await renderNewSale();
		catalog.setStock(camiseta.id, 24);

		await pickProduct(user, 1, "Camiseta P");

		const row = lineRow(1);
		expect(picker(1)).toHaveTextContent("Camiseta P");
		expect(picker(1)).toHaveTextContent("CAM-P");
		expect(
			screen.getByRole("spinbutton", { name: "Quantity, line 1" }),
		).toHaveValue(1);
		expect(within(row).getByTestId("line-price")).toHaveTextContent("$49.90");
		await waitFor(() =>
			expect(within(row).getByTestId("line-stock")).toHaveTextContent("24"),
		);
		expect(catalog.detailRequests).toContain(camiseta.id);
	});

	it("shows line subtotals and the sale total", async () => {
		const { user } = await renderNewSale([
			camiseta,
			makeProduct({
				sku: "BON-02",
				name: "Boné azul",
				priceCents: 2990,
				stock: 5,
			}),
		]);
		await pickProduct(user, 1, "Camiseta P");
		const quantity = screen.getByRole("spinbutton", {
			name: "Quantity, line 1",
		});
		await user.clear(quantity);
		await user.type(quantity, "3");
		await user.click(screen.getByRole("button", { name: "Add product" }));
		await pickProduct(user, 2, "Boné azul");

		expect(within(lineRow(1)).getByTestId("line-subtotal")).toHaveTextContent(
			"$149.70",
		);
		expect(within(lineRow(2)).getByTestId("line-subtotal")).toHaveTextContent(
			"$29.90",
		);
		expect(screen.getByTestId("sale-total")).toHaveTextContent("$179.60");
	});
});

describe("new sale stock check", () => {
	function quantity(line: number) {
		return screen.getByRole("spinbutton", { name: `Quantity, line ${line}` });
	}

	async function setQuantity(user: User, line: number, value: string) {
		await user.clear(quantity(line));
		if (value) await user.type(quantity(line), value);
	}

	function submit() {
		return screen.getByRole("button", { name: "Register sale" });
	}

	it("blocks a quantity above the displayed stock", async () => {
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Caneca");

		await setQuantity(user, 1, "3");

		expect(quantity(1)).toHaveAttribute("aria-invalid", "true");
		expect(quantity(1)).toHaveAccessibleDescription("Only 2 available");
		expect(within(lineRow(1)).getByTestId("line-stock")).toHaveTextContent("2");
		expect(submit()).toBeDisabled();

		await setQuantity(user, 1, "2");
		expect(quantity(1)).not.toHaveAttribute("aria-invalid");
		expect(screen.queryByText("Only 2 available")).not.toBeInTheDocument();
		expect(submit()).toBeEnabled();
	});

	it("blocks an out-of-stock product right after it is picked", async () => {
		const { user } = await renderNewSale();

		await pickProduct(user, 1, "Boné");

		expect(quantity(1)).toHaveAccessibleDescription("Only 0 available");
		expect(submit()).toBeDisabled();
	});

	it.each([
		{ value: "0", message: "Enter at least 1" },
		{ value: "", message: "Enter a whole number" },
		{ value: "1.5", message: "Enter a whole number" },
	])("blocks quantity '$value' with '$message'", async ({ value, message }) => {
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");

		await setQuantity(user, 1, value);

		expect(quantity(1)).toHaveAttribute("aria-invalid", "true");
		expect(quantity(1)).toHaveAccessibleDescription(message);
		expect(submit()).toBeDisabled();
	});

	it("disables Register sale while any line has no product", async () => {
		const { user } = await renderNewSale();
		expect(submit()).toBeDisabled();

		await pickProduct(user, 1, "Camiseta P");
		expect(submit()).toBeEnabled();

		await user.click(screen.getByRole("button", { name: "Add product" }));
		expect(submit()).toBeDisabled();
	});

	it("flags a line whose product no longer exists", async () => {
		const { user, catalog, queryClient } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");
		await waitFor(() => expect(catalog.detailRequests).toContain(camiseta.id));

		catalog.remove(camiseta.id);
		await queryClient.invalidateQueries({ queryKey: ["products"] });

		expect(
			await screen.findByText("This product is no longer available"),
		).toBeVisible();
		expect(quantity(1)).toHaveAccessibleDescription(
			"This product is no longer available",
		);
		expect(submit()).toBeDisabled();
	});
});

interface SaleRequest {
	key: string | null;
	body: { items: { productId: string; quantity: number }[] };
}

function serveSales(
	respond: (
		request: SaleRequest,
		attempt: number,
	) => Response | Promise<Response>,
) {
	const requests: SaleRequest[] = [];
	server.use(
		http.post(apiUrl("/sales"), async ({ request }) => {
			const sale: SaleRequest = {
				key: request.headers.get("Idempotency-Key"),
				body: (await request.json()) as SaleRequest["body"],
			};
			requests.push(sale);
			return respond(sale, requests.length);
		}),
	);
	return requests;
}

function saleFor(request: SaleRequest, products: (typeof camiseta)[]): Sale {
	const items = request.body.items.map((item) => {
		const product = products.find(({ id }) => id === item.productId);
		if (!product) throw new Error("unknown product");
		return {
			productId: product.id,
			sku: product.sku,
			name: product.name,
			quantity: item.quantity,
			unitPriceCents: product.priceCents,
		};
	});
	return {
		id: crypto.randomUUID(),
		items,
		totalCents: items.reduce(
			(sum, item) => sum + item.unitPriceCents * item.quantity,
			0,
		),
		createdAt: "2026-10-06T12:00:00.000Z",
		user: { id: crypto.randomUUID(), email: "operator@acme.test" },
	};
}

const uuid =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function registerSale(user: User) {
	await user.click(screen.getByRole("button", { name: "Register sale" }));
}

describe("new sale submit", () => {
	it("posts the lines with a UUID Idempotency-Key", async () => {
		const requests = serveSales((request) =>
			HttpResponse.json(saleFor(request, [camiseta, caneca]), { status: 201 }),
		);
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");
		await user.clear(
			screen.getByRole("spinbutton", { name: "Quantity, line 1" }),
		);
		await user.type(
			screen.getByRole("spinbutton", { name: "Quantity, line 1" }),
			"3",
		);
		await user.click(screen.getByRole("button", { name: "Add product" }));
		await pickProduct(user, 2, "Caneca");

		await registerSale(user);

		await waitFor(() => expect(requests).toHaveLength(1));
		expect(requests[0]?.key).toMatch(uuid);
		expect(requests[0]?.body).toEqual({
			items: [
				{ productId: camiseta.id, quantity: 3 },
				{ productId: caneca.id, quantity: 1 },
			],
		});
	});

	it.each([
		{ failure: "a network error", fail: () => HttpResponse.error() },
		{
			failure: "a 500",
			fail: () =>
				HttpResponse.json(
					{
						error: {
							code: "INTERNAL_SERVER_ERROR",
							message: "Internal server error",
						},
					},
					{ status: 500 },
				),
		},
	])(
		"resends the same key after $failure and a new one after a change",
		async ({ fail }) => {
			const requests = serveSales((request, attempt) =>
				attempt <= 2
					? fail()
					: HttpResponse.json(saleFor(request, [camiseta]), { status: 201 }),
			);
			const { user } = await renderNewSale();
			await pickProduct(user, 1, "Camiseta P");

			await registerSale(user);
			expect(await screen.findByRole("alert")).toHaveTextContent(
				"Submitting again will not register it twice.",
			);
			await registerSale(user);
			await waitFor(() => expect(requests).toHaveLength(2));
			expect(requests[1]?.key).toBe(requests[0]?.key);

			const quantity = screen.getByRole("spinbutton", {
				name: "Quantity, line 1",
			});
			await user.clear(quantity);
			await user.type(quantity, "2");
			await registerSale(user);

			await waitFor(() => expect(requests).toHaveLength(3));
			expect(requests[2]?.key).toMatch(uuid);
			expect(requests[2]?.key).not.toBe(requests[0]?.key);
			expect(requests[2]?.body.items).toEqual([
				{ productId: camiseta.id, quantity: 2 },
			]);
		},
	);

	it("disables Register sale while the request is pending and sends one request on double click", async () => {
		let release: () => void = () => {};
		const requests = serveSales(
			(request) =>
				new Promise<Response>((resolve) => {
					release = () =>
						resolve(
							HttpResponse.json(saleFor(request, [camiseta]), { status: 201 }),
						);
				}),
		);
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");

		await user.dblClick(screen.getByRole("button", { name: "Register sale" }));

		await waitFor(() =>
			expect(screen.getByRole("button", { name: /^Register/ })).toBeDisabled(),
		);
		await waitFor(() => expect(requests).toHaveLength(1));
		release();
		expect(await screen.findByText("Sale registered")).toBeVisible();
		expect(requests).toHaveLength(1);
	});

	it("sends one request when the form is submitted twice before React re-renders", async () => {
		let release: () => void = () => {};
		const requests = serveSales(
			(request) =>
				new Promise<Response>((resolve) => {
					release = () =>
						resolve(
							HttpResponse.json(saleFor(request, [camiseta]), { status: 201 }),
						);
				}),
		);
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");
		const form = screen
			.getByRole("button", { name: "Register sale" })
			.closest("form");
		if (!form) throw new Error("no form");

		fireEvent.submit(form);
		fireEvent.submit(form);

		await waitFor(() => expect(requests).toHaveLength(1));
		release();
		expect(await screen.findByText("Sale registered")).toBeVisible();
		expect(requests).toHaveLength(1);
	});
});

describe("new sale outcomes", () => {
	const shortMessage =
		"Insufficient stock for CAN-01 (available: 1, requested: 2)";
	const twoShortMessage =
		"Insufficient stock for CAN-01 (available: 1, requested: 2), CAM-P (available: 0, requested: 1)";

	function apiError(status: number, code: string, message: string) {
		return HttpResponse.json({ error: { code, message } }, { status });
	}

	function itemsCard() {
		return screen.getByRole("table", { name: "Sale items" });
	}

	function isAbove(element: HTMLElement, other: HTMLElement) {
		return Boolean(
			element.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING,
		);
	}

	it("shows the summary from the response, resets the form and refreshes stock", async () => {
		const requests = serveSales((request) =>
			HttpResponse.json(saleFor(request, [camiseta, caneca]), { status: 201 }),
		);
		const { user, queryClient, catalog } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");
		const quantity = screen.getByRole("spinbutton", {
			name: "Quantity, line 1",
		});
		await user.clear(quantity);
		await user.type(quantity, "3");
		await user.click(screen.getByRole("button", { name: "Add product" }));
		await pickProduct(user, 2, "Caneca");
		await waitFor(() =>
			expect(
				queryClient.getQueryState(["products", "detail", caneca.id])?.status,
			).toBe("success"),
		);
		const detailsBefore = catalog.detailRequests.length;

		await registerSale(user);

		const alert = await screen.findByRole("alert");
		expect(within(alert).getByText("Sale registered")).toBeVisible();
		const summary = within(alert).getByRole("table", {
			name: "Registered items",
		});
		const rows = within(summary)
			.getAllByRole("row")
			.map((row) =>
				within(row)
					.queryAllByRole("cell")
					.map((cell) => cell.textContent),
			);
		expect(rows.slice(1, 3)).toEqual([
			["CAM-P", "Camiseta P", "3", "$49.90", "$149.70"],
			["CAN-01", "Caneca", "1", "$15.00", "$15.00"],
		]);
		expect(
			within(summary).getByRole("rowheader", { name: "Total" }),
		).toBeVisible();
		expect(rows.at(-1)).toEqual(["$164.70"]);
		expect(isAbove(alert, itemsCard())).toBe(true);

		expect(picker(1)).toHaveTextContent("Choose a product");
		expect(
			screen.queryByRole("combobox", { name: /^Product, line 2/ }),
		).not.toBeInTheDocument();
		expect(screen.getByTestId("sale-total")).toHaveTextContent("$0.00");
		// The products queries were invalidated: their stock is fetched again
		// without picking anything.
		await waitFor(() =>
			expect(catalog.detailRequests.length).toBeGreaterThan(detailsBefore),
		);

		await pickProduct(user, 1, "Camiseta P");
		await registerSale(user);
		await waitFor(() => expect(requests).toHaveLength(2));
		expect(requests[1]?.key).toMatch(uuid);
		expect(requests[1]?.key).not.toBe(requests[0]?.key);
	});

	it("shows the same summary for a replayed sale", async () => {
		serveSales(
			(request) =>
				new Response(JSON.stringify(saleFor(request, [camiseta])), {
					status: 201,
					headers: {
						"Content-Type": "application/json",
						"Idempotent-Replayed": "true",
					},
				}),
		);
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");

		await registerSale(user);

		expect(await screen.findByText("Sale registered")).toBeVisible();
	});

	it("explains a 409, keeps the lines and shows the refreshed stock", async () => {
		serveSales(() => apiError(409, "CONFLICT", twoShortMessage));
		const { user, catalog } = await renderNewSale();
		await pickProduct(user, 1, "Caneca");
		const quantity = screen.getByRole("spinbutton", {
			name: "Quantity, line 1",
		});
		await user.clear(quantity);
		await user.type(quantity, "2");
		await waitFor(() => expect(catalog.detailRequests).toContain(caneca.id));
		catalog.setStock(caneca.id, 1);
		const detailsBefore = catalog.detailRequests.length;

		await registerSale(user);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Sale not registered");
		expect(alert).toHaveTextContent("Insufficient stock for:");
		expect(
			within(within(alert).getByRole("list", { name: "Short items" }))
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual([
			"CAN-01 (available: 1, requested: 2)",
			"CAM-P (available: 0, requested: 1)",
		]);
		expect(alert).toHaveTextContent("Nothing was changed.");
		expect(alert).toHaveTextContent(
			"Lower the highlighted quantities or remove those lines, then register again.",
		);
		expect(isAbove(alert, itemsCard())).toBe(true);
		await waitFor(() =>
			expect(catalog.detailRequests.length).toBeGreaterThan(detailsBefore),
		);
		await waitFor(() =>
			expect(within(lineRow(1)).getByTestId("line-stock")).toHaveTextContent(
				"1",
			),
		);
		expect(picker(1)).toHaveAccessibleName("Product, line 1: Caneca");
		expect(quantity).toHaveValue(2);
		expect(quantity).toHaveAccessibleDescription("Only 1 available");
		expect(
			screen.getByRole("button", { name: "Register sale" }),
		).toBeDisabled();
	});

	it("explains a 404, keeps the lines and refreshes the products", async () => {
		serveSales(() =>
			apiError(404, "NOT_FOUND", "One or more products were not found"),
		);
		const { user, catalog } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");
		await waitFor(() => expect(catalog.detailRequests).toContain(camiseta.id));
		catalog.remove(camiseta.id);

		await registerSale(user);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Sale not registered");
		expect(alert).toHaveTextContent("One or more products were not found");
		expect(alert).toHaveTextContent(
			"Remove the lines marked as no longer available, then register again.",
		);
		expect(
			await screen.findByText("This product is no longer available"),
		).toBeVisible();
		expect(picker(1)).toHaveAccessibleName("Product, line 1: Camiseta P");
	});

	it("explains a 400 and keeps the lines", async () => {
		serveSales(() =>
			apiError(400, "VALIDATION_ERROR", "Each productId can appear only once"),
		);
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");

		await registerSale(user);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Sale not registered");
		expect(alert).toHaveTextContent("Each productId can appear only once");
		expect(picker(1)).toHaveAccessibleName("Product, line 1: Camiseta P");
	});

	it("says a retry is safe after a network error", async () => {
		serveSales(() => HttpResponse.error());
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");

		await registerSale(user);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Sale not registered");
		expect(alert).toHaveTextContent(
			"Could not reach the server. Check your connection and try again.",
		);
		expect(alert).toHaveTextContent(
			"Submitting again will not register it twice.",
		);
		expect(alert).not.toHaveTextContent("Nothing was changed.");
		expect(picker(1)).toHaveAccessibleName("Product, line 1: Camiseta P");
	});

	it("replaces the previous outcome with the next one", async () => {
		serveSales((request, attempt) =>
			attempt === 1
				? apiError(409, "CONFLICT", shortMessage)
				: HttpResponse.json(saleFor(request, [camiseta]), { status: 201 }),
		);
		const { user } = await renderNewSale();
		await pickProduct(user, 1, "Camiseta P");
		await registerSale(user);
		expect(await screen.findByText("Sale not registered")).toBeVisible();

		await registerSale(user);

		expect(await screen.findByText("Sale registered")).toBeVisible();
		expect(screen.getAllByRole("alert")).toHaveLength(1);
		expect(screen.queryByText("Sale not registered")).not.toBeInTheDocument();
	});
});
