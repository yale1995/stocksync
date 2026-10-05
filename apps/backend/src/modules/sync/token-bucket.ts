// Capacity 1: one request every 1000 / rate ms. A bucket holding `rate`
// tokens would allow a burst of `rate` plus the refills within the same
// second, which the ads service's sliding window answers with 429.
export function createTokenBucket({
	ratePerSecond,
	now,
	sleep,
}: {
	ratePerSecond: number;
	now: () => number;
	sleep: (ms: number) => Promise<void>;
}): () => Promise<void> {
	const intervalMs = 1000 / ratePerSecond;
	let nextFreeAt = Number.NEGATIVE_INFINITY;

	return async function take() {
		const current = now();
		if (current < nextFreeAt) await sleep(nextFreeAt - current);
		nextFreeAt = Math.max(current, nextFreeAt) + intervalMs;
	};
}
