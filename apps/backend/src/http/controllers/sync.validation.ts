import { z } from "zod";
import { syncEventTrigger } from "../../infra/schemas/sync-events.js";
import { timestampSchema } from "./common.validation.js";

const count = z.int().min(0);

export const syncStatusSchema = z
	.strictObject({
		pending: count,
		sent: count,
		failed: count,
		superseded: count,
		lastSuccessfulSyncAt: timestampSchema.nullable(),
		failedEvents: z.array(
			z.strictObject({
				id: z.uuid(),
				productId: z.uuid(),
				sku: z.string(),
				trigger: z.enum(syncEventTrigger.enumValues),
				attempts: count,
				lastError: z.string().nullable(),
				updatedAt: timestampSchema,
			}),
		),
	})
	.meta({ id: "SyncStatus" });
