import { afterAll, beforeEach } from "vitest";
import { pool } from "../db.js";

beforeEach(async () => {
	const { rows } = await pool.query<{ tablename: string }>(
		"SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
	);
	if (rows.length === 0) return;

	const tables = rows.map((row) => `"${row.tablename}"`).join(", ");
	await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
	await pool.end();
});
