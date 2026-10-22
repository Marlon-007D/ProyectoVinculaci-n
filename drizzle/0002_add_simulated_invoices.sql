CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"product_id" text,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	CONSTRAINT "invoice_items_position_positive_check" CHECK ("invoice_items"."position" > 0),
	CONSTRAINT "invoice_items_quantity_positive_check" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_unit_price_positive_check" CHECK ("invoice_items"."unit_price" > 0),
	CONSTRAINT "invoice_items_line_total_positive_check" CHECK ("invoice_items"."line_total" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_identification" text NOT NULL,
	"issued_on" date NOT NULL,
	"payment_method" text NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_totals_nonnegative_check" CHECK ("invoices"."subtotal" >= 0 and "invoices"."tax" >= 0 and "invoices"."total" >= 0),
	CONSTRAINT "invoices_total_matches_components_check" CHECK ("invoices"."total" = "invoices"."subtotal" + "invoices"."tax")
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_invoice_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."invoice_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_product_id_idx" ON "invoice_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "invoices_institution_created_at_idx" ON "invoices" USING btree ("institution_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_owner_created_at_idx" ON "invoices" USING btree ("owner_user_id","created_at");