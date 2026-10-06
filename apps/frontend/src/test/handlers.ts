import { HttpResponse, http } from "msw";
import type { CurrentUser } from "@/api/types";
import { currentUser, unauthorized } from "./fixtures";
import { server } from "./server";

export function signedIn(user: CurrentUser = currentUser) {
	server.use(http.get("/api/v1/auth/me", () => HttpResponse.json(user)));
}

export function signedOut() {
	server.use(
		http.get("/api/v1/auth/me", () =>
			HttpResponse.json(unauthorized, { status: 401 }),
		),
	);
}

// Pages that are only a backdrop for another test still load their data.
export function emptySyncStatus() {
	server.use(
		http.get("/api/v1/sync/status", () =>
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
