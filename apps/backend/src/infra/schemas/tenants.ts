import { sql } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns.js";

export const tenants = pgTable("tenants", {
	id: uuid().primaryKey().default(sql`uuidv7()`),
	name: text().notNull(),
	...timestamps,
});
