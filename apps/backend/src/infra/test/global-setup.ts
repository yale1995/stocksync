import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import {
	serverDatabaseUrl,
	TEST_DATABASE,
	testDatabaseUrl,
} from "./database-url.js";

const migrationsFolder = fileURLToPath(
	new URL("../migrations", import.meta.url),
);

async function createTestDatabaseIfMissing() {
	const client = new Client({ connectionString: serverDatabaseUrl });
	await client.connect();

	try {
		const result = await client.query(
			"SELECT 1 FROM pg_database WHERE datname = $1",
			[TEST_DATABASE],
		);
		if (result.rowCount === 0) {
			await client.query(`CREATE DATABASE ${TEST_DATABASE}`);
		}
	} finally {
		await client.end();
	}
}

async function migrateTestDatabase() {
	const client = new Client({ connectionString: testDatabaseUrl });
	await client.connect();

	try {
		await migrate(drizzle({ client }), { migrationsFolder });
	} finally {
		await client.end();
	}
}

export default async function setup() {
	await createTestDatabaseIfMissing();
	await migrateTestDatabase();
}
