import type { SyncStatus } from "@/api/types";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SyncSummary({ status }: { status: SyncStatus }) {
	const now = useNow(10_000);
	const counts = [
		{ label: "Pending", value: status.pending },
		{ label: "Sent", value: status.sent },
		{ label: "Failed", value: status.failed, failure: status.failed > 0 },
		{ label: "Superseded", value: status.superseded },
	];

	return (
		<dl className="overflow-hidden rounded-lg border bg-card shadow-xs">
			<div className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
				{counts.map(({ label, value, failure }) => (
					<div key={label} className="flex flex-col gap-1 px-5 py-4">
						<dt className="text-sm text-muted-foreground">{label}</dt>
						<dd
							className={cn(
								"text-2xl font-semibold tracking-tight tabular-nums",
								failure && "text-destructive",
							)}
						>
							{value}
						</dd>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t px-5 py-3 text-sm">
				<dt className="text-muted-foreground">Last successful sync</dt>
				<dd className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
					{status.lastSuccessfulSyncAt ? (
						<>
							<span className="font-medium">
								{formatRelative(status.lastSuccessfulSyncAt, now)}
							</span>
							<time
								dateTime={status.lastSuccessfulSyncAt}
								className="text-muted-foreground"
							>
								{formatDateTime(status.lastSuccessfulSyncAt)}
							</time>
						</>
					) : (
						<span className="font-medium">Never</span>
					)}
				</dd>
			</div>
		</dl>
	);
}
