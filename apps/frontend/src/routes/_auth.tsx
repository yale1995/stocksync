import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQuery } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AppLayout } from "@/components/app-layout";

export const Route = createFileRoute("/_auth")({
	beforeLoad: async ({ context, location }) => {
		try {
			return { user: await context.queryClient.ensureQueryData(meQuery) };
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				throw redirect({ to: "/login", search: { redirect: location.href } });
			}
			throw error;
		}
	},
	component: AuthLayout,
});

function AuthLayout() {
	const { user } = Route.useRouteContext();
	return <AppLayout user={user} />;
}
