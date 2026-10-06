import { QueryClient } from "@tanstack/react-query";
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function createAppRouter(
	queryClient: QueryClient,
	history?: RouterHistory,
) {
	return createRouter({
		routeTree,
		history,
		context: { queryClient },
		defaultPreload: "intent",
		// TanStack Query owns caching; the router must not serve stale loader data.
		defaultPreloadStaleTime: 0,
		scrollRestoration: true,
	});
}

export function createQueryClient() {
	return new QueryClient();
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createAppRouter>;
	}
}
