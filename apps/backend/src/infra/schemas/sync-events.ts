import { sql } from "drizzle-orm";
import {
	bigint,
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
import { tenants } from "./tenants.js";

export const syncEventTrigger = pgEnum("sync_event_trigger", [
	"product_created",
	"stock_changed",
	"price_changed",
	"product_deleted",
]);

export const syncEventStatus = pgEnum("sync_event_status", [
	"pending",
	"sent",
	"failed",
	"superseded",
]);

export type SyncEventTrigger = (typeof syncEventTrigger.enumValues)[number];
export type SyncEventStatus = (typeof syncEventStatus.enumValues)[number];

// Outbox: the API inserts a row and only the worker updates it afterwards.
// Rows are never deleted, so there is no deleted_at.
export const syncEvents = pgTable(
	"sync_events",
	{
		id: uuid().primaryKey().default(sql`uuidv7()`),
		tenantId: uuid()
			.notNull()
			.references(() => tenants.id),
		productId: uuid().notNull(),
		// One table-wide sequence, not a per-product counter: a counter would
		// restart when a product is deleted and recreated with the same SKU.
		version: bigint({ mode: "number" })
			.notNull()
			.generatedAlwaysAsIdentity()
			.unique(),
		trigger: syncEventTrigger().notNull(),
		sku: text().notNull(),
		stock: integer().notNull(),
		priceCents: integer().notNull(),
		status: syncEventStatus().notNull().default("pending"),
		attempts: integer().notNull().default(0),
		nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		lastError: text(),
		sentAt: timestamp({ withTimezone: true }),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		foreignKey({
			name: "sync_events_product_fk",
			columns: [table.tenantId, table.productId],
			foreignColumns: [products.tenantId, products.id],
		}),
		index("sync_events_due_idx")
			.on(table.nextAttemptAt)
			.where(sql`${table.status} = 'pending'`),
		index("sync_events_tenant_id_status_idx").on(table.tenantId, table.status),
		index("sync_events_tenant_id_product_id_version_idx").on(
			table.tenantId,
			table.productId,
			table.version,
		),
		check("sync_events_stock_non_negative", sql`${table.stock} >= 0`),
		check(
			"sync_events_price_cents_non_negative",
			sql`${table.priceCents} >= 0`,
		),
		check("sync_events_attempts_non_negative", sql`${table.attempts} >= 0`),
		check(
			"sync_events_sent_at_only_when_sent",
			sql`(${table.status} = 'sent') = (${table.sentAt} IS NOT NULL)`,
		),
	],
);
