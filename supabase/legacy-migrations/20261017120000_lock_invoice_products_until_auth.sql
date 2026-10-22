-- Security hardening for the legacy invoice_products catalog.
-- This migration intentionally creates no tenant access policy: the Auth-owned
-- membership contract and the canonical institutions table are not available.
-- With RLS enabled and no policies, all API roles are denied by default.
do $$
begin
  if to_regclass('public.invoice_products') is not null then
    alter table public.invoice_products add column if not exists institution_id uuid;
    alter table public.invoice_products enable row level security;
    drop policy if exists "Anyone can read active invoice products" on public.invoice_products;
    revoke all on table public.invoice_products from anon, authenticated;
  end if;
end
$$;
