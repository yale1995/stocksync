export type RateLimitResult =
	| { allowed: true }
	| { allowed: false; retryAfterSeconds: number };

const WINDOW_MS = 1000;

// Sliding window over accepted requests: at most `limit` in any 1 s span.
export function createRateLimiter(limit: number, now: () => number) {
	const accepted: number[] = [];

	return function take(): RateLimitResult {
		const current = now();
		while (accepted.length > 0 && (accepted[0] ?? 0) <= current - WINDOW_MS) {
			accepted.shift();
		}
		if (accepted.length >= limit) {
			const oldest = accepted[0] ?? current;
			const waitMs = oldest + WINDOW_MS - current;
			return {
				allowed: false,
				retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
			};
		}
		accepted.push(current);
		return { allowed: true };
	};
}
