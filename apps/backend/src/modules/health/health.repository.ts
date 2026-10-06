import { max, sql } from "drizzle-orm";
import { db } from "../../infra/db.js";
import { syncEvents } from "../../infra/schemas/sync-events.js";

export async function ping(): Promise<void> {
	await db.execute(sql`SELECT 1`);
}

export async function findDatabaseInfo() {
	const [version, maxConnections, openConnections] = await Promise.all([
		db.execute<{ server_version: string }>(sql`SHOW server_version`),
		db.execute<{ max_connections: string }>(sql`SHOW max_connections`),
		db.execute<{ total: number }>(
			sql`SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname = current_database()`,
		),
	]);
	return {
		version: version.rows[0]?.server_version ?? "",
		maxConnections: Number(maxConnections.rows[0]?.max_connections),
		openConnections: openConnections.rows[0]?.total ?? 0,
	};
}

// Not filtered by tenant: a global, aggregate-only operational view that
// returns no tenant ids.
export async function summarizeSyncQueue() {
	const [row] = await db
		.select({
			pending:
				sql`count(*) FILTER (WHERE ${syncEvents.status} = 'pending')`.mapWith(
					Number,
				),
			failed:
				sql`count(*) FILTER (WHERE ${syncEvents.status} = 'failed')`.mapWith(
					Number,
				),
			oldestPendingAt:
				sql`min(${syncEvents.createdAt}) FILTER (WHERE ${syncEvents.status} = 'pending')`.mapWith(
					syncEvents.createdAt,
				),
			lastSuccessfulSyncAt: max(syncEvents.sentAt),
		})
		.from(syncEvents);
	return {
		pending: row?.pending ?? 0,
		failed: row?.failed ?? 0,
		oldestPendingAt: row?.oldestPendingAt ?? null,
		lastSuccessfulSyncAt: row?.lastSuccessfulSyncAt ?? null,
	};
}
