import { sql } from "drizzle-orm";
import {
	check,
	integer,
	pgTable,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.js";
import { tenants } from "./tenants.js";

export const products = pgTable(
	"products",
	{
		id: uuid().primaryKey().default(sql`uuidv7()`),
		tenantId: uuid()
			.notNull()
			.references(() => tenants.id),
		sku: text().notNull(),
		name: text().notNull(),
		priceCents: integer().notNull(),
		stock: integer().notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex("products_tenant_id_sku_unique")
			.on(table.tenantId, table.sku)
			.where(sql`${table.deletedAt} is null`),
		// Target for composite FKs from sale_items and stock_movements.
		unique("products_tenant_id_id_unique").on(table.tenantId, table.id),
		check("products_sku_uppercase", sql`${table.sku} = upper(${table.sku})`),
		check("products_price_cents_non_negative", sql`${table.priceCents} >= 0`),
		check("products_stock_non_negative", sql`${table.stock} >= 0`),
	],
);
