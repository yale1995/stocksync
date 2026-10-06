import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { CurrentUser } from "./types";

export interface Credentials {
	email: string;
	password: string;
}

export function login(credentials: Credentials) {
	return apiFetch<CurrentUser>("/auth/login", {
		method: "POST",
		body: credentials,
	});
}

export function logout() {
	return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function getMe() {
	return apiFetch<CurrentUser>("/auth/me");
}

export const meQuery = queryOptions({
	queryKey: ["auth", "me"],
	queryFn: getMe,
	// The session only changes through login, logout or a 401, which update or
	// clear this entry explicitly.
	staleTime: Number.POSITIVE_INFINITY,
});
