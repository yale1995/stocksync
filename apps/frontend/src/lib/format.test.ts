import { describe, expect, it } from "vitest";
import {
	formatCents,
	formatDateTime,
	formatRelative,
	formatTime,
} from "./format";

describe("formatCents", () => {
	it.each([
		{ cents: 4990, expected: "$49.90" },
		{ cents: 0, expected: "$0.00" },
		{ cents: 5, expected: "$0.05" },
		{ cents: 123456789, expected: "$1,234,567.89" },
	])("formats $cents cents as $expected", ({ cents, expected }) => {
		expect(formatCents(cents)).toBe(expected);
	});
});

describe("formatDateTime", () => {
	it("formats an ISO timestamp as a medium date and time", () => {
		expect(formatDateTime("2026-10-06T14:05:09.000Z")).toBe(
			"Oct 6, 2026, 2:05:09 PM",
		);
	});
});

describe("formatTime", () => {
	it("formats an ISO timestamp as a short time", () => {
		expect(formatTime("2026-10-06T14:05:09.000Z")).toBe("2:05 PM");
	});
});

describe("formatRelative", () => {
	const now = Date.parse("2026-10-06T12:00:00.000Z");

	it.each([
		{ iso: "2026-10-06T12:00:00.000Z", expected: "now" },
		{ iso: "2026-10-06T11:59:30.000Z", expected: "30 seconds ago" },
		{ iso: "2026-10-06T11:59:00.000Z", expected: "1 minute ago" },
		{ iso: "2026-10-06T11:58:00.000Z", expected: "2 minutes ago" },
		{ iso: "2026-10-06T11:00:00.000Z", expected: "1 hour ago" },
		{ iso: "2026-10-06T09:00:00.000Z", expected: "3 hours ago" },
		{ iso: "2026-10-05T12:00:00.000Z", expected: "yesterday" },
		{ iso: "2026-10-02T12:00:00.000Z", expected: "4 days ago" },
		{ iso: "2026-10-06T11:59:59.000Z", expected: "1 second ago" },
		{ iso: "2026-10-06T10:30:00.000Z", expected: "1 hour ago" },
		{ iso: "2026-10-05T00:00:00.000Z", expected: "yesterday" },
		{ iso: "2026-10-03T13:00:00.000Z", expected: "2 days ago" },
	])("formats $iso as '$expected'", ({ iso, expected }) => {
		expect(formatRelative(iso, now)).toBe(expected);
	});
});
