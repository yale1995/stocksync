import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
	page: number;
	pageSize: number;
	total: number;
	itemLabel: string;
	onPageChange: (page: number) => void;
}

export function Pagination({
	page,
	pageSize,
	total,
	itemLabel,
	onPageChange,
}: PaginationProps) {
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	return (
		<nav
			aria-label="Pagination"
			className="mt-4 flex items-center justify-between gap-4 text-sm"
		>
			<p className="text-muted-foreground">
				{total} {itemLabel}
			</p>
			<div className="flex items-center gap-3">
				<span className="text-muted-foreground">
					Page {page} of {pageCount}
				</span>
				<div className="flex gap-1">
					<Button
						variant="outline"
						size="sm"
						className="bg-card"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
					>
						<ChevronLeft />
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="bg-card"
						disabled={page >= pageCount}
						onClick={() => onPageChange(page + 1)}
					>
						Next
						<ChevronRight />
					</Button>
				</div>
			</div>
		</nav>
	);
}
