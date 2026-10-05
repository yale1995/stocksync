import { z } from "zod";

export type AdsItem = {
	sku: string;
	stock: number;
	priceCents: number;
	version: number;
};

export type AdsResult =
	| { kind: "ok"; outcome?: { applied: number; ignored: number } }
	| { kind: "rate_limited"; retryAfterMs: number }
	| { kind: "error"; error: string };

export interface AdsClient {
	sendUpdates(tenantId: string, items: AdsItem[]): Promise<AdsResult>;
}

const DEFAULT_RETRY_AFTER_MS = 1000;

const outcomeSchema = z.object({
	applied: z.number().int().min(0),
	ignored: z.number().int().min(0),
});

// The counts only feed the worker log, so a body without them is still ok.
async function readOutcome(response: Response) {
	try {
		const result = outcomeSchema.safeParse(await response.json());
		return result.success ? result.data : undefined;
	} catch {
		return undefined;
	}
}

function retryAfterMs(header: string | null): number {
	const seconds = Number(header);
	return header && Number.isInteger(seconds) && seconds >= 0
		? seconds * 1000
		: DEFAULT_RETRY_AFTER_MS;
}

// Errors are reduced to a short label; response bodies and stack traces never
// reach last_error.
export function createHttpAdsClient({
	baseUrl,
	apiKey,
	timeoutMs,
}: {
	baseUrl: string;
	apiKey: string;
	timeoutMs: number;
}): AdsClient {
	const url = new URL("/updates", baseUrl);

	return {
		async sendUpdates(tenantId, items) {
			let response: Response;
			try {
				response = await fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
					body: JSON.stringify({ tenantId, items }),
					signal: AbortSignal.timeout(timeoutMs),
				});
			} catch (err) {
				const timedOut = err instanceof Error && err.name === "TimeoutError";
				return { kind: "error", error: timedOut ? "timeout" : "network error" };
			}
			if (response.ok) {
				const outcome = await readOutcome(response);
				return outcome ? { kind: "ok", outcome } : { kind: "ok" };
			}
			// Error bodies are never read; cancelling releases the connection.
			await response.body?.cancel();

			if (response.status === 429) {
				return {
					kind: "rate_limited",
					retryAfterMs: retryAfterMs(response.headers.get("Retry-After")),
				};
			}
			return { kind: "error", error: `HTTP ${response.status}` };
		},
	};
}
