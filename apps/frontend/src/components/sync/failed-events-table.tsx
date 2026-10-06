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
			{/* Below md each event stacks into a labelled row (SKU and attempts;
			    trigger and time; error) so nothing is clipped on a phone. */}
			<Table
				aria-label="Failed updates"
				className="max-md:block md:[&_td:first-child]:pl-4 md:[&_td:last-child]:pr-4 [&_th]:text-muted-foreground [&_th:first-child]:pl-4 [&_th:last-child]:pr-4"
			>
				<TableHeader className="max-md:hidden">
					<TableRow className="hover:bg-transparent">
						<TableHead className="w-32">SKU</TableHead>
						<TableHead className="w-40">Trigger</TableHead>
						<TableHead className="w-24 text-right">Attempts</TableHead>
						<TableHead>Last error</TableHead>
						<TableHead className="w-52 text-right">Updated at</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody className="max-md:block">
					{events.map((event) => (
						<TableRow
							key={event.id}
							className="max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-x-3 max-md:gap-y-1 max-md:px-4 max-md:py-3"
						>
							<TableCell className="text-muted-foreground max-md:col-start-1 max-md:row-start-1 max-md:p-0 max-md:font-medium max-md:text-foreground">
								{event.sku}
							</TableCell>
							<TableCell className="max-md:col-start-1 max-md:row-start-2 max-md:p-0 max-md:text-muted-foreground">
								{triggerLabels[event.trigger]}
							</TableCell>
							<TableCell className="text-right tabular-nums max-md:col-start-2 max-md:row-start-1 max-md:p-0 max-md:before:content-['Attempts'] max-md:before:mr-1.5 max-md:before:text-muted-foreground">
								{event.attempts}
							</TableCell>
							<TableCell className="whitespace-normal text-destructive max-md:col-span-2 max-md:row-start-3 max-md:p-0">
								{event.lastError ?? "—"}
							</TableCell>
							<TableCell className="text-right text-muted-foreground tabular-nums max-md:col-start-2 max-md:row-start-2 max-md:p-0">
								{formatDateTime(event.updatedAt)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
