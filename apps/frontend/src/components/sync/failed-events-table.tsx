import type { FailedSyncEvent, SyncEventTrigger } from "@/api/types";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

const triggerLabels: Record<SyncEventTrigger, string> = {
	product_created: "Product created",
	stock_changed: "Stock changed",
	price_changed: "Price changed",
	product_deleted: "Product deleted",
};

export function FailedEventsTable({ events }: { events: FailedSyncEvent[] }) {
	if (events.length === 0) {
		return (
			<div className="flex flex-col items-center gap-1 rounded-lg border border-dashed bg-card px-6 py-10 text-center">
				<p className="text-sm font-medium">No failed updates</p>
				<p className="text-sm text-muted-foreground">
					Every update either reached the ads service or is still being retried.
				</p>
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border bg-card shadow-xs">
			<Table
				aria-label="Failed updates"
				className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th]:text-muted-foreground [&_th:first-child]:pl-4 [&_th:last-child]:pr-4"
			>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="w-32">SKU</TableHead>
						<TableHead className="w-40">Trigger</TableHead>
						<TableHead className="w-24 text-right">Attempts</TableHead>
						<TableHead>Last error</TableHead>
						<TableHead className="w-52 text-right">Updated at</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{events.map((event) => (
						<TableRow key={event.id}>
							<TableCell className="text-muted-foreground">
								{event.sku}
							</TableCell>
							<TableCell>{triggerLabels[event.trigger]}</TableCell>
							<TableCell className="text-right">{event.attempts}</TableCell>
							<TableCell className="whitespace-normal text-destructive">
								{event.lastError ?? "—"}
							</TableCell>
							<TableCell className="text-right text-muted-foreground">
								{formatDateTime(event.updatedAt)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
