import type { UseQueryResult } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { Page, Product } from "@/api/types";
import { OutOfStockBadge } from "@/components/out-of-stock-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ProductsTableProps {
	query: UseQueryResult<Page<Product>>;
	hasFilters: boolean;
	onClearFilters: () => void;
	onFirstPage: () => void;
}

export function ProductsTable({
	query,
	hasFilters,
	onClearFilters,
	onFirstPage,
}: ProductsTableProps) {
	if (query.isPending) return <LoadingTable />;

	if (query.isError) {
		return (
			<Alert variant="destructive">
				<CircleAlert />
				<AlertTitle>Could not load products</AlertTitle>
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

	const products = query.data.data;
	if (products.length === 0 && query.data.meta.total > 0) {
		return (
			<EmptyState
				title="This page is empty"
				description="The list is shorter than this page number."
				action={
					<Button variant="outline" size="sm" onClick={onFirstPage}>
						Go to first page
					</Button>
				}
			/>
		);
	}
	if (products.length === 0) {
		return hasFilters ? (
			<EmptyState
				title="No products match your filters"
				description="Try another search or stock filter."
				action={
					<Button variant="outline" size="sm" onClick={onClearFilters}>
						Clear filters
					</Button>
				}
			/>
		) : (
			<EmptyState
				title="No products yet"
				description="Products added to the catalog through the API appear here."
			/>
		);
	}

	return (
		<TableFrame busy={query.isPlaceholderData}>
			<TableBody>
				{products.map((product) => (
					<TableRow key={product.id}>
						<TableCell className="text-muted-foreground">
							{product.sku}
						</TableCell>
						<TableCell className="font-medium">{product.name}</TableCell>
						<TableCell className="text-right">
							{formatCents(product.priceCents)}
						</TableCell>
						<TableCell className="text-right">
							<StockCell stock={product.stock} />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</TableFrame>
	);
}

function StockCell({ stock }: { stock: number }) {
	if (stock > 0) return stock;
	return (
		<span className="inline-flex items-center gap-2 text-destructive">
			<OutOfStockBadge />
			{stock}
		</span>
	);
}

function TableFrame({
	busy = false,
	hidden = false,
	children,
}: {
	busy?: boolean;
	hidden?: boolean;
	children: ReactNode;
}) {
	return (
		<div
			aria-hidden={hidden || undefined}
			className="overflow-hidden rounded-lg border bg-card shadow-xs"
		>
			<Table
				aria-label="Products"
				aria-busy={busy || undefined}
				className={cn(
					"transition-opacity [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th]:text-muted-foreground [&_th:first-child]:pl-4 [&_th:last-child]:pr-4",
					busy && "opacity-60",
				)}
			>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="w-40">SKU</TableHead>
						<TableHead>Name</TableHead>
						<TableHead className="w-32 text-right">Price</TableHead>
						<TableHead className="w-44 text-right">Stock</TableHead>
					</TableRow>
				</TableHeader>
				{children}
			</Table>
		</div>
	);
}

function LoadingTable() {
	return (
		<>
			<p role="status" className="sr-only">
				Loading products…
			</p>
			<TableFrame hidden>
				<TableBody>
					{Array.from({ length: 5 }, (_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
						<TableRow key={index} className="hover:bg-transparent">
							<TableCell>
								<Skeleton className="h-4 w-20" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-4 w-48" />
							</TableCell>
							<TableCell>
								<Skeleton className="ml-auto h-4 w-14" />
							</TableCell>
							<TableCell>
								<Skeleton className="ml-auto h-4 w-10" />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</TableFrame>
		</>
	);
}

function EmptyState({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-1 rounded-lg border border-dashed bg-card px-6 py-14 text-center">
			<p className="text-sm font-medium">{title}</p>
			<p className="text-sm text-muted-foreground">{description}</p>
			{action && <div className="mt-3">{action}</div>}
		</div>
	);
}
