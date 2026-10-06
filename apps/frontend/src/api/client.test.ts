import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { ApiError, apiFetch, setUnauthorizedHandler } from "./client";

afterEach(() => {
	setUnauthorizedHandler(undefined);
});

async function catchApiError(promise: Promise<unknown>) {
	const error = await promise.then(
		() => undefined,
		(reason: unknown) => reason,
	);
	expect(error).toBeInstanceOf(ApiError);
	return error as ApiError;
}

describe("apiFetch", () => {
	it("sends the body as JSON to /api/v1 + path with extra headers", async () => {
		let received: Request | undefined;
		let receivedBody: unknown;
		server.use(
			http.post("/api/v1/sales", async ({ request }) => {
				received = request;
				receivedBody = await request.json();
				return HttpResponse.json({ ok: true }, { status: 201 });
			}),
		);

		await apiFetch("/sales", {
			method: "POST",
			body: { items: [{ productId: "p1", quantity: 2 }] },
			headers: { "Idempotency-Key": "key-1" },
		});

		expect(new URL(received?.url ?? "").pathname).toBe("/api/v1/sales");
		expect(received?.method).toBe("POST");
		expect(received?.headers.get("Content-Type")).toBe("application/json");
		expect(received?.headers.get("Idempotency-Key")).toBe("key-1");
		expect(receivedBody).toEqual({ items: [{ productId: "p1", quantity: 2 }] });
	});

	it("resolves with the parsed body of a 2xx JSON response", async () => {
		server.use(
			http.get("/api/v1/products/p1", () =>
				HttpResponse.json({ id: "p1", sku: "ABC-1" }),
			),
		);

		await expect(apiFetch("/products/p1")).resolves.toEqual({
			id: "p1",
			sku: "ABC-1",
		});
	});

	it("resolves with undefined on 204", async () => {
		server.use(
			http.post(
				"/api/v1/auth/logout",
				() => new HttpResponse(null, { status: 204 }),
			),
		);

		await expect(
			apiFetch("/auth/logout", { method: "POST" }),
		).resolves.toBeUndefined();
	});

	it("throws ApiError with the API's status, code and message", async () => {
		server.use(
			http.post("/api/v1/sales", () =>
				HttpResponse.json(
					{
						error: {
							code: "CONFLICT",
							message:
								"Insufficient stock for ABC-1 (available: 1, requested: 3)",
						},
					},
					{ status: 409 },
				),
			),
		);

		const error = await catchApiError(
			apiFetch("/sales", { method: "POST", body: { items: [] } }),
		);

		expect(error.status).toBe(409);
		expect(error.code).toBe("CONFLICT");
		expect(error.message).toBe(
			"Insufficient stock for ABC-1 (available: 1, requested: 3)",
		);
	});

	it.each([
		{
			body: "a non-JSON body",
			status: 502,
			respond: () => new HttpResponse("<h1>Bad gateway</h1>", { status: 502 }),
		},
		{
			body: "JSON that is not the API error shape",
			status: 500,
			respond: () => HttpResponse.json({ message: "nope" }, { status: 500 }),
		},
	])(
		"throws a generic ApiError when the error response has $body",
		async ({ status, respond }) => {
			server.use(http.get("/api/v1/sync/status", respond));

			const error = await catchApiError(apiFetch("/sync/status"));

			expect(error.status).toBe(status);
			expect(error.code).toBe("UNKNOWN_ERROR");
			expect(error.message).toBe("Something went wrong. Please try again.");
		},
	);

	it("throws a network ApiError with status 0 when the request fails", async () => {
		server.use(http.get("/api/v1/products", () => HttpResponse.error()));

		const error = await catchApiError(apiFetch("/products"));

		expect(error.status).toBe(0);
		expect(error.code).toBe("NETWORK_ERROR");
		expect(error.message).toBe(
			"Could not reach the server. Check your connection and try again.",
		);
	});

	it("calls the unauthorized handler once on a 401 and still throws", async () => {
		const onUnauthorized = vi.fn();
		setUnauthorizedHandler(onUnauthorized);
		server.use(
			http.get("/api/v1/auth/me", () =>
				HttpResponse.json(
					{
						error: { code: "UNAUTHORIZED", message: "Authentication required" },
					},
					{ status: 401 },
				),
			),
		);

		const error = await catchApiError(apiFetch("/auth/me"));

		expect(onUnauthorized).toHaveBeenCalledTimes(1);
		expect(error.status).toBe(401);
		expect(error.code).toBe("UNAUTHORIZED");
	});

	it.each([
		{ status: 403, code: "FORBIDDEN" },
		{ status: 409, code: "CONFLICT" },
		{ status: 500, code: "INTERNAL_SERVER_ERROR" },
	] as const)(
		"does not call the unauthorized handler on a $status",
		async ({ status, code }) => {
			const onUnauthorized = vi.fn();
			setUnauthorizedHandler(onUnauthorized);
			server.use(
				http.get("/api/v1/sync/status", () =>
					HttpResponse.json({ error: { code, message: "Nope" } }, { status }),
				),
			);

			const error = await catchApiError(apiFetch("/sync/status"));

			expect(onUnauthorized).not.toHaveBeenCalled();
			expect(error.status).toBe(status);
			expect(error.code).toBe(code);
		},
	);

	it("does not call the unauthorized handler on a 401 from POST /auth/login", async () => {
		const onUnauthorized = vi.fn();
		setUnauthorizedHandler(onUnauthorized);
		server.use(
			http.post("/api/v1/auth/login", () =>
				HttpResponse.json(
					{
						error: {
							code: "UNAUTHORIZED",
							message: "Invalid email or password",
						},
					},
					{ status: 401 },
				),
			),
		);

		const error = await catchApiError(
			apiFetch("/auth/login", {
				method: "POST",
				body: { email: "a@b.test", password: "wrong" },
			}),
		);

		expect(onUnauthorized).not.toHaveBeenCalled();
		expect(error.message).toBe("Invalid email or password");
	});

	it("still throws on a 401 when no unauthorized handler is registered", async () => {
		server.use(
			http.get("/api/v1/auth/me", () =>
				HttpResponse.json(
					{
						error: { code: "UNAUTHORIZED", message: "Authentication required" },
					},
					{ status: 401 },
				),
			),
		);

		const error = await catchApiError(apiFetch("/auth/me"));

		expect(error.status).toBe(401);
	});
});
