import axios, { isAxiosError } from "axios";
import { env } from "@/env";
import type { ApiErrorBody, ErrorCode } from "./types";

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

// Served at the API root, outside the versioned prefix in VITE_API_URL.
export const HEALTH_URL = new URL("/health", env.VITE_API_URL).href;

export const api = axios.create({
	baseURL: env.VITE_API_URL,
	// The session is an httpOnly cookie on the API's origin, which is not the
	// app's origin: without this the browser neither stores nor sends it.
	withCredentials: true,
});

api.interceptors.response.use(undefined, (error: unknown) => {
	throw toApiError(error);
});

function toApiError(error: unknown) {
	if (!isAxiosError(error) || !error.response) {
		return new ApiError(0, "NETWORK_ERROR", NETWORK_MESSAGE);
	}

	const { status, data } = error.response;
	// A failed login is a wrong password, not an expired session; the health
	// check is public and never needs one.
	const isLogin =
		error.config?.method === "post" && error.config.url === "/auth/login";
	const isHealth = error.config?.url === HEALTH_URL;
	if (status === 401 && !isLogin && !isHealth) unauthorizedHandler?.();

	if (isApiErrorBody(data)) {
		return new ApiError(status, data.error.code, data.error.message);
	}
	return new ApiError(status, "UNKNOWN_ERROR", GENERIC_MESSAGE);
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

// Every query and mutation goes through `api`, whose interceptor only throws
// ApiError.
declare module "@tanstack/react-query" {
	interface Register {
		defaultError: ApiError;
	}
}
