import { describe, expect, it } from "vitest";
import { formatMessage, prettyDestination } from "./pretty.js";

describe("pretty output", () => {
	it("is used only in development", async () => {
		expect(await prettyDestination("development")).toBeDefined();
		expect(await prettyDestination("test")).toBeUndefined();
		expect(await prettyDestination("production")).toBeUndefined();
	});

	it("leads a line with the short request id and ends with the time", () => {
		const message = formatMessage(
			{
				msg: "POST /updates 200",
				req: { id: "5f2c9a1e-7b3d-4c11-9e2a-0d4f6b8c1a22" },
				responseTime: 9,
			},
			"msg",
		);

		expect(message).toBe("[5f2c9a1e] POST /updates 200 9ms");
	});
});
