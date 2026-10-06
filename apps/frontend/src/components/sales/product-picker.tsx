import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { productsQuery } from "@/api/products";
import type { Product } from "@/api/types";
import { OutOfStockBadge } from "@/components/out-of-stock-badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const SEARCH_DEBOUNCE_MS = 300;

interface ProductPickerProps {
	lineNumber: number;
	value: Product | undefined;
	excludedIds: string[];
	onPick: (product: Product) => void;
}

export function ProductPicker({
	lineNumber,
	value,
	excludedIds,
	onPick,
}: ProductPickerProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
	const query = useQuery({
		...productsQuery({ search: debouncedSearch.trim() || undefined, page: 1 }),
		enabled: open,
	});
	// Results of an older search must not be selectable: a fast "cam" + Enter
	// would otherwise pick the first product of the previous list.
	const searching =
		search.trim() !== debouncedSearch.trim() || query.isPlaceholderData;
	const options = searching
		? []
		: (query.data?.data.filter(
				(product) => !excludedIds.includes(product.id),
			) ?? []);

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (!next) setSearch("");
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label={
						value
							? `Product, line ${lineNumber}: ${value.name}`
							: `Product, line ${lineNumber}`
					}
					className="h-auto min-h-9 w-full justify-between gap-2 bg-card py-1.5 text-left font-normal"
				>
					{value ? (
						<span className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{value.name}</span>
							<span className="truncate text-xs text-muted-foreground">
								{value.sku}
							</span>
						</span>
					) : (
						<span className="text-muted-foreground">Choose a product</span>
					)}
					<ChevronsUpDown className="text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="start">
				<Command shouldFilter={false} label="Search products">
					<CommandInput
						placeholder="Search by name or SKU"
						value={search}
						onValueChange={setSearch}
						maxLength={100}
					/>
					<CommandList>
						{query.isPending || searching ? (
							<p className="py-6 text-center text-sm text-muted-foreground">
								Searching…
							</p>
						) : query.isError ? (
							<p className="px-3 py-6 text-center text-sm text-destructive">
								{query.error.message}
							</p>
						) : (
							<CommandEmpty>No products found</CommandEmpty>
						)}
						{options.map((product) => (
							<CommandItem
								key={product.id}
								value={product.id}
								onSelect={() => {
									onPick(product);
									handleOpenChange(false);
								}}
								className="justify-between gap-3"
							>
								<span className="flex min-w-0 flex-col">
									<span className="truncate">{product.name}</span>
									<span className="truncate text-xs text-muted-foreground">
										{product.sku}
									</span>
								</span>
								{product.stock > 0 ? (
									<span className="shrink-0 text-xs text-muted-foreground">
										{product.stock} in stock
									</span>
								) : (
									<OutOfStockBadge className="shrink-0" />
								)}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
