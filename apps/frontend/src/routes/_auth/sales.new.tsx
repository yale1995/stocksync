import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_auth/sales/new")({
	component: NewSalePage,
});

function NewSalePage() {
	return (
		<PageHeader
			title="New sale"
			description="Add products and quantities. Stock is checked when you submit."
		/>
	);
}
