import { setTimeout } from "node:timers/promises";
import { pool } from "./infra/db.js";
import { env } from "./infra/env.js";
import { logger as rootLogger } from "./infra/logger.js";
import { createHttpAdsClient } from "./modules/sync/ads-client.js";
import { createSyncWorker } from "./modules/sync/sync.worker.js";

const logger = rootLogger.child({ component: "sync-worker" });

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => controller.abort());
}

// Resolves early on shutdown instead of rejecting, so the loop exits cleanly.
async function sleep(ms: number): Promise<void> {
	await setTimeout(ms, undefined, { signal: controller.signal }).catch(
		() => {},
	);
}

const worker = createSyncWorker({
	client: createHttpAdsClient({
		baseUrl: env.ADS_API_URL,
		apiKey: env.ADS_API_KEY,
		timeoutMs: env.SYNC_REQUEST_TIMEOUT_MS,
	}),
	clock: { now: () => new Date() },
	random: Math.random,
	sleep,
	config: {
		batchSize: env.SYNC_BATCH_SIZE,
		rateLimitPerSecond: env.SYNC_RATE_LIMIT_PER_SECOND,
		maxAttempts: env.SYNC_MAX_ATTEMPTS,
		backoffBaseMs: env.SYNC_BACKOFF_BASE_MS,
		backoffMaxMs: env.SYNC_BACKOFF_MAX_MS,
		pollIntervalMs: env.SYNC_POLL_INTERVAL_MS,
	},
	logger,
});

logger.info({ adsApiUrl: env.ADS_API_URL }, "sync worker started");
try {
	await worker.run(controller.signal);
} finally {
	await pool.end();
	logger.info("sync worker stopped");
}
