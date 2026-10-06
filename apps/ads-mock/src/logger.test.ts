import { Writable } from "node:stream";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { loggerOptions } from "./logger.js";

describe("redact", () => {
	it("censors the API key even if a serializer passes headers through", () => {
		const chunks: string[] = [];
		const logger = pino(
			loggerOptions,
			new Writable({
				write(chunk, _encoding, callback) {
					chunks.push(chunk.toString());
					callback();
				},
			}),
		);

		logger.info({ req: { headers: { "x-api-key": "secret-key" } } });

		expect(JSON.parse(chunks.join(""))).toMatchObject({
			req: { headers: { "x-api-key": "[Redacted]" } },
		});
		expect(chunks.join("")).not.toContain("secret-key");
	});
});
