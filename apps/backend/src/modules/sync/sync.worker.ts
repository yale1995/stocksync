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
	log?: (message: string) => void;
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

function label(event: ClaimedEvent): string {
	return `${event.sku} v${event.version}`;
}

function seconds(ms: number): string {
	return `${(ms / 1000).toFixed(1)} s`;
}

export function createSyncWorker({
	client,
	clock,
	random,
	sleep,
	config,
	log = () => {},
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

		return db.transaction(async (tx) => {
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

			const { kept, superseded } = coalesce(claimed);
			const prefix = `tenant ${tenantId}:`;
			for (const event of superseded) {
				const newer = kept.find((k) => k.productId === event.productId);
				log(`${prefix} ${label(event)} superseded by v${newer?.version}`);
			}
			await repository.markSuperseded(
				tx,
				tenantId,
				superseded.map((event) => event.id),
				now,
			);

			// The service's version check already makes the order irrelevant to the
			// final state; sorting by version keeps a deleted and recreated SKU in
			// the order the changes happened, so neither item is reported ignored.
			const result = await client.sendUpdates(tenantId, kept.map(toItem));
			const ids = kept.map((event) => event.id);
			const done = clock.now();

			if (result.kind === "ok") {
				await repository.markSent(tx, tenantId, ids, done);
				await repository.supersedeOlderEvents(tx, tenantId, kept, done);
				const counts = result.outcome
					? ` (applied ${result.outcome.applied}, ignored ${result.outcome.ignored})`
					: "";
				log(`${prefix} sent ${kept.map(label).join(", ")}${counts}`);
				return true;
			}

			if (result.kind === "rate_limited") {
				await repository.rescheduleEvents(tx, tenantId, ids, {
					nextAttemptAt: new Date(done.getTime() + result.retryAfterMs),
					lastError: "HTTP 429",
					now: done,
				});
				log(
					`${prefix} rate limited, ${kept.map(label).join(", ")} retry in ${seconds(result.retryAfterMs)}`,
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
				const attempt = `attempt ${attempts}/${config.maxAttempts}`;
				log(
					failed
						? `${prefix} ${label(event)} ${result.error} (${attempt}) -> failed`
						: `${prefix} ${label(event)} ${result.error} (${attempt}, retry in ${seconds(delayMs)})`,
				);
			}
			return true;
		});
	}

	async function run(signal: AbortSignal): Promise<void> {
		while (!signal.aborted) {
			let claimed = false;
			try {
				claimed = await tick();
			} catch (err) {
				log(`tick failed: ${err instanceof Error ? err.message : String(err)}`);
			}
			if (!claimed && !signal.aborted) await sleep(config.pollIntervalMs);
		}
	}

	return { tick, run };
}
