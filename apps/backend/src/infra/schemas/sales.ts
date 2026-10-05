import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

// Sales are immutable facts, like the ledger: no updated_at or deleted_at.
// Deleting a sale would orphan its `out` movements; undoing one is a future
// refund that records a new `in` movement.
export const sales = pgTable(
	"sales",
	{
		id: uuid().primaryKey().default(sql`uuidv7()`),
		tenantId: uuid()
			.notNull()
			.references(() => tenants.id),
		userId: uuid().notNull(),
		idempotencyKey: uuid().notNull(),
		requestHash: text().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({
			name: "sales_user_fk",
			columns: [table.tenantId, table.userId],
			foreignColumns: [users.tenantId, users.id],
		}),
		unique("sales_tenant_id_idempotency_key_unique").on(
			table.tenantId,
			table.idempotencyKey,
		),
		// Target for composite FKs from sale_items and stock_movements.
		unique("sales_tenant_id_id_unique").on(table.tenantId, table.id),
		check("sales_request_hash_length", sql`length(${table.requestHash}) = 64`),
	],
);

// No created_at: it lives on the sale. The total is not stored either; it is
// derived from the frozen unit prices and cannot drift.
export const saleItems = pgTable(
	"sale_items",
	{
		id: uuid().primaryKey().default(sql`uuidv7()`),
		tenantId: uuid().notNull(),
		saleId: uuid().notNull(),
		productId: uuid().notNull(),
		quantity: integer().notNull(),
		unitPriceCents: integer().notNull(),
	},
	(table) => [
		foreignKey({
			name: "sale_items_sale_fk",
			columns: [table.tenantId, table.saleId],
			foreignColumns: [sales.tenantId, sales.id],
		}),
		foreignKey({
			name: "sale_items_product_fk",
			columns: [table.tenantId, table.productId],
			foreignColumns: [products.tenantId, products.id],
		}),
		unique("sale_items_sale_id_product_id_unique").on(
			table.saleId,
			table.productId,
		),
		check("sale_items_quantity_positive", sql`${table.quantity} > 0`),
		check(
			"sale_items_unit_price_cents_non_negative",
			sql`${table.unitPriceCents} >= 0`,
		),
	],
);
