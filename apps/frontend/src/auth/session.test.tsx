import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { meQuery } from "@/api/auth";
import { apiFetch } from "@/api/client";
import { currentUser, unauthorized } from "@/test/fixtures";
import {
	emptyProducts,
	emptySyncStatus,
	signedIn,
	signedOut,
} from "@/test/handlers";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";

const expiredMessage = "Your session has expired. Please log in again.";

async function renderSignedIn(path: string) {
	signedIn();
	const app = renderApp(path);
	await screen.findByRole("heading", { level: 1 });
	return app;
}

function expireSession() {
	signedOut();
	server.use(
		http.get("/api/v1/products", () =>
			HttpResponse.json(unauthorized, { status: 401 }),
		),
	);
}

function requestProducts(app: ReturnType<typeof renderApp>, key: string) {
	return app.queryClient
		.fetchQuery({ queryKey: [key], queryFn: () => apiFetch("/products") })
		.catch(() => undefined);
}

beforeEach(() => {
	emptyProducts();
	emptySyncStatus();
});

describe("session expiry", () => {
	it("clears the cache and sends the user to login with the message and location", async () => {
		const app = await renderSignedIn("/sync");
		expireSession();

		await requestProducts(app, "probe");

		await waitFor(() =>
			expect(app.router.state.location.pathname).toBe("/login"),
		);
		expect(app.router.state.location.search).toEqual({
			redirect: "/sync",
			reason: "expired",
		});
		expect(app.queryClient.getQueryData(meQuery.queryKey)).toBeUndefined();
		expect(await screen.findByRole("alert")).toHaveTextContent(expiredMessage);
	});

	it("returns to the previous location after logging in again", async () => {
		const app = await renderSignedIn("/sync");
		expireSession();
		await requestProducts(app, "probe");
		await screen.findByText(expiredMessage);
		server.use(
			http.post("/api/v1/auth/login", () => HttpResponse.json(currentUser)),
		);

		await app.user.type(screen.getByLabelText("Email"), "operator@acme.test");
		await app.user.type(screen.getByLabelText("Password"), "secret-password");
		await app.user.click(screen.getByRole("button", { name: "Log in" }));

		await waitFor(() =>
			expect(app.router.state.location.pathname).toBe("/sync"),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Sync status" }),
		).toBeVisible();
	});

	it("navigates to login once when several requests answer 401", async () => {
		const app = await renderSignedIn("/products");
		const navigate = vi.spyOn(app.router, "navigate");
		expireSession();

		await Promise.all([
			requestProducts(app, "first"),
			requestProducts(app, "second"),
			requestProducts(app, "third"),
		]);

		await waitFor(() =>
			expect(app.router.state.location.pathname).toBe("/login"),
		);
		const toLogin = navigate.mock.calls.filter(
			([options]) => options.to === "/login",
		);
		expect(toLogin).toHaveLength(1);
		expect(await screen.findAllByText(expiredMessage)).toHaveLength(1);
	});

	it("does not show the message when a visitor without a session hits a protected page", async () => {
		signedOut();
		const app = renderApp("/products");

		await waitFor(() =>
			expect(app.router.state.location.pathname).toBe("/login"),
		);
		await screen.findByRole("button", { name: "Log in" });
		expect(screen.queryByText(expiredMessage)).not.toBeInTheDocument();
	});
});
