import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./src/infra/test/database-url.js";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		globalSetup: ["src/infra/test/global-setup.ts"],
		setupFiles: ["src/infra/test/setup.ts"],
		// Every test file shares one database and truncates it between tests.
		fileParallelism: false,
		env: {
			DATABASE_URL: testDatabaseUrl,
			PORT: "3000",
			JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
			CORS_ORIGIN: "http://localhost:5173",
			NODE_ENV: "test",
			LOG_LEVEL: "silent",
			ADS_API_URL: "http://localhost:4000",
			ADS_API_KEY: "test-ads-api-key",
			SYNC_BATCH_SIZE: "50",
			SYNC_RATE_LIMIT_PER_SECOND: "5",
			SYNC_REQUEST_TIMEOUT_MS: "3000",
			SYNC_MAX_ATTEMPTS: "5",
			SYNC_BACKOFF_BASE_MS: "1000",
			SYNC_BACKOFF_MAX_MS: "60000",
			SYNC_POLL_INTERVAL_MS: "1000",
		},
	},
});
