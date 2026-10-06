import type { ErrorRequestHandler, RequestHandler } from "express";
import {
	AppError,
	InternalServerError,
	NotFoundError,
} from "../../infra/errors.js";

export const notFoundHandler: RequestHandler = (req) => {
	throw new NotFoundError(`Route ${req.method} ${req.path} not found`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	if (err instanceof AppError) {
		res
			.status(err.status)
			.json({ error: { code: err.code, message: err.message } });
		return;
	}

	// pino-http logs it with the stack on the access line: one line per error.
	res.err = err;
	const error = new InternalServerError();
	res
		.status(error.status)
		.json({ error: { code: error.code, message: error.message } });
};
