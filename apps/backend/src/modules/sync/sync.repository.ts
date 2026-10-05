import { db, type Executor } from "../../infra/db.js";
import { syncEvents } from "../../infra/schemas/sync-events.js";

export type NewSyncEvent = Pick<
	typeof syncEvents.$inferInsert,
	"tenantId" | "productId" | "trigger" | "sku" | "stock" | "priceCents"
>;

export async function insertSyncEvent(
	values: NewSyncEvent,
	executor: Executor = db,
): Promise<void> {
	await executor.insert(syncEvents).values(values);
}
