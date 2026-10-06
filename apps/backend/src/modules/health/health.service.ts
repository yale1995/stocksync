import { readFileSync } from "node:fs";
import { z } from "zod";
import { env } from "../../infra/env.js";
import * as repository from "./health.repository.js";

export const HEALTH_CHECK_TIMEOUT_MS = 1000;

const packageJson = z
	.object({ version: z.string() })
	.parse(
		JSON.parse(
			readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
		),
	);

const server = {
	status: "up",
	version: packageJson.version,
	nodeVersion: process.version,
	environment: env.NODE_ENV,
	provider: "local",
} as const;

const databaseDown = {
	status: "down",
	version: null,
	maxConnections: null,
	openConnections: null,
	latencyMs: null,
} as const;

// The timeout only stops waiting: the query keeps running in the pool.
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: NodeJS.Timeout | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`Health check timed out after ${ms} ms`)),
			ms,
		);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

async function checkDatabase() {
	const startedAt = performance.now();
	await repository.ping();
	const latencyMs = Math.round(performance.now() - startedAt);
	const [info, sync] = await Promise.all([
		repository.findDatabaseInfo(),
		repository.summarizeSyncQueue(),
	]);
	return { database: { status: "up", ...info, latencyMs } as const, sync };
}

export async function getHealth() {
	try {
		const { database, sync } = await withTimeout(
			checkDatabase(),
			HEALTH_CHECK_TIMEOUT_MS,
		);
		return { status: "ok", server, database, sync } as const;
	} catch (error) {
		console.error("Health check failed:", error);
		return {
			status: "unavailable",
			server,
			database: databaseDown,
			sync: null,
		} as const;
	}
}
