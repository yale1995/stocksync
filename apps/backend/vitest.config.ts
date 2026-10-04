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
		},
	},
});
