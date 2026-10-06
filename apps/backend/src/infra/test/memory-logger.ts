import { Writable } from "node:stream";
import { pino } from "pino";
import { loggerOptions } from "../logger.js";

export type LogLine = Record<string, unknown> & { level: number; msg?: string };

export const LEVELS = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
} as const;

export function createMemoryLogger() {
	const chunks: string[] = [];
	const destination = new Writable({
		write(chunk, _encoding, callback) {
			chunks.push(chunk.toString());
			callback();
		},
	});
	const logger = pino({ ...loggerOptions, level: "trace" }, destination);
	return {
		logger,
		raw: () => chunks.join(""),
		lines: (): LogLine[] =>
			chunks
				.join("")
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line)),
	};
}
