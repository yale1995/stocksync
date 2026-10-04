import type { ErrorRequestHandler } from "express";
import { AppError, InternalServerError } from "./errors.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
	if (err instanceof AppError) {
		res
			.status(err.status)
			.json({ error: { code: err.code, message: err.message } });
		return;
	}

	console.error(err);
	const error = new InternalServerError();
	res
		.status(error.status)
		.json({ error: { code: error.code, message: error.message } });
};
