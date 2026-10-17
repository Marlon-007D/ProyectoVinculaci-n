ALTER TABLE "invoice_products" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Only explicitly published, unassigned demo catalog rows are readable through the public Data API.
-- This grants read access only; catalog mutations and all invoice rows stay private.
GRANT SELECT ON TABLE "invoice_products" TO anon, authenticated;
--> statement-breakpoint
CREATE POLICY "invoice_products_public_catalog_read" ON "invoice_products"
  FOR SELECT TO anon, authenticated
  USING ("is_public" = true AND "is_active" = true AND "institution_id" IS NULL);
