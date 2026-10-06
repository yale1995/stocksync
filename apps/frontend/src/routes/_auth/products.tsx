import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_auth/products")({
	component: ProductsPage,
});

function ProductsPage() {
	return (
		<PageHeader
			title="Products"
			description="Search the catalog and check what is in stock."
		/>
	);
}
