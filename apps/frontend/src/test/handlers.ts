import { HttpResponse, http } from "msw";
import type { CurrentUser } from "@/api/types";
import { apiUrl } from "./api-url";
import { currentUser, unauthorized } from "./fixtures";
import { server } from "./server";

export function signedIn(user: CurrentUser = currentUser) {
	server.use(http.get(apiUrl("/auth/me"), () => HttpResponse.json(user)));
}

export function signedOut() {
	server.use(
		http.get(apiUrl("/auth/me"), () =>
			HttpResponse.json(unauthorized, { status: 401 }),
		),
	);
}

// Pages that are only a backdrop for another test still load their data.
export function emptySyncStatus() {
	server.use(
		http.get(apiUrl("/sync/status"), () =>
			HttpResponse.json({
				pending: 0,
				sent: 0,
				failed: 0,
				superseded: 0,
				lastSuccessfulSyncAt: null,
				failedEvents: [],
			}),
		),
	);
}

export function emptyProducts() {
	server.use(
		http.get(apiUrl("/products"), () =>
			HttpResponse.json({ data: [], meta: { page: 1, limit: 20, total: 0 } }),
		),
	);
}
