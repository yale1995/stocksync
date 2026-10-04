import { sql } from "drizzle-orm";
import {
	pgEnum,
	pgTable,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.js";
import { tenants } from "./tenants.js";

export const userRole = pgEnum("user_role", ["admin", "operator"]);

export type UserRole = (typeof userRole.enumValues)[number];

export const users = pgTable(
	"users",
	{
		id: uuid().primaryKey().default(sql`uuidv7()`),
		tenantId: uuid()
			.notNull()
			.references(() => tenants.id),
		email: text().notNull(),
		passwordHash: text().notNull(),
		role: userRole().notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex("users_email_unique")
			.on(table.email)
			.where(sql`${table.deletedAt} is null`),
		// Target for composite FKs from future tenant-owned tables.
		unique("users_tenant_id_id_unique").on(table.tenantId, table.id),
	],
);
