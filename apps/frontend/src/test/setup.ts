import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

// jsdom lacks the pointer-capture, scrolling and resize APIs that Radix Select,
// Popover and cmdk call.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// The first render in a test file loads the route chunk and boots the router;
// on CI that has taken over the 1 s default (1.2 s observed).
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => {
	server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
	cleanup();
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});
