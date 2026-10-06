import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import { healthSchema } from "../../http/controllers/health.validation.js";
import * as repository from "./health.repository.js";

vi.mock("./health.repository.js");

const SECRET = "password authentication failed for user stocksync";

const down = {
	status: "down",
	version: null,
	maxConnections: null,
	openConnections: null,
	latencyMs: null,
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
	vi.mocked(repository.findDatabaseInfo).mockResolvedValue({
		version: "18.0",
		maxConnections: 100,
		openConnections: 1,
	});
	vi.mocked(repository.summarizeSyncQueue).mockResolvedValue({
		pending: 0,
		failed: 0,
		oldestPendingAt: null,
		lastSuccessfulSyncAt: null,
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function expectUnavailable(response: request.Response) {
	healthSchema.parse(response.body);
	expect(response.status).toBe(503);
	expect(response.headers["cache-control"]).toBe("no-store");
	expect(response.body.status).toBe("unavailable");
	expect(response.body.database).toEqual(down);
	expect(response.body.sync).toBeNull();
	expect(response.body.server).toEqual({
		status: "up",
		version: expect.any(String),
		nodeVersion: process.version,
		environment: "test",
		provider: "local",
	});
}

async function requestWithFakeTimers() {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	let settled = false;
	const pending = request(createApp())
		.get("/health")
		.then((response) => {
			settled = true;
			return response;
		});
	// vi.waitFor would advance the fake clock while polling; setImmediate is
	// not faked, so the clock stays at 0 until the health timer is armed.
	while (vi.getTimerCount() === 0) {
		await new Promise((resolve) => setImmediate(resolve));
	}

	await vi.advanceTimersByTimeAsync(999);
	expect(settled).toBe(false);
	await vi.advanceTimersByTimeAsync(1);
	return pending;
}

describe("GET /health with the database up", () => {
	it("reports the SELECT 1 round trip in whole milliseconds", async () => {
		vi.mocked(repository.ping).mockResolvedValue();
		vi.spyOn(performance, "now")
			.mockReturnValueOnce(100)
			.mockReturnValueOnce(103.4);

		const response = await request(createApp()).get("/health");

		healthSchema.parse(response.body);
		expect(response.status).toBe(200);
		expect(response.body.database.latencyMs).toBe(3);
	});
});

describe("GET /health with the database down", () => {
	it("answers 503 when a query rejects, without leaking the error", async () => {
		vi.mocked(repository.ping).mockRejectedValue(new Error(SECRET));

		const response = await request(createApp()).get("/health");

		expectUnavailable(response);
		expect(JSON.stringify(response.body)).not.toContain(SECRET);
		expect(consoleError).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ message: SECRET }),
		);
	});

	it("answers 503 when a later query rejects", async () => {
		vi.mocked(repository.ping).mockResolvedValue();
		vi.mocked(repository.summarizeSyncQueue).mockRejectedValue(
			new Error(SECRET),
		);

		const response = await request(createApp()).get("/health");

		expectUnavailable(response);
		expect(JSON.stringify(response.body)).not.toContain(SECRET);
	});

	it("answers 503 once the checks exceed 1000 ms", async () => {
		vi.mocked(repository.ping).mockReturnValue(new Promise(() => {}));

		const response = await requestWithFakeTimers();

		expectUnavailable(response);
	});

	it("answers 503 when a query after the ping never settles", async () => {
		vi.mocked(repository.ping).mockResolvedValue();
		vi.mocked(repository.summarizeSyncQueue).mockReturnValue(
			new Promise(() => {}),
		);

		const response = await requestWithFakeTimers();

		expectUnavailable(response);
	});
});
