# Migration and rollback plan

## Current state

- Drizzle Kit reads `db/schema/index.ts` and writes the only active history to `drizzle/`.
- Existing handwritten Supabase SQL was moved to `supabase/legacy-migrations/`; it is retained as evidence and must not be executed.
- A read-only inspection on 17 October 2026 confirmed the remote `public` schema was empty and no `supabase_migrations` schema existed. A public-schema backup manifest was captured before migration.
- A Code First Drizzle definition now mirrors the existing `invoice_products` columns and adds nullable `institution_id` to represent unassigned legacy rows.
- Drizzle migrations `0000` through `0003` were reviewed and applied using the `drizzle.__drizzle_migrations` ledger. They create invoice tables, force RLS, revoke `PUBLIC`/`anon`/`authenticated` access, and create no policies.

## Workflow for future migrations

1. Run `npm run db:backup-public` immediately before each application. The current manifest represents an empty pre-migration public schema.
2. Generate with `npm run db:generate` or the equivalent named Drizzle command and review the SQL in `drizzle/`.
3. Apply only with `npm run db:migrate`; it records hashes in `drizzle.__drizzle_migrations`.
4. Obtain the Auth/institution contract and decide whether existing public-read policy must be replaced before applying any multi-tenant design.
5. Review generated SQL for RLS default-deny, FK tenant consistency, grants, seeds, and provider-managed `auth`/`storage` objects.

## Apply/rollback gate

- Generate and review migration files only; never use `drizzle-kit push` for this production workflow.
- Test forward migrations and rollback on a disposable local database first.
- Before remote execution, require explicit approval, backup, schema/data snapshot, migration diff, and a documented recovery procedure.
- Do not use destructive rollback for populated tables without a separately approved data-recovery plan.
- Preserve all localStorage and mock data until an opt-in export/import has been previewed and verified by the user.
- Storage object migration must be performed by an authorized upload workflow; no base64 payloads go into SQL.

## Current migration status

The remote database contains `invoice_products`, `invoices`, and `invoice_items`; all three tables have RLS enabled and forced. `anon` can read only explicitly public catalog rows and perform invoice CRUD only when the random `x-invoice-session` capability matches the row's `session_id`. Rows with institutional/user ownership remain inaccessible. `authenticated` receives no invoice access until the Auth contract is implemented. The database tests exercise these checks directly.

The migration deliberately does not grant institution-scoped access. The canonical institution table and Auth membership contract are absent. After those are supplied, a follow-up migration must add verified FKs and RLS policies that derive the active institution from trusted claims or membership tables. Existing public demo catalog entries remain separate from institution-owned products through the explicit `is_public` flag. Invoice demo rows without institutional ownership are isolated by the per-tab session capability until then.

## Seed catalog

`db/seeds/data/invoice-products.json` is the single seed input for the existing invoice catalog mock. Run `npm run db:seed:invoice-catalog` only after a verified backup. The seed upserts by product ID, so rerunning it updates the six catalog records without duplication. It is a server-side Drizzle operation and never runs in Vite or the browser.
