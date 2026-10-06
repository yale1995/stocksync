import type { ApiErrorBody, ErrorCode } from "./types";

const API_BASE = "/api/v1";
const GENERIC_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_MESSAGE =
	"Could not reach the server. Check your connection and try again.";

export type ClientErrorCode = ErrorCode | "NETWORK_ERROR" | "UNKNOWN_ERROR";

export class ApiError extends Error {
	readonly status: number;
	readonly code: ClientErrorCode;

	constructor(status: number, code: ClientErrorCode, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

let unauthorizedHandler: (() => void) | undefined;

export function setUnauthorizedHandler(handler: (() => void) | undefined) {
	unauthorizedHandler = handler;
}

interface RequestOptions {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
	headers?: Record<string, string>;
}

export async function apiFetch<T>(
	path: string,
	{ method = "GET", body, headers }: RequestOptions = {},
): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${API_BASE}${path}`, {
			method,
			headers:
				body === undefined
					? headers
					: { "Content-Type": "application/json", ...headers },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	} catch {
		throw new ApiError(0, "NETWORK_ERROR", NETWORK_MESSAGE);
	}

	// A failed login is a wrong password, not an expired session.
	const isLogin = method === "POST" && path === "/auth/login";
	if (response.status === 401 && !isLogin) unauthorizedHandler?.();

	if (!response.ok) throw await toApiError(response);
	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}

async function toApiError(response: Response) {
	const body: unknown = await response.json().catch(() => undefined);
	if (isApiErrorBody(body)) {
		return new ApiError(response.status, body.error.code, body.error.message);
	}
	return new ApiError(response.status, "UNKNOWN_ERROR", GENERIC_MESSAGE);
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
	if (typeof body !== "object" || body === null || !("error" in body)) {
		return false;
	}
	const { error } = body;
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string" &&
		"message" in error &&
		typeof error.message === "string"
	);
}

// Every query and mutation goes through apiFetch, which only throws ApiError.
declare module "@tanstack/react-query" {
	interface Register {
		defaultError: ApiError;
	}
}
