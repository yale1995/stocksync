import { type LoggerOptions, pino } from "pino";
import { env } from "./env.js";
import { prettyDestination } from "./pretty.js";

// Errors can carry request data as extra properties (body-parser attaches the
// raw body), so only the type, message and stack are logged.
export function serializeError(err: unknown) {
	const { type, message, stack } = pino.stdSerializers.err(err as Error);
	return { type, message, stack };
}

// The HTTP serializers already drop headers; redacting them too keeps secrets
// out of the log if a serializer ever changes.
export const loggerOptions: LoggerOptions = {
	serializers: { err: serializeError },
	redact: [
		"req.headers.cookie",
		"req.headers.authorization",
		'req.headers["x-api-key"]',
		'res.headers["set-cookie"]',
	],
};

const destination = await prettyDestination(env.NODE_ENV);

export const logger = pino(
	{ ...loggerOptions, level: env.LOG_LEVEL },
	destination ?? pino.destination(1),
);
