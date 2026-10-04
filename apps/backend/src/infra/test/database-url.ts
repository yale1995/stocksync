import { existsSync } from "node:fs";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

if (!process.env.DATABASE_URL) {
	throw new Error(
		"DATABASE_URL is not set; tests derive the test database URL from it",
	);
}

export const TEST_DATABASE = "stocksync_test";

export const serverDatabaseUrl = process.env.DATABASE_URL;

const url = new URL(serverDatabaseUrl);
url.pathname = `/${TEST_DATABASE}`;

export const testDatabaseUrl = url.href;
