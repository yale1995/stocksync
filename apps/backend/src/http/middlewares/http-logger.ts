import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Request } from "express";
import type { Level, Logger } from "pino";
import { pinoHttp } from "pino-http";
import { serializeError } from "../../infra/logger.js";

const REQUEST_ID_HEADER = "X-Request-Id";
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

// An incoming id is only reused when it is safe to echo and to log verbatim.
export function genReqId(req: IncomingMessage, res: ServerResponse): string {
	const incoming = req.headers["x-request-id"];
	const id =
		typeof incoming === "string" && VALID_REQUEST_ID.test(incoming)
			? incoming
			: randomUUID();
	res.setHeader(REQUEST_ID_HEADER, id);
	return id;
}

// Express rewrites req.url inside mounted routers; originalUrl keeps the path.
function originalUrl(req: IncomingMessage): string | undefined {
	return (req as Partial<Request>).originalUrl ?? req.url;
}

function isHealthProbe(req: IncomingMessage): boolean {
	return originalUrl(req)?.split("?")[0] === "/health";
}

function accessMessage(req: IncomingMessage, res: ServerResponse): string {
	const completed = !req.readableAborted && res.writableEnded;
	const status = completed ? res.statusCode : "aborted";
	return `${req.method} ${originalUrl(req)} ${status}`;
}

export function accessLogLevel(
	req: IncomingMessage,
	res: ServerResponse,
	err?: Error,
): Level | "silent" {
	if (err || res.err || res.statusCode >= 500) return "error";
	if (res.statusCode >= 400) return "warn";
	return isHealthProbe(req) ? "debug" : "info";
}

// pino-http calls this again when the response finishes, after requireAuth
// has set req.auth.
function authFields(req: IncomingMessage) {
	const { auth } = req as Partial<Request>;
	if (!auth) return {};
	return { tenantId: auth.tenantId, userId: auth.userId, role: auth.role };
}

export function createHttpLogger(logger: Logger) {
	return pinoHttp({
		logger,
		genReqId,
		customLogLevel: accessLogLevel,
		customProps: authFields,
		customSuccessMessage: accessMessage,
		customErrorMessage: accessMessage,
		// Raw objects in, so the serializers pick fields from the real request,
		// response and Error rather than from pino-http's pre-serialized copies.
		wrapSerializers: false,
		serializers: {
			req: ({ id, method, url }: IncomingMessage) => ({ id, method, url }),
			res: ({ statusCode }: ServerResponse) => ({ statusCode }),
			err: serializeError,
		},
	});
}
