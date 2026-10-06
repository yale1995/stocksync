import { randomUUID } from "node:crypto";
import { type Logger, pino } from "pino";
import { db } from "../../infra/db.js";
import type { AdsClient, AdsItem } from "./ads-client.js";
import type { ClaimedEvent } from "./sync.repository.js";
import * as repository from "./sync.repository.js";
import { createTokenBucket } from "./token-bucket.js";

export type SyncWorkerConfig = {
	batchSize: number;
	rateLimitPerSecond: number;
	maxAttempts: number;
	backoffBaseMs: number;
	backoffMaxMs: number;
	pollIntervalMs: number;
};

export type SyncWorkerDeps = {
	client: AdsClient;
	clock: { now: () => Date };
	random: () => number;
	sleep: (ms: number) => Promise<void>;
	config: SyncWorkerConfig;
	logger?: Logger;
};

// Full jitter: a uniform wait in [0, cap) spreads retries of events that
// failed together instead of sending them back in waves.
export function backoffMs(
	attempts: number,
	{ backoffBaseMs, backoffMaxMs }: SyncWorkerConfig,
	random: () => number,
): number {
	return Math.min(backoffMaxMs, backoffBaseMs * 2 ** (attempts - 1)) * random();
}

export function coalesce(events: ClaimedEvent[]): {
	kept: ClaimedEvent[];
	superseded: ClaimedEvent[];
} {
	const newest = new Map<string, ClaimedEvent>();
	for (const event of events) {
		const current = newest.get(event.productId);
		if (!current || event.version > current.version) {
			newest.set(event.productId, event);
		}
	}
	const kept = [...newest.values()].toSorted((a, b) => a.version - b.version);
	const keptIds = new Set(kept.map((event) => event.id));
	return {
		kept,
		superseded: events.filter((event) => !keptIds.has(event.id)),
	};
}

function toItem({ sku, stock, priceCents, version }: ClaimedEvent): AdsItem {
	return { sku, stock, priceCents, version };
}

function itemsField(events: ClaimedEvent[]) {
	return events.map(({ sku, version }) => ({ sku, version }));
}

export function createSyncWorker({
	client,
	clock,
	random,
	sleep,
	config,
	logger = pino({ level: "silent" }),
}: SyncWorkerDeps) {
	const takeToken = createTokenBucket({
		ratePerSecond: config.rateLimitPerSecond,
		now: () => clock.now().getTime(),
		sleep,
	});

	// Returns whether events were claimed. The transaction stays open during
	// the HTTP call: a crash rolls it back and the events are due again at once.
	async function tick(): Promise<boolean> {
		await takeToken();

		// Rebound once a batch is claimed, so a failure after the claim is logged
		// with its tenantId and batchId.
		let log = logger;
		try {
			return await db.transaction(async (tx) => {
				const now = clock.now();
				const tenantId = await repository.pickDueTenant(tx, now);
				if (!tenantId) return false;

				const claimed = await repository.claimDueEvents(
					tx,
					tenantId,
					now,
					config.batchSize,
				);
				if (claimed.length === 0) return false;

				const batchId = randomUUID();
				log = logger.child({ tenantId, batchId });

				const { kept, superseded } = coalesce(claimed);
				for (const event of superseded) {
					const newer = kept.find((k) => k.productId === event.productId);
					log.debug(
						{
							sku: event.sku,
							version: event.version,
							supersededBy: newer?.version,
						},
						"event superseded",
					);
				}
				await repository.markSuperseded(
					tx,
					tenantId,
					superseded.map((event) => event.id),
					now,
				);

				// The service's version check already makes the order irrelevant to
				// the final state; sorting by version keeps a deleted and recreated
				// SKU in the order the changes happened, so neither item is reported
				// ignored.
				const sentAt = clock.now();
				const result = await client.sendUpdates(
					tenantId,
					kept.map(toItem),
					batchId,
				);
				const ids = kept.map((event) => event.id);
				const done = clock.now();
				const items = itemsField(kept);

				if (result.kind === "ok") {
					await repository.markSent(tx, tenantId, ids, done);
					await repository.supersedeOlderEvents(tx, tenantId, kept, done);
					log.info(
						{
							items,
							...result.outcome,
							durationMs: done.getTime() - sentAt.getTime(),
						},
						"batch sent",
					);
					return true;
				}

				if (result.kind === "rate_limited") {
					await repository.rescheduleEvents(tx, tenantId, ids, {
						nextAttemptAt: new Date(done.getTime() + result.retryAfterMs),
						lastError: "HTTP 429",
						now: done,
					});
					log.warn(
						{ items, retryAfterMs: result.retryAfterMs },
						"batch rate limited",
					);
					return true;
				}

				for (const event of kept) {
					const attempts = event.attempts + 1;
					const failed = attempts >= config.maxAttempts;
					const delayMs = failed ? 0 : backoffMs(attempts, config, random);
					await repository.recordFailure(tx, tenantId, event.id, {
						attempts,
						lastError: result.error,
						nextAttemptAt: failed ? null : new Date(done.getTime() + delayMs),
						now: done,
					});
					const fields = {
						sku: event.sku,
						version: event.version,
						attempts,
						maxAttempts: config.maxAttempts,
						error: result.error,
					};
					if (failed) log.error(fields, "event failed");
					else log.warn({ ...fields, retryInMs: delayMs }, "event will retry");
				}
				return true;
			});
		} catch (err) {
			log.error({ err }, "tick failed");
			throw err;
		}
	}

	async function run(signal: AbortSignal): Promise<void> {
		while (!signal.aborted) {
			let claimed = false;
			try {
				claimed = await tick();
			} catch {
				// Already logged by tick; the next tick retries.
			}
			if (!claimed && !signal.aborted) await sleep(config.pollIntervalMs);
		}
	}

	return { tick, run };
}
