import { HttpResponse, http } from "msw";
import type { Product } from "@/api/types";
import { page } from "./fixtures";
import { server } from "./server";

const notFound = {
	error: { code: "NOT_FOUND", message: "Product not found" },
};

// An in-memory catalog behind GET /products and GET /products/:id, so tests
// can change stock between requests the way another sale would.
export function serveCatalog(products: Product[]) {
	const catalog = new Map(products.map((product) => [product.id, product]));
	const listRequests: URL[] = [];
	const detailRequests: string[] = [];

	server.use(
		http.get("/api/v1/products", ({ request }) => {
			const url = new URL(request.url);
			listRequests.push(url);
			const search = url.searchParams.get("search")?.toLowerCase() ?? "";
			const matches = [...catalog.values()].filter(
				(product) =>
					product.name.toLowerCase().includes(search) ||
					product.sku.toLowerCase().includes(search),
			);
			return HttpResponse.json(page(matches));
		}),
		http.get("/api/v1/products/:id", ({ params }) => {
			const id = String(params.id);
			detailRequests.push(id);
			const product = catalog.get(id);
			return product
				? HttpResponse.json(product)
				: HttpResponse.json(notFound, { status: 404 });
		}),
	);

	return {
		listRequests,
		detailRequests,
		setStock(id: string, stock: number) {
			const product = catalog.get(id);
			if (product) catalog.set(id, { ...product, stock });
		},
		remove(id: string) {
			catalog.delete(id);
		},
	};
}
