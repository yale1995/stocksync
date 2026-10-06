import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { logout } from "@/api/auth";
import type { CurrentUser } from "@/api/types";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

const navItems = [
	{ to: "/products", label: "Products" },
	{ to: "/sales/new", label: "New sale" },
	{ to: "/sync", label: "Sync status" },
] as const;

const roleLabels: Record<CurrentUser["role"], string> = {
	admin: "Admin",
	operator: "Operator",
};

export function AppLayout({ user }: { user: CurrentUser }) {
	return (
		<div className="min-h-svh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
			<aside className="flex flex-col gap-4 border-b border-sidebar-border bg-sidebar p-3 md:sticky md:top-0 md:h-svh md:gap-6 md:border-r md:border-b-0 md:p-4">
				<div className="flex items-center gap-2.5 px-1 md:px-2 md:pt-1">
					<BrandMark />
					<div className="flex min-w-0 flex-col">
						<span className="text-sm font-semibold tracking-tight text-foreground">
							StockSync
						</span>
						<span className="truncate text-xs text-muted-foreground">
							{user.tenant.name}
						</span>
					</div>
				</div>

				<nav aria-label="Main">
					<ul className="flex gap-1 overflow-x-auto md:flex-col">
						{navItems.map((item) => (
							<li key={item.to} className="shrink-0">
								<Link
									to={item.to}
									className="block rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
									activeProps={{
										className:
											"bg-sidebar-accent font-medium text-sidebar-accent-foreground",
									}}
								>
									{item.label}
								</Link>
							</li>
						))}
					</ul>
				</nav>

				<UserBlock user={user} />
			</aside>

			<main className="min-w-0 px-4 py-6 md:px-10 md:py-10">
				<div className="mx-auto max-w-6xl">
					<Outlet />
				</div>
			</main>
		</div>
	);
}

function UserBlock({ user }: { user: CurrentUser }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const logoutMutation = useMutation({
		mutationFn: logout,
		onSuccess: () => {
			queryClient.clear();
			void navigate({ to: "/login" });
		},
	});
	const initials = user.email.slice(0, 2).toUpperCase();

	return (
		<div className="flex flex-wrap items-center gap-2 border-t border-sidebar-border px-1 pt-3 md:mt-auto md:flex-col md:flex-nowrap md:items-stretch md:px-2 md:pt-4">
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<span
					aria-hidden="true"
					className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground"
				>
					{initials}
				</span>
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm text-foreground">{user.email}</span>
					<span className="text-xs text-muted-foreground">
						{roleLabels[user.role]}
					</span>
				</div>
			</div>
			<Button
				variant="ghost"
				size="sm"
				className="shrink-0 justify-start gap-2 px-2 text-muted-foreground hover:text-foreground"
				disabled={logoutMutation.isPending}
				onClick={() => logoutMutation.mutate()}
			>
				<LogOut />
				Log out
			</Button>
			{logoutMutation.isError && (
				<p role="alert" className="text-xs text-destructive max-md:basis-full">
					Could not log out. Try again.
				</p>
			)}
		</div>
	);
}
