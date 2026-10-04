import { db, pool } from "../db.js";
import { seed } from "./seed.js";

try {
	await db.transaction((tx) => seed(tx));
	console.log("Seed completed");
} finally {
	await pool.end();
}
