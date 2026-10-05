import type { ZodError } from "zod";

export class AppError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = new.target.name;
		this.status = status;
		this.code = code;
	}
}

export class ValidationError extends AppError {
	constructor(message = "Invalid request") {
		super(400, "VALIDATION_ERROR", message);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "Authentication required") {
		super(401, "UNAUTHORIZED", message);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "You do not have permission to perform this action") {
		super(403, "FORBIDDEN", message);
	}
}

export class NotFoundError extends AppError {
	constructor(message = "Resource not found") {
		super(404, "NOT_FOUND", message);
	}
}

export class ConflictError extends AppError {
	constructor(message = "Request conflicts with the current state") {
		super(409, "CONFLICT", message);
	}
}

export class InternalServerError extends AppError {
	constructor(message = "Internal server error") {
		super(500, "INTERNAL_SERVER_ERROR", message);
	}
}

export function formatZodIssues(err: ZodError): string {
	return err.issues
		.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
		.join("; ");
}
