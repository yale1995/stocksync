import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	lt,
	lte,
	max,
	or,
} from "drizzle-orm";
import { db, type Executor } from "../../infra/db.js";
import {
	type SyncEventStatus,
	syncEvents,
} from "../../infra/schemas/sync-events.js";

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

function isDue(now: Date) {
	return and(
		eq(syncEvents.status, "pending"),
		lte(syncEvents.nextAttemptAt, now),
	);
}

// The one cross-tenant query: it only chooses whose batch goes next.
export async function pickDueTenant(
	executor: Executor,
	now: Date,
): Promise<string | undefined> {
	const [row] = await executor
		.select({ tenantId: syncEvents.tenantId })
		.from(syncEvents)
		.where(isDue(now))
		.orderBy(asc(syncEvents.nextAttemptAt), asc(syncEvents.version))
		.limit(1)
		.for("update", { skipLocked: true });
	return row?.tenantId;
}

export function claimDueEvents(
	executor: Executor,
	tenantId: string,
	now: Date,
	limit: number,
) {
	return executor
		.select({
			id: syncEvents.id,
			productId: syncEvents.productId,
			version: syncEvents.version,
			sku: syncEvents.sku,
			stock: syncEvents.stock,
			priceCents: syncEvents.priceCents,
			attempts: syncEvents.attempts,
		})
		.from(syncEvents)
		.where(and(eq(syncEvents.tenantId, tenantId), isDue(now)))
		.orderBy(asc(syncEvents.version))
		.limit(limit)
		.for("update", { skipLocked: true });
}

export type ClaimedEvent = Awaited<ReturnType<typeof claimDueEvents>>[number];

export async function markSuperseded(
	executor: Executor,
	tenantId: string,
	ids: string[],
	now: Date,
): Promise<void> {
	if (ids.length === 0) return;
	await executor
		.update(syncEvents)
		.set({ status: "superseded", updatedAt: now })
		.where(and(eq(syncEvents.tenantId, tenantId), inArray(syncEvents.id, ids)));
}

export async function markSent(
	executor: Executor,
	tenantId: string,
	ids: string[],
	now: Date,
): Promise<void> {
	await executor
		.update(syncEvents)
		.set({ status: "sent", sentAt: now, updatedAt: now })
		.where(and(eq(syncEvents.tenantId, tenantId), inArray(syncEvents.id, ids)));
}

// The ad already holds a newer state of these products, so their older
// pending or failed events must never be sent.
export async function supersedeOlderEvents(
	executor: Executor,
	tenantId: string,
	sent: { productId: string; version: number }[],
	now: Date,
): Promise<void> {
	await executor
		.update(syncEvents)
		.set({ status: "superseded", updatedAt: now })
		.where(
			and(
				eq(syncEvents.tenantId, tenantId),
				inArray(syncEvents.status, ["pending", "failed"]),
				or(
					...sent.map(({ productId, version }) =>
						and(
							eq(syncEvents.productId, productId),
							lt(syncEvents.version, version),
						),
					),
				),
			),
		);
}

export async function rescheduleEvents(
	executor: Executor,
	tenantId: string,
	ids: string[],
	{
		nextAttemptAt,
		lastError,
		now,
	}: { nextAttemptAt: Date; lastError: string; now: Date },
): Promise<void> {
	await executor
		.update(syncEvents)
		.set({ nextAttemptAt, lastError, updatedAt: now })
		.where(and(eq(syncEvents.tenantId, tenantId), inArray(syncEvents.id, ids)));
}

export async function recordFailure(
	executor: Executor,
	tenantId: string,
	id: string,
	{
		attempts,
		lastError,
		nextAttemptAt,
		now,
	}: {
		attempts: number;
		lastError: string;
		nextAttemptAt: Date | null;
		now: Date;
	},
): Promise<void> {
	await executor
		.update(syncEvents)
		.set({
			attempts,
			lastError,
			updatedAt: now,
			...(nextAttemptAt ? { nextAttemptAt } : { status: "failed" as const }),
		})
		.where(and(eq(syncEvents.tenantId, tenantId), eq(syncEvents.id, id)));
}

export function countEventsByStatus(
	tenantId: string,
	executor: Executor = db,
): Promise<{ status: SyncEventStatus; total: number }[]> {
	return executor
		.select({ status: syncEvents.status, total: count() })
		.from(syncEvents)
		.where(eq(syncEvents.tenantId, tenantId))
		.groupBy(syncEvents.status);
}

export async function findLastSentAt(
	tenantId: string,
	executor: Executor = db,
): Promise<Date | null> {
	const [row] = await executor
		.select({ lastSentAt: max(syncEvents.sentAt) })
		.from(syncEvents)
		.where(eq(syncEvents.tenantId, tenantId));
	return row?.lastSentAt ?? null;
}

export function listFailedEvents(
	tenantId: string,
	limit: number,
	executor: Executor = db,
) {
	return executor
		.select({
			id: syncEvents.id,
			productId: syncEvents.productId,
			sku: syncEvents.sku,
			trigger: syncEvents.trigger,
			attempts: syncEvents.attempts,
			lastError: syncEvents.lastError,
			updatedAt: syncEvents.updatedAt,
		})
		.from(syncEvents)
		.where(
			and(eq(syncEvents.tenantId, tenantId), eq(syncEvents.status, "failed")),
		)
		.orderBy(desc(syncEvents.updatedAt), desc(syncEvents.id))
		.limit(limit);
}
