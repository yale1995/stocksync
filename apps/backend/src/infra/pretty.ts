import type { DestinationStream } from "pino";
import type { PrettyOptions } from "pino-pretty";
import type { Env } from "./env.js";

const SHORT_ID_LENGTH = 8;

// Puts the request or batch id, shortened, and the response time in the
// message so each line reads on its own; the full values stay in the JSON.
export function formatMessage(
	log: Record<string, unknown>,
	messageKey: string,
): string {
	const req = log.req as { id?: unknown } | undefined;
	const id = req?.id ?? log.batchId;
	const prefix =
		id === undefined ? "" : `[${String(id).slice(0, SHORT_ID_LENGTH)}] `;
	const responseTime =
		typeof log.responseTime === "number" ? ` ${log.responseTime}ms` : "";
	return `${prefix}${String(log[messageKey] ?? "")}${responseTime}`;
}

export const prettyOptions: PrettyOptions = {
	translateTime: "SYS:HH:MM:ss.l",
	singleLine: true,
	// The worker's `error` field is a short label, not an error object.
	errorLikeObjectKeys: ["err"],
	ignore: "pid,hostname,req,res,responseTime,component,tenantId,batchId",
	messageFormat: formatMessage,
};

// pino-pretty runs as a stream on the main thread instead of a transport:
// a transport lives in a worker thread, which cannot receive messageFormat's
// function. It is a devDependency, so it is only loaded in development.
export async function prettyDestination(
	nodeEnv: Env["NODE_ENV"],
): Promise<DestinationStream | undefined> {
	if (nodeEnv !== "development") return undefined;
	const { default: pretty } = await import("pino-pretty");
	return pretty(prettyOptions);
}
