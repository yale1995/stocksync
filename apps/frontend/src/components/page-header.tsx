interface PageHeaderProps {
	title: string;
	description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
	return (
		<header className="mb-8 flex flex-col gap-1">
			<h1
				tabIndex={-1}
				className="text-2xl font-semibold tracking-tight outline-none"
			>
				{title}
			</h1>
			<p className="text-sm text-muted-foreground">{description}</p>
		</header>
	);
}
