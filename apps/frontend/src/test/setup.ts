import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

// jsdom lacks the pointer-capture and scrolling APIs Radix Select calls.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// The first render in a test file loads the route chunk and boots the router;
// on CI that has taken over the 1 s default (1.2 s observed).
configure({ asyncUtilTimeout: 3000 });

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
