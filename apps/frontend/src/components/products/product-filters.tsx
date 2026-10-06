import { Search } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const SEARCH_DEBOUNCE_MS = 300;

const stockOptions = [
	{ value: "all", label: "All", outOfStock: undefined },
	{ value: "in", label: "In stock", outOfStock: false },
	{ value: "out", label: "Out of stock", outOfStock: true },
] as const;

export interface ProductFilterValues {
	search?: string;
	outOfStock?: boolean;
}

interface ProductFiltersProps {
	values: ProductFilterValues;
	onChange: (patch: ProductFilterValues) => void;
}

export function ProductFilters({ values, onChange }: ProductFiltersProps) {
	const stock =
		stockOptions.find((option) => option.outOfStock === values.outOfStock) ??
		stockOptions[0];

	return (
		<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<SearchInput
				value={values.search}
				onCommit={(search) => onChange({ search })}
			/>
			<Label htmlFor="stock-filter" className="sr-only">
				Stock
			</Label>
			<Select
				value={stock.value}
				onValueChange={(value) =>
					onChange({
						outOfStock: stockOptions.find((option) => option.value === value)
							?.outOfStock,
					})
				}
			>
				<SelectTrigger id="stock-filter" className="w-full bg-card sm:w-44">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{stockOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function SearchInput({
	value,
	onCommit,
}: {
	value: string | undefined;
	onCommit: (search: string | undefined) => void;
}) {
	const [text, setText] = useState(value ?? "");
	const pending = useRef<number | undefined>(undefined);

	// Follow the URL (back/forward, Clear filters), but never while the user is
	// still typing, or the input would jump back to an older search.
	useEffect(() => {
		if (pending.current !== undefined) return;
		setText((current) =>
			(current.trim() || undefined) === value ? current : (value ?? ""),
		);
	}, [value]);

	useEffect(() => () => window.clearTimeout(pending.current), []);

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		const next = event.target.value;
		setText(next);
		window.clearTimeout(pending.current);
		pending.current = window.setTimeout(() => {
			pending.current = undefined;
			onCommit(next.trim() || undefined);
		}, SEARCH_DEBOUNCE_MS);
	}

	return (
		<div className="relative w-full sm:max-w-xs">
			<Label htmlFor="product-search" className="sr-only">
				Search products
			</Label>
			<Search
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				id="product-search"
				type="search"
				value={text}
				onChange={handleChange}
				maxLength={100}
				placeholder="Search by name or SKU"
				className="bg-card pl-9"
			/>
		</div>
	);
}
