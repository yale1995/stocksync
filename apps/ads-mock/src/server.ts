import { pino } from "pino";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { loggerOptions } from "./logger.js";
import { prettyDestination } from "./pretty.js";

const logger = pino(
	{ ...loggerOptions, level: env.LOG_LEVEL },
	(await prettyDestination(env.NODE_ENV)) ?? pino.destination(1),
);

createApp({
	apiKey: env.API_KEY,
	failureRate: env.FAILURE_RATE,
	rateLimitPerSecond: env.RATE_LIMIT_PER_SECOND,
	timeoutDelayMs: env.TIMEOUT_DELAY_MS,
	logger,
}).listen(env.PORT, () => {
	logger.info({ port: env.PORT }, "ads-mock listening");
});
