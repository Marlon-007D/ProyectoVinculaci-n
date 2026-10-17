-- Custom SQL migration file, put your code below! --
-- Invoice records are private tenant data. Auth has not supplied a verified
-- membership source yet, so no policy is created and all API access is denied.
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "invoices", "invoice_items" FROM PUBLIC, anon, authenticated;
