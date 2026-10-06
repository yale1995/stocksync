import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

const nodeFetch = globalThis.fetch;

beforeAll(() => {
	server.listen({ onUnhandledFrame: "error" });
	// The app calls relative paths as the browser does; Node's fetch rejects
	// them, so resolve them against the jsdom location before MSW sees them.
	const mswFetch = globalThis.fetch;
	globalThis.fetch = (input, init) =>
		mswFetch(
			typeof input === "string" && input.startsWith("/")
				? new URL(input, window.location.origin)
				: input,
			init,
		);
});

afterEach(() => {
	cleanup();
	server.resetHandlers();
});

afterAll(() => {
	server.close();
	globalThis.fetch = nodeFetch;
});
