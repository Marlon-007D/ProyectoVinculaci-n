-- Custom SQL migration file, put your code below! --
-- Keep this exposed-schema catalog closed until the Auth team supplies the
-- canonical institution/membership contract needed for tenant RLS policies.
ALTER TABLE "invoice_products" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "invoice_products" FROM PUBLIC, anon, authenticated;
