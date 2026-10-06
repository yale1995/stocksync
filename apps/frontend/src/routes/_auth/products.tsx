import { useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { PAGE_SIZE, productsQuery } from "@/api/products";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import {
	ProductFilters,
	type ProductFilterValues,
} from "@/components/products/product-filters";
import { ProductsTable } from "@/components/products/products-table";

// The router parses `?page=2&outOfStock=true` as JSON, so values arrive as
// numbers and booleans; a typed `?search=123` arrives as a number.
const productsSearchSchema = z.object({
	search: z
		.union([z.string(), z.number()])
		.transform((value) => String(value).trim() || undefined)
		.optional()
		.catch(undefined),
	outOfStock: z.boolean().optional().catch(undefined),
	page: z.number().int().min(1).default(1).catch(1),
});

export type ProductsSearch = z.infer<typeof productsSearchSchema>;

export const Route = createFileRoute("/_auth/products")({
	validateSearch: productsSearchSchema,
	search: { middlewares: [stripSearchParams({ page: 1 })] },
	component: ProductsPage,
});

function ProductsPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const query = useQuery(productsQuery(search));
	const setFilters = (patch: ProductFilterValues) =>
		void navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });
	const setPage = (page: number) =>
		void navigate({ search: (prev) => ({ ...prev, page }) });
	const hasFilters =
		search.search !== undefined || search.outOfStock !== undefined;

	return (
		<>
			<PageHeader
				title="Products"
				description="Search the catalog and check what is in stock."
			/>
			<ProductFilters values={search} onChange={setFilters} />
			<ProductsTable
				query={query}
				hasFilters={hasFilters}
				onClearFilters={() => void navigate({ search: {} })}
				onFirstPage={() => setPage(1)}
			/>
			{query.data && query.data.data.length > 0 && (
				<Pagination
					page={search.page}
					pageSize={PAGE_SIZE}
					total={query.data.meta.total}
					itemLabel={query.data.meta.total === 1 ? "product" : "products"}
					onPageChange={setPage}
				/>
			)}
		</>
	);
}
