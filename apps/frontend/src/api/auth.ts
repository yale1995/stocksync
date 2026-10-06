import { queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { CurrentUser } from "./types";

export interface Credentials {
	email: string;
	password: string;
}

export async function login(credentials: Credentials) {
	const { data } = await api.post<CurrentUser>("/auth/login", credentials);
	return data;
}

export async function logout() {
	await api.post("/auth/logout");
}

export async function getMe() {
	const { data } = await api.get<CurrentUser>("/auth/me");
	return data;
}

export const meQuery = queryOptions({
	queryKey: ["auth", "me"],
	queryFn: getMe,
	// The session only changes through login, logout or a 401, which update or
	// clear this entry explicitly.
	staleTime: Number.POSITIVE_INFINITY,
});
