import { act, screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FailedSyncEvent, SyncStatus } from "@/api/types";
import { signedIn } from "@/test/handlers";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";

function makeStatus(overrides: Partial<SyncStatus> = {}): SyncStatus {
	return {
		pending: 3,
		sent: 42,
		failed: 2,
		superseded: 7,
		lastSuccessfulSyncAt: new Date(Date.now() - 2 * 60_000).toISOString(),
		failedEvents: [],
		...overrides,
	};
}

function makeFailedEvent(
	overrides: Partial<FailedSyncEvent> = {},
): FailedSyncEvent {
	return {
		id: crypto.randomUUID(),
		productId: crypto.randomUUID(),
		sku: "CAM-P",
		trigger: "stock_changed",
		attempts: 5,
		lastError: "Ads service answered 500",
		updatedAt: "2026-10-06T14:05:09.000Z",
		...overrides,
	};
}

const serverError = {
	error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
};

function serveStatus(respond: (attempt: number) => SyncStatus | Response) {
	let attempts = 0;
	server.use(
		http.get("/api/v1/sync/status", () => {
			attempts += 1;
			const result = respond(attempts);
			return result instanceof Response ? result : HttpResponse.json(result);
		}),
	);
	return () => attempts;
}

function renderSync() {
	signedIn();
	return renderApp("/sync");
}

function figure(label: string) {
	const term = screen.getByText(label, { selector: "dt" });
	const value = term.nextElementSibling;
	if (!value) throw new Error(`no value for ${label}`);
	return value as HTMLElement;
}

afterEach(() => {
	vi.useRealTimers();
});

describe("sync status summary", () => {
	it("shows the count for each status with its label", async () => {
		serveStatus(() => makeStatus());
		renderSync();

		await screen.findByText("Pending", { selector: "dt" });
		expect(figure("Pending")).toHaveTextContent("3");
		expect(figure("Sent")).toHaveTextContent("42");
		expect(figure("Failed")).toHaveTextContent("2");
		expect(figure("Superseded")).toHaveTextContent("7");
	});

	it("marks the failed count only when there are failures", async () => {
		serveStatus(() => makeStatus({ failed: 0 }));
		renderSync();

		await screen.findByText("Failed", { selector: "dt" });
		expect(figure("Failed")).toHaveTextContent("0");
		expect(figure("Failed").className).not.toContain("text-destructive");
	});

	it("colors a non-zero failed count as a failure", async () => {
		serveStatus(() => makeStatus({ failed: 2 }));
		renderSync();

		await screen.findByText("Failed", { selector: "dt" });
		expect(figure("Failed").className).toContain("text-destructive");
	});

	it("shows the last successful sync as relative and absolute time", async () => {
		const lastSuccessfulSyncAt = "2026-10-06T14:05:09.000Z";
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.setSystemTime(Date.parse("2026-10-06T14:07:09.000Z"));
		serveStatus(() => makeStatus({ lastSuccessfulSyncAt }));
		renderSync();

		const time = await screen.findByText("Oct 6, 2026, 2:05:09 PM");
		expect(time.tagName).toBe("TIME");
		expect(time).toHaveAttribute("dateTime", lastSuccessfulSyncAt);
		expect(figure("Last successful sync")).toHaveTextContent("2 minutes ago");
	});

	it("keeps the relative time current while the data does not change", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.setSystemTime(Date.parse("2026-10-06T14:05:39.000Z"));
		serveStatus(() =>
			makeStatus({ lastSuccessfulSyncAt: "2026-10-06T14:05:09.000Z" }),
		);
		renderSync();
		await screen.findByText("Last successful sync", { selector: "dt" });
		expect(figure("Last successful sync")).toHaveTextContent("30 seconds ago");

		await act(() => vi.advanceTimersByTimeAsync(40_000));

		await waitFor(() =>
			expect(figure("Last successful sync")).toHaveTextContent("1 minute ago"),
		);
	});

	it("says Never when nothing was synced yet", async () => {
		serveStatus(() => makeStatus({ lastSuccessfulSyncAt: null }));
		renderSync();

		await screen.findByText("Last successful sync", { selector: "dt" });
		expect(figure("Last successful sync")).toHaveTextContent(/^Never$/);
		expect(document.querySelector("time")).toBeNull();
	});

	it("polls the status every 5 seconds and shows the new values", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const attempts = serveStatus((attempt) =>
			makeStatus({
				pending: attempt === 1 ? 3 : 0,
				sent: attempt === 1 ? 42 : 45,
			}),
		);
		renderSync();
		await screen.findByText("Pending", { selector: "dt" });
		expect(figure("Pending")).toHaveTextContent("3");
		expect(attempts()).toBe(1);

		await act(() => vi.advanceTimersByTimeAsync(4_000));
		expect(attempts()).toBe(1);

		await act(() => vi.advanceTimersByTimeAsync(1_000));
		await waitFor(() => expect(figure("Pending")).toHaveTextContent("0"));
		expect(figure("Sent")).toHaveTextContent("45");
		expect(attempts()).toBe(2);
	});
});

describe("failed updates", () => {
	it("lists the failed events in API order with readable values", async () => {
		serveStatus(() =>
			makeStatus({
				failedEvents: [
					makeFailedEvent({
						sku: "CAM-P",
						trigger: "stock_changed",
						attempts: 5,
						lastError: "Ads service answered 500",
						updatedAt: "2026-10-06T14:05:09.000Z",
					}),
					makeFailedEvent({
						sku: "BON-01",
						trigger: "price_changed",
						attempts: 3,
						lastError: null,
						updatedAt: "2026-10-06T13:00:00.000Z",
					}),
				],
			}),
		);
		renderSync();

		const table = await screen.findByRole("table", { name: "Failed updates" });
		const rows = within(table)
			.getAllByRole("row")
			.map((row) =>
				within(row)
					.queryAllByRole(row.querySelector("th") ? "columnheader" : "cell")
					.map((cell) => cell.textContent),
			);
		expect(rows).toEqual([
			["SKU", "Trigger", "Attempts", "Last error", "Updated at"],
			[
				"CAM-P",
				"Stock changed",
				"5",
				"Ads service answered 500",
				"Oct 6, 2026, 2:05:09 PM",
			],
			["BON-01", "Price changed", "3", "—", "Oct 6, 2026, 1:00:00 PM"],
		]);
	});

	it.each([
		{ trigger: "product_created" as const, label: "Product created" },
		{ trigger: "stock_changed" as const, label: "Stock changed" },
		{ trigger: "price_changed" as const, label: "Price changed" },
		{ trigger: "product_deleted" as const, label: "Product deleted" },
	])("shows the $trigger trigger as '$label'", async ({ trigger, label }) => {
		serveStatus(() =>
			makeStatus({ failedEvents: [makeFailedEvent({ trigger })] }),
		);
		renderSync();

		const table = await screen.findByRole("table", { name: "Failed updates" });
		expect(within(table).getByText(label)).toBeVisible();
	});

	it("says there are no failed updates when the list is empty", async () => {
		serveStatus(() => makeStatus({ failed: 0, failedEvents: [] }));
		renderSync();

		expect(await screen.findByText("No failed updates")).toBeVisible();
		expect(
			screen.queryByRole("table", { name: "Failed updates" }),
		).not.toBeInTheDocument();
	});
});

describe("sync status loading and errors", () => {
	it("shows skeletons and a loading status while the first request is pending", async () => {
		let release: () => void = () => {};
		let requests = 0;
		server.use(
			http.get("/api/v1/sync/status", () => {
				requests += 1;
				return new Promise<Response>((resolve) => {
					release = () => resolve(HttpResponse.json(makeStatus()));
				});
			}),
		);
		renderSync();

		expect(await screen.findByRole("status")).toHaveTextContent(
			"Loading sync status…",
		);
		// A label and a figure for each of the four counts, plus the table.
		expect(document.querySelectorAll("[data-slot=skeleton]")).toHaveLength(9);

		await waitFor(() => expect(requests).toBe(1));
		release();
		await screen.findByText("Pending", { selector: "dt" });
		expect(screen.queryByText("Loading sync status…")).not.toBeInTheDocument();
		expect(document.querySelectorAll("[data-slot=skeleton]")).toHaveLength(0);
	});

	it("shows the error and requests the status again on Retry", async () => {
		const attempts = serveStatus((attempt) =>
			attempt === 1
				? HttpResponse.json(serverError, { status: 500 })
				: makeStatus(),
		);
		const { user } = renderSync();

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Could not load sync status");
		expect(alert).toHaveTextContent("Internal server error");
		await user.click(within(alert).getByRole("button", { name: "Retry" }));

		await screen.findByText("Pending", { selector: "dt" });
		expect(attempts()).toBe(2);
	});

	it("keeps the last data with a warning while refreshes fail, and clears it after a success", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		vi.setSystemTime(Date.parse("2026-10-06T14:05:09.000Z"));
		serveStatus((attempt) =>
			attempt === 2
				? HttpResponse.json(serverError, { status: 500 })
				: makeStatus({ pending: attempt }),
		);
		renderSync();
		await screen.findByText("Pending", { selector: "dt" });
		expect(figure("Pending")).toHaveTextContent("1");

		await act(() => vi.advanceTimersByTimeAsync(5_000));

		const warning = await screen.findByText(/^Could not refresh\./);
		expect(warning).toHaveTextContent(
			"Could not refresh. Showing data from Oct 6, 2026, 2:05:09 PM; retrying every 5 seconds.",
		);
		expect(warning.closest("[aria-live=polite]")).not.toBeNull();
		expect(figure("Pending")).toHaveTextContent("1");
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();

		await act(() => vi.advanceTimersByTimeAsync(5_000));

		await waitFor(() => expect(figure("Pending")).toHaveTextContent("3"));
		expect(screen.queryByText(/^Could not refresh\./)).not.toBeInTheDocument();
	});
});
