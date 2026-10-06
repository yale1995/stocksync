import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, RefreshCw } from "lucide-react";
import { syncStatusQuery } from "@/api/sync";
import type { SyncStatus } from "@/api/types";
import { PageHeader } from "@/components/page-header";
import { FailedEventsTable } from "@/components/sync/failed-events-table";
import { SyncSummary } from "@/components/sync/sync-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_auth/sync")({
	component: SyncPage,
});

function SyncPage() {
	const query = useQuery(syncStatusQuery);

	return (
		<>
			<PageHeader
				title="Sync status"
				description="Stock and price updates sent to the ads service, refreshed every 5 seconds."
			/>
			<SyncStatusContent query={query} />
		</>
	);
}

function SyncStatusContent({ query }: { query: UseQueryResult<SyncStatus> }) {
	if (query.isPending) return <LoadingStatus />;

	if (query.isLoadingError) {
		return (
			<Alert variant="destructive">
				<CircleAlert />
				<AlertTitle>Could not load sync status</AlertTitle>
				<AlertDescription>
					<p>{query.error.message}</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-2 text-foreground"
						onClick={() => void query.refetch()}
					>
						Retry
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			<div aria-live="polite" className="empty:hidden">
				{query.isRefetchError && (
					<p className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
						<RefreshCw
							aria-hidden="true"
							className="size-4 shrink-0 text-muted-foreground"
						/>
						{`Could not refresh. Showing data from ${formatDateTime(
							new Date(query.dataUpdatedAt).toISOString(),
						)}; retrying every 5 seconds.`}
					</p>
				)}
			</div>
			<SyncSummary status={query.data} />
			<section aria-labelledby="failed-updates" className="flex flex-col gap-3">
				<h2
					id="failed-updates"
					className="text-base font-semibold tracking-tight"
				>
					Failed updates
				</h2>
				<FailedEventsTable events={query.data.failedEvents} />
			</section>
		</div>
	);
}

function LoadingStatus() {
	return (
		<div className="flex flex-col gap-8">
			<p role="status" className="sr-only">
				Loading sync status…
			</p>
			<div
				aria-hidden="true"
				className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-5 shadow-xs sm:grid-cols-4"
			>
				{["pending", "sent", "failed", "superseded"].map((key) => (
					<div key={key} className="flex flex-col gap-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-7 w-12" />
					</div>
				))}
			</div>
			<Skeleton aria-hidden="true" className="h-40 w-full" />
		</div>
	);
}
