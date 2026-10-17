CREATE TABLE "invoice_products" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"institution_id" uuid,
	CONSTRAINT "invoice_products_unit_price_check" CHECK ("invoice_products"."unit_price" > 0),
	CONSTRAINT "invoice_products_stock_check" CHECK ("invoice_products"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_products" ENABLE ROW LEVEL SECURITY;