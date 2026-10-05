CREATE TYPE "public"."sync_event_status" AS ENUM('pending', 'sent', 'failed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."sync_event_trigger" AS ENUM('product_created', 'stock_changed', 'price_changed', 'product_deleted');--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"version" bigint GENERATED ALWAYS AS IDENTITY (sequence name "sync_events_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"trigger" "sync_event_trigger" NOT NULL,
	"sku" text NOT NULL,
	"stock" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"status" "sync_event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_events_version_unique" UNIQUE("version"),
	CONSTRAINT "sync_events_stock_non_negative" CHECK ("sync_events"."stock" >= 0),
	CONSTRAINT "sync_events_price_cents_non_negative" CHECK ("sync_events"."price_cents" >= 0),
	CONSTRAINT "sync_events_attempts_non_negative" CHECK ("sync_events"."attempts" >= 0),
	CONSTRAINT "sync_events_sent_at_only_when_sent" CHECK (("sync_events"."status" = 'sent') = ("sync_events"."sent_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_events_due_idx" ON "sync_events" USING btree ("next_attempt_at") WHERE "sync_events"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "sync_events_tenant_id_status_idx" ON "sync_events" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "sync_events_tenant_id_product_id_version_idx" ON "sync_events" USING btree ("tenant_id","product_id","version");