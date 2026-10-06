import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, RefreshCw } from "lucide-react";
import { healthQuery } from "@/api/health";
import type { Health } from "@/api/types";
import { BrandMark } from "@/components/brand-mark";
import { HealthReport } from "@/components/health/health-report";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// Public on purpose: it must work when the database is down and login cannot.
export const Route = createFileRoute("/health")({
	component: HealthPage,
});

function HealthPage() {
	const query = useQuery(healthQuery);
	const checkedAt = new Date(query.dataUpdatedAt).toISOString();

	return (
		<main className="min-h-svh px-4 py-6 md:px-10 md:py-10">
			<div className="mx-auto flex max-w-3xl flex-col gap-8">
				<div className="flex items-center gap-2.5">
					<BrandMark />
					<span className="text-sm font-semibold tracking-tight">
						StockSync
					</span>
				</div>

				<header className="flex flex-wrap items-end justify-between gap-4">
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-3">
							<h1
								tabIndex={-1}
								className="text-2xl font-semibold tracking-tight outline-none"
							>
								System health
							</h1>
							{query.data && <OverallStatus status={query.data.status} />}
						</div>
						<p className="text-sm text-muted-foreground">
							{query.data ? (
								<>
									Checked at{" "}
									<time dateTime={checkedAt}>{formatDateTime(checkedAt)}</time>
								</>
							) : (
								"Server, database and sync queue of the StockSync API."
							)}
						</p>
					</div>
					{query.data && (
						<Button
							variant="outline"
							size="sm"
							disabled={query.isFetching}
							onClick={() => void query.refetch()}
						>
							<RefreshCw />
							{query.isFetching ? "Refreshing…" : "Refresh"}
						</Button>
					)}
				</header>

				<HealthContent query={query} checkedAt={checkedAt} />
			</div>
		</main>
	);
}

function OverallStatus({ status }: { status: Health["status"] }) {
	return (
		<Badge
			variant="outline"
			className={cn(
				status === "unavailable" &&
					"border-destructive/30 bg-destructive/5 text-destructive-ink",
			)}
		>
			{status === "ok" ? "Operational" : "Unavailable"}
		</Badge>
	);
}

function HealthContent({
	query,
	checkedAt,
}: {
	query: UseQueryResult<Health>;
	checkedAt: string;
}) {
	if (query.isPending) return <LoadingHealth />;

	if (query.isLoadingError) {
		return (
			<Alert variant="destructive">
				<CircleAlert />
				<AlertTitle>Could not check system health</AlertTitle>
				<AlertDescription>
					<p>{query.error.message}</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-2 text-foreground"
						disabled={query.isFetching}
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
						{`Could not refresh. Showing the check from ${formatDateTime(checkedAt)}.`}
					</p>
				)}
			</div>
			<HealthReport health={query.data} />
		</div>
	);
}

function LoadingHealth() {
	return (
		<div className="flex flex-col gap-8">
			<p role="status" className="sr-only">
				Checking system health…
			</p>
			{["server", "database", "sync"].map((key) => (
				<div key={key} aria-hidden="true" className="flex flex-col gap-3">
					<Skeleton className="h-5 w-28" />
					<Skeleton className="h-36 w-full" />
				</div>
			))}
		</div>
	);
}
