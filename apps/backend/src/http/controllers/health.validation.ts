import { z } from "zod";
import { timestampSchema } from "./common.validation.js";

const count = z.int().min(0);

export const healthSchema = z
	.strictObject({
		status: z.enum(["ok", "unavailable"]),
		server: z.strictObject({
			status: z.literal("up"),
			version: z.string(),
			nodeVersion: z.string(),
			environment: z.enum(["development", "test", "production"]),
			provider: z.literal("local"),
		}),
		database: z.strictObject({
			status: z.enum(["up", "down"]),
			version: z.string().nullable(),
			maxConnections: z.int().positive().nullable(),
			openConnections: count.nullable(),
			latencyMs: count.nullable(),
		}),
		sync: z
			.strictObject({
				pending: count,
				failed: count,
				oldestPendingAt: timestampSchema.nullable(),
				lastSuccessfulSyncAt: timestampSchema.nullable(),
			})
			.nullable(),
	})
	.meta({ id: "Health" });
