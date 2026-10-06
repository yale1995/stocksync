import { queryOptions } from "@tanstack/react-query";
import { api, HEALTH_URL } from "./client";
import type { Health } from "./types";

export async function getHealth() {
	const { data } = await api.get<Health>(HEALTH_URL, {
		// A 503 carries the full report of a database outage.
		validateStatus: (status) => status === 200 || status === 503,
	});
	return data;
}

export const healthQuery = queryOptions({
	queryKey: ["health"],
	queryFn: getHealth,
	// Checked on open and on Refresh only.
	retry: false,
	refetchOnWindowFocus: false,
	refetchOnReconnect: false,
});
