import { createApp } from "./app.js";
import { env } from "./env.js";

createApp({
	apiKey: env.API_KEY,
	failureRate: env.FAILURE_RATE,
	rateLimitPerSecond: env.RATE_LIMIT_PER_SECOND,
	timeoutDelayMs: env.TIMEOUT_DELAY_MS,
}).listen(env.PORT, () => {
	console.log(`ads-mock listening on port ${env.PORT}`);
});
