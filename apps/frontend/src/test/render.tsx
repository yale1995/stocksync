import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { registerSessionExpiry } from "@/auth/session";
import { createAppRouter } from "@/router";

export function renderApp(path: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createAppRouter(queryClient, history);
	registerSessionExpiry(router, queryClient);
	const user = userEvent.setup();

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);

	return { user, router, queryClient };
}
