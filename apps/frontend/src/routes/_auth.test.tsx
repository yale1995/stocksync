import { act, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { meQuery } from "@/api/auth";
import { emptyProducts, signedIn, signedOut } from "@/test/handlers";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";

beforeEach(() => {
	emptyProducts();
});

describe("auth guard and layout", () => {
	it("redirects a visitor without a session to login with the location", async () => {
		signedOut();
		const { router } = renderApp("/sync");

		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
		expect(router.state.location.search).toEqual({ redirect: "/sync" });
		expect(await screen.findByRole("button", { name: "Log in" })).toBeVisible();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("redirects / to /products for a signed-in user", async () => {
		signedIn();
		const { router } = renderApp("/");

		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/products"),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Products" }),
		).toBeVisible();
	});

	it("shows the signed-in user's email, tenant and role", async () => {
		signedIn();
		renderApp("/products");

		expect(await screen.findByText("operator@acme.test")).toBeVisible();
		expect(screen.getByText("Acme")).toBeVisible();
		expect(screen.getByText("Operator")).toBeVisible();
	});

	it("marks only the current page in the main navigation", async () => {
		signedIn();
		renderApp("/sync");

		const nav = await screen.findByRole("navigation", { name: "Main" });
		const links = within(nav).getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual([
			"Products",
			"New sale",
			"Sync status",
		]);
		expect(
			within(nav).getByRole("link", { name: "Sync status" }),
		).toHaveAttribute("aria-current", "page");
		for (const name of ["Products", "New sale"]) {
			expect(within(nav).getByRole("link", { name })).not.toHaveAttribute(
				"aria-current",
			);
		}
	});

	it("logs out: calls the API, clears the cache and goes to /login", async () => {
		signedIn();
		let logoutCalls = 0;
		server.use(
			http.post("/api/v1/auth/logout", () => {
				logoutCalls += 1;
				signedOut();
				return new HttpResponse(null, { status: 204 });
			}),
		);
		const { user, router, queryClient } = renderApp("/sync");

		await user.click(await screen.findByRole("button", { name: "Log out" }));

		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
		expect(logoutCalls).toBe(1);
		expect(queryClient.getQueryData(meQuery.queryKey)).toBeUndefined();
		expect(router.state.location.search).toEqual({});
	});

	it("stays signed in and explains when logout fails", async () => {
		signedIn();
		server.use(http.post("/api/v1/auth/logout", () => HttpResponse.error()));
		const { user, router } = renderApp("/sync");

		await user.click(await screen.findByRole("button", { name: "Log out" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Could not log out. Try again.",
		);
		expect(router.state.location.pathname).toBe("/sync");
		expect(screen.getByText("operator@acme.test")).toBeVisible();
	});

	it("moves focus to the new page heading when the route changes", async () => {
		signedIn();
		const { user } = renderApp("/products");
		const nav = await screen.findByRole("navigation", { name: "Main" });

		await user.click(within(nav).getByRole("link", { name: "Sync status" }));

		await waitFor(() =>
			expect(
				screen.getByRole("heading", { level: 1, name: "Sync status" }),
			).toHaveFocus(),
		);
	});

	it("keeps focus where it is when only the search changes", async () => {
		signedIn();
		const { router } = renderApp("/sync");
		const logOut = await screen.findByRole("button", { name: "Log out" });
		logOut.focus();

		await act(() => router.navigate({ href: "/sync?tab=failed" }));

		expect(router.state.location.searchStr).toBe("?tab=failed");
		expect(logOut).toHaveFocus();
	});
});
