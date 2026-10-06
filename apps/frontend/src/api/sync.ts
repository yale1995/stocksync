import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { SyncStatus } from "./types";

export const SYNC_POLL_INTERVAL_MS = 5_000;

export function getSyncStatus() {
	return apiFetch<SyncStatus>("/sync/status");
}

export const syncStatusQuery = queryOptions({
	queryKey: ["sync", "status"],
	queryFn: getSyncStatus,
	refetchInterval: SYNC_POLL_INTERVAL_MS,
	// The poll is the retry: a failed refresh shows its warning at once and the
	// next tick tries again.
	retry: false,
});
