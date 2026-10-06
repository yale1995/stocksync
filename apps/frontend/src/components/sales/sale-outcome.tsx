import { CircleAlert, CircleCheck } from "lucide-react";
import type { ApiError } from "@/api/client";
import type { Sale } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCents } from "@/lib/format";

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

export function SaleSummary({ sale }: { sale: Sale }) {
	return (
		<Alert className="mb-4">
			<CircleCheck />
			<AlertTitle>Sale registered</AlertTitle>
			<AlertDescription className="text-foreground">
				<table
					aria-label="Registered items"
					className="mt-2 w-full max-w-2xl text-sm"
				>
					<thead className="text-left text-xs text-muted-foreground">
						<tr>
							<th className="pr-4 pb-1 font-normal">SKU</th>
							<th className="pr-4 pb-1 font-normal">Name</th>
							<th className="pr-4 pb-1 text-right font-normal">Qty</th>
							<th className="pr-4 pb-1 text-right font-normal">Unit price</th>
							<th className="pb-1 text-right font-normal">Line total</th>
						</tr>
					</thead>
					<tbody>
						{sale.items.map((item) => (
							<tr key={item.productId}>
								<td className="pr-4 text-muted-foreground">{item.sku}</td>
								<td className="pr-4">{item.name}</td>
								<td className="pr-4 text-right tabular-nums">
									{item.quantity}
								</td>
								<td className="pr-4 text-right tabular-nums">
									{formatCents(item.unitPriceCents)}
								</td>
								<td className="text-right tabular-nums">
									{formatCents(item.unitPriceCents * item.quantity)}
								</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr>
							<th
								scope="row"
								colSpan={4}
								className="pt-2 text-right font-medium"
							>
								Total
							</th>
							<td className="pt-2 text-right font-semibold tabular-nums">
								{formatCents(sale.totalCents)}
							</td>
						</tr>
					</tfoot>
				</table>
			</AlertDescription>
		</Alert>
	);
}
