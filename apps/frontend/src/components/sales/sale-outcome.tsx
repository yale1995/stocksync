import { Check, ChevronDown, CircleAlert } from "lucide-react";
import { useId, useState } from "react";
import type { ApiError } from "@/api/client";
import type { Sale } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCents, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// The API lists every short item in one message:
// "Insufficient stock for A (available: 1, requested: 2), B (...)".
const INSUFFICIENT_STOCK = /^Insufficient stock for (.+)$/;

function shortItems(message: string) {
	const match = INSUFFICIENT_STOCK.exec(message);
	return match?.[1]?.split(/(?<=\)), /);
}

function recoveryFor(error: ApiError) {
	if (error.status === 409 && shortItems(error.message)) {
		return "Lower the highlighted quantities or remove those lines, then register again.";
	}
	if (error.status === 404) {
		return "Remove the lines marked as no longer available, then register again.";
	}
	return undefined;
}

export function SaleFailure({ error }: { error: ApiError }) {
	// Without a response (or with a 5xx) the outcome is unknown; the
	// idempotency key is what makes trying again safe.
	const outcomeUnknown = error.status === 0 || error.status >= 500;
	const items = shortItems(error.message);
	const recovery = recoveryFor(error);
	return (
		<Alert variant="destructive" className="mb-4">
			<CircleAlert />
			<AlertTitle>Sale not registered</AlertTitle>
			<AlertDescription>
				{items ? (
					<>
						<p>Insufficient stock for:</p>
						<ul aria-label="Short items" className="list-disc pl-5">
							{items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</>
				) : (
					<p>{error.message}</p>
				)}
				<p>
					{outcomeUnknown
						? "Submitting again will not register it twice."
						: "Nothing was changed."}
				</p>
				{recovery && <p>{recovery}</p>}
			</AlertDescription>
		</Alert>
	);
}

// A status, not an alert: success is announced politely, and the items stay
// collapsed so the form below is ready for the next sale.
export function SaleSummary({ sale }: { sale: Sale }) {
	const [expanded, setExpanded] = useState(false);
	const itemsId = useId();
	const count = sale.items.length;

	return (
		<div role="status" className="mb-4 rounded-lg border bg-card shadow-xs">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-2 pl-4">
				<span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
					<Check className="size-3" strokeWidth={3} aria-hidden />
				</span>
				<p className="text-sm font-medium">Sale registered</p>
				<p className="grow text-sm text-muted-foreground">
					{count === 1 ? "1 item" : `${count} items`} ·{" "}
					<span className="tabular-nums">{formatCents(sale.totalCents)}</span> ·{" "}
					<span className="tabular-nums">{formatTime(sale.createdAt)}</span>
				</p>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-expanded={expanded}
					aria-controls={itemsId}
					onClick={() => setExpanded((open) => !open)}
				>
					{expanded ? "Hide items" : "Show items"}
					<ChevronDown
						className={cn(
							"text-muted-foreground transition-transform",
							expanded && "rotate-180",
						)}
					/>
				</Button>
			</div>
			<div id={itemsId} hidden={!expanded} className="border-t">
				<Table
					aria-label="Registered items"
					className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th]:text-muted-foreground [&_th:first-child]:pl-4 [&_th:last-child]:pr-4"
				>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead>Product</TableHead>
							<TableHead className="w-28 text-right">Quantity</TableHead>
							<TableHead className="w-28 text-right">Unit price</TableHead>
							<TableHead className="w-28 text-right">Subtotal</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sale.items.map((item) => (
							<TableRow key={item.productId} className="hover:bg-transparent">
								<TableCell className="whitespace-normal">
									<span className="block font-medium">{item.name}</span>
									<span className="block text-xs text-muted-foreground">
										{item.sku}
									</span>
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{item.quantity}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{formatCents(item.unitPriceCents)}
								</TableCell>
								<TableCell className="text-right font-medium tabular-nums">
									{formatCents(item.unitPriceCents * item.quantity)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableFooter className="bg-transparent">
						<TableRow className="hover:bg-transparent">
							<TableHead
								scope="row"
								colSpan={3}
								className="text-right font-normal"
							>
								Total
							</TableHead>
							<TableCell className="text-right font-semibold tabular-nums">
								{formatCents(sale.totalCents)}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</div>
		</div>
	);
}
