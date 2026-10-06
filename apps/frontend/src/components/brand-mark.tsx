import { PackageCheck } from "lucide-react";

export function BrandMark() {
	return (
		<span
			aria-hidden="true"
			className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-background"
		>
			<PackageCheck className="size-4" strokeWidth={2.25} />
		</span>
	);
}
