import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products.js";
import { sales } from "./sales.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const stockMovementDirection = pgEnum("stock_movement_direction", [
	"in",
	"out",
]);

export const stockMovementSource = pgEnum("stock_movement_source", [
	"initial",
	"adjustment",
	"sale",
]);

export type StockMovementDirection =
	(typeof stockMovementDirection.enumValues)[number];
export type StockMovementSource =
	(typeof stockMovementSource.enumValues)[number];

// Append-only ledger: no updated_at or deleted_at. A wrong movement is
// corrected with an opposite adjustment, never edited or deleted.
export const stockMovements = pgTable(
	"stock_movements",
	{
		id: uuid().primaryKey().default(sql`uuidv7()`),
		tenantId: uuid()
			.notNull()
			.references(() => tenants.id),
		productId: uuid().notNull(),
		direction: stockMovementDirection().notNull(),
		source: stockMovementSource().notNull(),
		quantity: integer().notNull(),
		stockAfter: integer().notNull(),
		reason: text(),
		userId: uuid().notNull(),
		saleId: uuid(),
		// clock_timestamp(), not now(): now() is the transaction start, and a
		// transaction that waited on the product lock would sort before the
		// movement it waited for.
		createdAt: timestamp({ withTimezone: true })
			.notNull()
			.default(sql`clock_timestamp()`),
	},
	(table) => [
		foreignKey({
			name: "stock_movements_product_fk",
			columns: [table.tenantId, table.productId],
			foreignColumns: [products.tenantId, products.id],
		}),
		foreignKey({
			name: "stock_movements_user_fk",
			columns: [table.tenantId, table.userId],
			foreignColumns: [users.tenantId, users.id],
		}),
		foreignKey({
			name: "stock_movements_sale_fk",
			columns: [table.tenantId, table.saleId],
			foreignColumns: [sales.tenantId, sales.id],
		}),
		index("stock_movements_history_idx").on(
			table.tenantId,
			table.productId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"stock_movements_initial_is_in",
			sql`${table.source} <> 'initial' OR ${table.direction} = 'in'`,
		),
		check(
			"stock_movements_sale_is_out",
			sql`${table.source} <> 'sale' OR ${table.direction} = 'out'`,
		),
		check(
			"stock_movements_quantity_positive",
			sql`${table.quantity} > 0 OR ${table.source} = 'initial'`,
		),
		check(
			"stock_movements_stock_after_non_negative",
			sql`${table.stockAfter} >= 0`,
		),
		check(
			"stock_movements_reason_only_for_adjustments",
			sql`(${table.source} = 'adjustment') = (${table.reason} IS NOT NULL)`,
		),
		check(
			"stock_movements_sale_id_only_for_sales",
			sql`(${table.source} = 'sale') = (${table.saleId} IS NOT NULL)`,
		),
	],
);
