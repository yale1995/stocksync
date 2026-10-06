import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function OutOfStockBadge({ className }: { className?: string }) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"border-destructive/30 bg-destructive/5 text-destructive-ink",
				className,
			)}
		>
			Out of stock
		</Badge>
	);
}
