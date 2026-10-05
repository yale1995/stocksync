import { describe, expect, it } from "vitest";
import {
	ConflictError,
	ForbiddenError,
	InternalServerError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "./errors.js";

describe("AppError subclasses", () => {
	it.each([
		[ValidationError, 400, "VALIDATION_ERROR", "Invalid request"],
		[UnauthorizedError, 401, "UNAUTHORIZED", "Authentication required"],
		[
			ForbiddenError,
			403,
			"FORBIDDEN",
			"You do not have permission to perform this action",
		],
		[NotFoundError, 404, "NOT_FOUND", "Resource not found"],
		[
			ConflictError,
			409,
			"CONFLICT",
			"Request conflicts with the current state",
		],
		[
			InternalServerError,
			500,
			"INTERNAL_SERVER_ERROR",
			"Internal server error",
		],
	])(
		"%o has status %i, code %s and its default message",
		(ErrorClass, status, code, message) => {
			const error = new ErrorClass();

			expect(error.status).toBe(status);
			expect(error.code).toBe(code);
			expect(error.message).toBe(message);
		},
	);

	it.each([
		ValidationError,
		UnauthorizedError,
		ForbiddenError,
		NotFoundError,
		ConflictError,
		InternalServerError,
	])("%o uses a custom message when given", (ErrorClass) => {
		expect(new ErrorClass("custom").message).toBe("custom");
	});
});
