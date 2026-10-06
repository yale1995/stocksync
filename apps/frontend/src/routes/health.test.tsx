import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { meQuery } from "@/api/auth";
import type { Health } from "@/api/types";
import { currentUser, unauthorized } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";

const HEALTH_URL = "http://localhost:3333/health";

function makeHealth(overrides: Partial<Health> = {}): Health {
	return {
		status: "ok",
		server: {
			status: "up",
			version: "1.4.0",
			nodeVersion: "v24.11.0",
			environment: "development",
			provider: "local",
		},
		database: {
			status: "up",
			version: "18.0",
			maxConnections: 100,
			openConnections: 7,
			latencyMs: 3,
		},
		sync: {
			pending: 4,
			failed: 2,
			oldestPendingAt: "2026-10-06T14:03:09.000Z",
			lastSuccessfulSyncAt: "2026-10-06T14:04:09.000Z",
		},
		...overrides,
	};
}

const outage = makeHealth({
	status: "unavailable",
	database: {
		status: "down",
		version: null,
		maxConnections: null,
		openConnections: null,
		latencyMs: null,
	},
	sync: null,
});

function serveHealth(respond: (attempt: number) => Health | Response) {
	let attempts = 0;
	server.use(
		http.get(HEALTH_URL, () => {
			attempts += 1;
			const result = respond(attempts);
			return result instanceof Response ? result : HttpResponse.json(result);
		}),
	);
	return () => attempts;
}

function deferred() {
	let resolve: () => void = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function section(name: string) {
	return screen.getByRole("region", { name });
}

function field(sectionName: string, label: string) {
	const term = within(section(sectionName)).getByText(label, {
		selector: "dt",
	});
	const value = term.nextElementSibling;
	if (!value) throw new Error(`no value for ${label}`);
	return value as HTMLElement;
}

async function loaded() {
	await screen.findByRole("region", { name: "Server" });
}

afterEach(() => {
	vi.useRealTimers();
});

describe("health at a glance", () => {
	it("checks the health once without a session and never again on its own", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const attempts = serveHealth(() => makeHealth());
		const { router } = renderApp("/health");
		await loaded();
		expect(router.state.location.pathname).toBe("/health");
		expect(attempts()).toBe(1);

		act(() => {
			focusManager.setFocused(false);
			focusManager.setFocused(true);
			onlineManager.setOnline(false);
			onlineManager.setOnline(true);
		});
		await act(() => vi.advanceTimersByTimeAsync(60_000));

		expect(attempts()).toBe(1);
		focusManager.setFocused(undefined);
	});

	it("shows Operational for a 200 ok", async () => {
		serveHealth(() => makeHealth());
		renderApp("/health");
		await loaded();

		expect(screen.getByText("Operational")).toBeInTheDocument();
		expect(screen.queryByText("Unavailable")).toBeNull();
	});

	it("shows every server field", async () => {
		serveHealth(() => makeHealth());
		renderApp("/health");
		await loaded();

		expect(field("Server", "Status")).toHaveTextContent(/^Up$/);
		expect(field("Server", "Version")).toHaveTextContent(/^1\.4\.0$/);
		expect(field("Server", "Node.js")).toHaveTextContent(/^v24\.11\.0$/);
		expect(field("Server", "Environment")).toHaveTextContent(/^development$/);
		expect(field("Server", "Provider")).toHaveTextContent(/^local$/);
	});

	it("shows the database status, version, latency and connections", async () => {
		serveHealth(() => makeHealth());
		renderApp("/health");
		await loaded();

		expect(field("Database", "Status")).toHaveTextContent(/^Up$/);
		expect(field("Database", "Version")).toHaveTextContent(/^18\.0$/);
		expect(field("Database", "Latency")).toHaveTextContent(/^3 ms$/);
		expect(field("Database", "Connections")).toHaveTextContent(/^7 of 100$/);
	});

	it("shows the sync counts and both moments as relative and absolute time", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.setSystemTime(Date.parse("2026-10-06T14:05:09.000Z"));
		serveHealth(() => makeHealth());
		renderApp("/health");
		await loaded();

		expect(field("Sync queue", "Pending")).toHaveTextContent(/^4$/);
		expect(field("Sync queue", "Failed")).toHaveTextContent(/^2$/);

		const oldest = field("Sync queue", "Oldest pending");
		expect(oldest).toHaveTextContent("2 minutes ago");
		const oldestTime = within(oldest).getByText("Oct 6, 2026, 2:03:09 PM");
		expect(oldestTime.tagName).toBe("TIME");
		expect(oldestTime).toHaveAttribute("dateTime", "2026-10-06T14:03:09.000Z");

		const last = field("Sync queue", "Last successful sync");
		expect(last).toHaveTextContent("1 minute ago");
		const lastTime = within(last).getByText("Oct 6, 2026, 2:04:09 PM");
		expect(lastTime.tagName).toBe("TIME");
		expect(lastTime).toHaveAttribute("dateTime", "2026-10-06T14:04:09.000Z");
	});

	it("says None and Never when nothing is pending and nothing was sent", async () => {
		serveHealth(() =>
			makeHealth({
				sync: {
					pending: 0,
					failed: 0,
					oldestPendingAt: null,
					lastSuccessfulSyncAt: null,
				},
			}),
		);
		renderApp("/health");
		await loaded();

		expect(field("Sync queue", "Oldest pending")).toHaveTextContent(/^None$/);
		expect(field("Sync queue", "Last successful sync")).toHaveTextContent(
			/^Never$/,
		);
		expect(section("Sync queue").querySelector("time")).toBeNull();
	});

	it("shows when the response arrived", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.setSystemTime(Date.parse("2026-10-06T14:05:09.000Z"));
		serveHealth(() => makeHealth());
		renderApp("/health");
		await loaded();

		const checked = screen.getByText(/^Checked at/);
		expect(checked).toHaveTextContent("Checked at Oct 6, 2026, 2:05:09 PM");
		expect(within(checked).getByText("Oct 6, 2026, 2:05:09 PM").tagName).toBe(
			"TIME",
		);
	});

	it.each([
		{ failed: 2, failure: true },
		{ failed: 0, failure: false },
	])(
		"uses the failure color for $failed failed only when above 0",
		async ({ failed, failure }) => {
			serveHealth(() =>
				makeHealth({
					sync: {
						pending: 0,
						failed,
						oldestPendingAt: null,
						lastSuccessfulSyncAt: null,
					},
				}),
			);
			renderApp("/health");
			await loaded();

			const value = field("Sync queue", "Failed");
			expect(value).toHaveTextContent(String(failed));
			if (failure) expect(value).toHaveClass("text-destructive");
			else expect(value).not.toHaveClass("text-destructive");
		},
	);
});

describe("database outage", () => {
	it("renders the 503 report as Unavailable, not as an error", async () => {
		serveHealth(() => HttpResponse.json(outage, { status: 503 }));
		renderApp("/health");
		await loaded();

		expect(screen.getByText("Unavailable")).toBeInTheDocument();
		expect(screen.queryByText("Operational")).toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(field("Server", "Status")).toHaveTextContent(/^Up$/);
		expect(field("Server", "Version")).toHaveTextContent(/^1\.4\.0$/);
		expect(field("Server", "Node.js")).toHaveTextContent(/^v24\.11\.0$/);
		expect(field("Server", "Environment")).toHaveTextContent(/^development$/);
		expect(field("Server", "Provider")).toHaveTextContent(/^local$/);
	});

	it("shows the database as Down with a dash for each missing value", async () => {
		serveHealth(() => HttpResponse.json(outage, { status: 503 }));
		renderApp("/health");
		await loaded();

		expect(field("Database", "Status")).toHaveTextContent(/^Down$/);
		expect(field("Database", "Version")).toHaveTextContent(/^—$/);
		expect(field("Database", "Latency")).toHaveTextContent(/^—$/);
		expect(field("Database", "Connections")).toHaveTextContent(/^—$/);
	});

	it("explains that the sync queue cannot be read", async () => {
		serveHealth(() => HttpResponse.json(outage, { status: 503 }));
		renderApp("/health");
		await loaded();

		expect(section("Sync queue")).toHaveTextContent(
			/^Sync queueUnavailable while the database is down\.$/,
		);
	});
});

describe("loading, errors and refresh", () => {
	it("shows a loading status until the first response arrives", async () => {
		const gate = deferred();
		server.use(
			http.get(HEALTH_URL, async () => {
				await gate.promise;
				return HttpResponse.json(makeHealth());
			}),
		);
		renderApp("/health");

		const status = await screen.findByText("Checking system health…");
		expect(status).toHaveAttribute("role", "status");
		expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(6);
		expect(screen.queryByRole("region", { name: "Server" })).toBeNull();

		gate.resolve();
		await loaded();
		expect(screen.queryByText("Checking system health…")).toBeNull();
	});

	it.each([
		{
			name: "no response",
			reply: () => HttpResponse.error(),
			message:
				"Could not reach the server. Check your connection and try again.",
		},
		{
			name: "a 500",
			reply: () =>
				HttpResponse.json(
					{
						error: {
							code: "INTERNAL_SERVER_ERROR",
							message: "Internal server error",
						},
					},
					{ status: 500 },
				),
			message: "Internal server error",
		},
		{
			name: "a 401",
			reply: () => HttpResponse.json(unauthorized, { status: 401 }),
			message: "Authentication required",
		},
	])(
		"shows the error and a Retry for $name, then the report after Retry",
		async ({ reply, message }) => {
			const attempts = serveHealth((attempt) =>
				attempt === 1 ? reply() : makeHealth(),
			);
			const { user, router, queryClient } = renderApp("/health");
			// A signed-in user, so a 401 would trigger the session-expired redirect.
			queryClient.setQueryData(meQuery.queryKey, currentUser);

			const alert = await screen.findByRole("alert");
			expect(alert).toHaveTextContent("Could not check system health");
			expect(alert).toHaveTextContent(message);
			expect(router.state.location.pathname).toBe("/health");

			await user.click(within(alert).getByRole("button", { name: "Retry" }));

			await loaded();
			expect(attempts()).toBe(2);
			expect(screen.queryByRole("alert")).toBeNull();
			expect(router.state.location.pathname).toBe("/health");
		},
	);

	it("disables Refresh while it runs, then shows the new values and time", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.setSystemTime(Date.parse("2026-10-06T14:05:09.000Z"));
		const gate = deferred();
		let attempts = 0;
		server.use(
			http.get(HEALTH_URL, async () => {
				attempts += 1;
				if (attempts === 1) return HttpResponse.json(makeHealth());
				await gate.promise;
				return HttpResponse.json(
					makeHealth({
						database: { ...makeHealth().database, latencyMs: 9 },
					}),
				);
			}),
		);
		const { user } = renderApp("/health");
		await loaded();
		expect(field("Database", "Latency")).toHaveTextContent("3 ms");

		vi.setSystemTime(Date.parse("2026-10-06T14:06:30.000Z"));
		await user.click(screen.getByRole("button", { name: "Refresh" }));

		const busy = await screen.findByRole("button", { name: "Refreshing…" });
		expect(busy).toBeDisabled();

		gate.resolve();
		await waitFor(() =>
			expect(field("Database", "Latency")).toHaveTextContent(/^9 ms$/),
		);
		expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
		expect(screen.getByText(/^Checked at/)).toHaveTextContent(
			"Checked at Oct 6, 2026, 2:06:30 PM",
		);
		expect(attempts).toBe(2);
	});

	it("keeps the last check with a warning when a refresh fails, and clears it after a success", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.setSystemTime(Date.parse("2026-10-06T14:05:09.000Z"));
		serveHealth((attempt) =>
			attempt === 2
				? HttpResponse.error()
				: makeHealth({
						database: { ...makeHealth().database, latencyMs: attempt },
					}),
		);
		const { user } = renderApp("/health");
		await loaded();

		vi.setSystemTime(Date.parse("2026-10-06T14:06:00.000Z"));
		await user.click(screen.getByRole("button", { name: "Refresh" }));

		const warning = await screen.findByText(
			"Could not refresh. Showing the check from Oct 6, 2026, 2:05:09 PM.",
		);
		expect(warning.closest("[aria-live]")).toHaveAttribute(
			"aria-live",
			"polite",
		);
		expect(field("Database", "Latency")).toHaveTextContent(/^1 ms$/);
		expect(screen.queryByRole("alert")).toBeNull();

		await user.click(screen.getByRole("button", { name: "Refresh" }));

		await waitFor(() =>
			expect(field("Database", "Latency")).toHaveTextContent(/^3 ms$/),
		);
		expect(screen.queryByText(/^Could not refresh/)).toBeNull();
	});
});
