import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Level, Logger, LoggerOptions } from "pino";
import { pinoHttp } from "pino-http";

// The serializers already drop headers; redacting them too keeps the API key
// out of the log if a serializer ever changes.
export const loggerOptions: LoggerOptions = {
	redact: ['req.headers["x-api-key"]'],
};

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

// Same rule as the API: the worker sends its batch id, so both services log
// one batch under the same id.
export function genReqId(req: IncomingMessage, res: ServerResponse): string {
	const incoming = req.headers["x-request-id"];
	const id =
		typeof incoming === "string" && VALID_REQUEST_ID.test(incoming)
			? incoming
			: randomUUID();
	res.setHeader("X-Request-Id", id);
	return id;
}

function accessMessage(req: IncomingMessage, res: ServerResponse): string {
	const completed = !req.readableAborted && res.writableEnded;
	const status = completed ? res.statusCode : "aborted";
	return `${req.method} ${req.url} ${status}`;
}

function accessLogLevel(
	_req: IncomingMessage,
	res: ServerResponse,
	err?: Error,
): Level {
	if (err || res.statusCode >= 500) return "error";
	if (res.statusCode >= 400) return "warn";
	return "info";
}

export function createHttpLogger(logger: Logger) {
	return pinoHttp({
		logger,
		genReqId,
		customLogLevel: accessLogLevel,
		customSuccessMessage: accessMessage,
		customErrorMessage: accessMessage,
		serializers: {
			req: ({ id, method, url }) => ({ id, method, url }),
			res: ({ statusCode }) => ({ statusCode }),
		},
	});
}
