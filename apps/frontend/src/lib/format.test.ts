import { describe, expect, it } from "vitest";
import { formatCents } from "./format";

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
