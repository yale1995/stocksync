import type { Transaction } from "../../infra/db.js";
import type { NewSyncEvent } from "./sync.repository.js";
import * as repository from "./sync.repository.js";

// Must run after the product row is locked (or inserted) in the same
// transaction. The version is drawn on insert, so the row lock serializes two
// changes to one product and the later change always gets the greater version.
export async function recordSyncEvent(
	tx: Transaction,
	event: NewSyncEvent,
): Promise<void> {
	await repository.insertSyncEvent(event, tx);
}
