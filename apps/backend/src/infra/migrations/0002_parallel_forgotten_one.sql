CREATE TYPE "public"."stock_movement_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_source" AS ENUM('initial', 'adjustment', 'sale');--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"direction" "stock_movement_direction" NOT NULL,
	"source" "stock_movement_source" NOT NULL,
	"quantity" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"reason" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_initial_is_in" CHECK ("stock_movements"."source" <> 'initial' OR "stock_movements"."direction" = 'in'),
	CONSTRAINT "stock_movements_sale_is_out" CHECK ("stock_movements"."source" <> 'sale' OR "stock_movements"."direction" = 'out'),
	CONSTRAINT "stock_movements_quantity_positive" CHECK ("stock_movements"."quantity" > 0 OR "stock_movements"."source" = 'initial'),
	CONSTRAINT "stock_movements_stock_after_non_negative" CHECK ("stock_movements"."stock_after" >= 0),
	CONSTRAINT "stock_movements_reason_only_for_adjustments" CHECK (("stock_movements"."source" = 'adjustment') = ("stock_movements"."reason" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_history_idx" ON "stock_movements" USING btree ("tenant_id","product_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);