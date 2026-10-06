import { Plus, X } from "lucide-react";
import type { Dispatch } from "react";
import type { Product } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductPicker } from "./product-picker";
import type { LineStatus, SaleFormAction, SaleLine } from "./use-sale-form";

export interface LineView {
	line: SaleLine;
	product: Product | undefined;
	status: LineStatus;
	excludedIds: string[];
}

interface SaleLinesCardProps {
	lines: LineView[];
	dispatch: Dispatch<SaleFormAction>;
}

export function SaleLinesCard({ lines, dispatch }: SaleLinesCardProps) {
	return (
		<div className="overflow-hidden rounded-lg border bg-card shadow-xs">
			<Table
				aria-label="Sale items"
				className="max-md:block md:[&_td:first-child]:pl-4 md:[&_td:last-child]:pr-3 [&_th]:text-muted-foreground [&_th:first-child]:pl-4 [&_th:last-child]:pr-3"
			>
				<TableHeader className="max-md:hidden">
					<TableRow className="hover:bg-transparent">
						<TableHead className="min-w-56">Product</TableHead>
						<TableHead className="w-24 text-right">In stock</TableHead>
						<TableHead className="w-28 text-right">Quantity</TableHead>
						<TableHead className="w-28 text-right">Unit price</TableHead>
						<TableHead className="w-28 text-right">Subtotal</TableHead>
						<TableHead className="w-12">
							<span className="sr-only">Remove</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody className="max-md:block">
					{lines.map((view, index) => (
						<SaleLineRows
							key={view.line.id}
							view={view}
							lineNumber={index + 1}
							canRemove={lines.length > 1}
							dispatch={dispatch}
						/>
					))}
				</TableBody>
			</Table>
			<div className="border-t px-2 py-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="text-primary hover:text-primary"
					onClick={() => dispatch({ type: "add" })}
				>
					<Plus />
					Add product
				</Button>
			</div>
		</div>
	);
}

interface SaleLineRowsProps {
	view: LineView;
	lineNumber: number;
	canRemove: boolean;
	dispatch: Dispatch<SaleFormAction>;
}

function SaleLineRows({
	view,
	lineNumber,
	canRemove,
	dispatch,
}: SaleLineRowsProps) {
	const { line, product, status, excludedIds } = view;
	const message = status.valid ? undefined : status.message;
	const messageId = `line-${line.id}-message`;
	const quantity = Number(line.quantity);
	const subtotal =
		product && Number.isInteger(quantity) && quantity > 0
			? product.priceCents * quantity
			: undefined;
	const short = message?.startsWith("Only ");

	return (
		<>
			{/* Below md each line is a three-row grid (picker; stock and unit price;
			    quantity, subtotal and remove) with CSS labels, so the card never
			    scrolls sideways on a phone and every figure stays named. */}
			<TableRow
				className={cn(
					"hover:bg-transparent max-md:grid max-md:grid-cols-[1fr_auto_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-2 max-md:px-4 max-md:py-3",
					message && "border-b-0 max-md:pb-1",
				)}
			>
				<TableCell className="py-2 max-md:col-span-3 max-md:p-0">
					<ProductPicker
						lineNumber={lineNumber}
						value={product}
						excludedIds={excludedIds}
						onPick={(picked) =>
							dispatch({ type: "pick", lineId: line.id, product: picked })
						}
					/>
				</TableCell>
				<TableCell
					data-testid="line-stock"
					className={cn(
						"text-right tabular-nums max-md:col-start-1 max-md:row-start-2 max-md:p-0 max-md:text-left",
						short && "font-medium text-destructive",
					)}
				>
					<span className="font-normal text-muted-foreground md:hidden">
						In stock{" "}
					</span>
					{product ? product.stock : "—"}
				</TableCell>
				<TableCell className="text-right max-md:col-start-1 max-md:row-start-3 max-md:flex max-md:items-center max-md:p-0 max-md:before:content-['Qty'] max-md:before:mr-1.5 max-md:before:font-normal max-md:before:text-muted-foreground">
					<Input
						type="number"
						inputMode="numeric"
						min={1}
						step={1}
						aria-label={`Quantity, line ${lineNumber}`}
						aria-invalid={message ? true : undefined}
						aria-describedby={message ? messageId : undefined}
						disabled={!product}
						value={line.quantity}
						onChange={(event) =>
							dispatch({
								type: "setQuantity",
								lineId: line.id,
								quantity: event.target.value,
							})
						}
						className="ml-auto w-20 text-right tabular-nums max-md:ml-0"
					/>
				</TableCell>
				<TableCell
					data-testid="line-price"
					className="text-right tabular-nums max-md:col-span-2 max-md:col-start-2 max-md:row-start-2 max-md:p-0 max-md:before:content-['Unit_price'] max-md:before:mr-1.5 max-md:before:font-normal max-md:before:text-muted-foreground"
				>
					{product ? formatCents(product.priceCents) : "—"}
				</TableCell>
				<TableCell
					data-testid="line-subtotal"
					className="text-right font-medium tabular-nums max-md:col-start-2 max-md:row-start-3 max-md:p-0 max-md:before:content-['Subtotal'] max-md:before:mr-1.5 max-md:before:font-normal max-md:before:text-muted-foreground"
				>
					{subtotal === undefined ? "—" : formatCents(subtotal)}
				</TableCell>
				<TableCell className="max-md:col-start-3 max-md:row-start-3 max-md:p-0">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Remove line ${lineNumber}`}
						className="text-muted-foreground hover:text-foreground"
						disabled={!canRemove}
						onClick={() => dispatch({ type: "remove", lineId: line.id })}
					>
						<X />
					</Button>
				</TableCell>
			</TableRow>
			{message && (
				<TableRow className="hover:bg-transparent max-md:block max-md:px-4 max-md:pb-3">
					<TableCell
						colSpan={3}
						className="pt-0 pb-3 text-right max-md:block max-md:p-0 max-md:text-left"
					>
						<p id={messageId} className="text-xs text-destructive">
							{message}
						</p>
					</TableCell>
					<TableCell colSpan={3} className="pt-0 pb-3 max-md:hidden" />
				</TableRow>
			)}
		</>
	);
}
