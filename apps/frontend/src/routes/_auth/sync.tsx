import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_auth/sync")({
	component: SyncPage,
});

function SyncPage() {
	return (
		<PageHeader
			title="Sync status"
			description="Stock and price updates sent to the ads service."
		/>
	);
}
