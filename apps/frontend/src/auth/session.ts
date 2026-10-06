import type { QueryClient } from "@tanstack/react-query";
import { meQuery } from "@/api/auth";
import { setUnauthorizedHandler } from "@/api/client";
import type { AppRouter } from "@/router";

export function registerSessionExpiry(
	router: AppRouter,
	queryClient: QueryClient,
) {
	setUnauthorizedHandler(() => {
		// Only a signed-in user can have an expired session. Without one, the
		// guard redirects to login on its own; this also makes parallel 401s
		// navigate once, since the first one clears the user.
		if (!queryClient.getQueryData(meQuery.queryKey)) return;

		const redirect = router.state.location.href;
		queryClient.clear();
		void router.navigate({
			to: "/login",
			search: { redirect, reason: "expired" },
		});
	});
}
