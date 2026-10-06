import { once } from "node:events";
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createHttpAdsClient } from "./ads-client.js";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let server: Server | undefined;

async function listen(handler: Handler): Promise<string> {
	server = createServer(handler);
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const { port } = server.address() as AddressInfo;
	return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
	server?.closeAllConnections();
	server?.close();
	server = undefined;
});

function client(baseUrl: string, timeoutMs = 1000) {
	return createHttpAdsClient({ baseUrl, apiKey: "secret", timeoutMs });
}

const TENANT = "0199a000-0000-7000-8000-000000000001";
const ITEMS = [{ sku: "CAM-P", stock: 3, priceCents: 4990, version: 7 }];
const REQUEST_ID = "0199a000-0000-4000-8000-0000000000aa";

function respond(
	status: number,
	headers: Record<string, string> = {},
): Handler {
	return (_req, res) => {
		res.writeHead(status, { "Content-Type": "application/json", ...headers });
		res.end(JSON.stringify({ error: "body that must not leak" }));
	};
}

describe("createHttpAdsClient", () => {
	it("posts the batch with the API key and request id and returns ok on 2xx", async () => {
		let received: {
			method?: string;
			url?: string;
			key?: string;
			requestId?: string;
			body?: unknown;
		} = {};
		const baseUrl = await listen((req, res) => {
			let raw = "";
			req.on("data", (chunk) => {
				raw += chunk;
			});
			req.on("end", () => {
				received = {
					method: req.method,
					url: req.url,
					key: req.headers["x-api-key"] as string,
					requestId: req.headers["x-request-id"] as string,
					body: JSON.parse(raw),
				};
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ applied: 1, ignored: 0 }));
			});
		});

		const result = await client(baseUrl).sendUpdates(TENANT, ITEMS, REQUEST_ID);

		expect(result).toEqual({
			kind: "ok",
			outcome: { applied: 1, ignored: 0 },
		});
		expect(received).toEqual({
			method: "POST",
			url: "/updates",
			key: "secret",
			requestId: REQUEST_ID,
			body: { tenantId: TENANT, items: ITEMS },
		});
	});

	it.each([201, 204])("returns ok on %i", async (status) => {
		const baseUrl = await listen((_req, res) => {
			res.writeHead(status);
			res.end();
		});

		expect(
			await client(baseUrl).sendUpdates(TENANT, ITEMS, REQUEST_ID),
		).toEqual({
			kind: "ok",
		});
	});

	it.each([
		["not JSON", "applied"],
		["JSON without the counts", JSON.stringify({ status: "ok" })],
	])(
		"returns ok without counts when the 2xx body is %s",
		async (_label, body) => {
			const baseUrl = await listen((_req, res) => {
				res.writeHead(200);
				res.end(body);
			});

			const result = await client(baseUrl).sendUpdates(
				TENANT,
				ITEMS,
				REQUEST_ID,
			);

			expect(result).toStrictEqual({ kind: "ok" });
		},
	);

	it("returns rate_limited with Retry-After in milliseconds on 429", async () => {
		const baseUrl = await listen(respond(429, { "Retry-After": "2" }));

		expect(
			await client(baseUrl).sendUpdates(TENANT, ITEMS, REQUEST_ID),
		).toEqual({
			kind: "rate_limited",
			retryAfterMs: 2000,
		});
	});

	it.each([
		["missing", {}],
		["not a number", { "Retry-After": "soon" }],
	])("falls back to 1 s when Retry-After is %s", async (_label, headers) => {
		const baseUrl = await listen(respond(429, headers));

		expect(
			await client(baseUrl).sendUpdates(TENANT, ITEMS, REQUEST_ID),
		).toEqual({
			kind: "rate_limited",
			retryAfterMs: 1000,
		});
	});

	it.each([500, 503, 401, 400])(
		"returns HTTP %i without the body",
		async (status) => {
			const baseUrl = await listen(respond(status));

			expect(
				await client(baseUrl).sendUpdates(TENANT, ITEMS, REQUEST_ID),
			).toEqual({
				kind: "error",
				error: `HTTP ${status}`,
			});
		},
	);

	it("returns timeout when no response arrives in time", async () => {
		const baseUrl = await listen(() => {
			// Never answers.
		});

		expect(
			await client(baseUrl, 50).sendUpdates(TENANT, ITEMS, REQUEST_ID),
		).toEqual({
			kind: "error",
			error: "timeout",
		});
	});

	it("returns network error when the connection is refused", async () => {
		const baseUrl = await listen(respond(200));
		server?.close();
		await once(server as Server, "close");

		expect(
			await client(baseUrl).sendUpdates(TENANT, ITEMS, REQUEST_ID),
		).toEqual({
			kind: "error",
			error: "network error",
		});
	});
});
