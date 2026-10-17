create table if not exists public.invoice_products (
  id text primary key,
  description text not null,
  unit_price numeric(10, 2) not null check (unit_price > 0),
  source_name text not null,
  source_url text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.invoice_products enable row level security;

drop policy if exists "Anyone can read active invoice products" on public.invoice_products;
create policy "Anyone can read active invoice products"
  on public.invoice_products
  for select
  to anon, authenticated
  using (is_active);

grant select on public.invoice_products to anon, authenticated;

insert into public.invoice_products (id, description, unit_price, source_name, source_url)
values
  ('notebook', 'Cuaderno universitario 1 línea, 100 hojas', 1.20, 'Donald Papelería', 'https://donald.ec/products/escribe-cuaderno-universitario-1-linea-100h'),
  ('marker', 'Marcador permanente punta biselada', 0.63, 'Materiales de Arte PRECISE', 'https://arteprecise.com/tienda/categoria-producto/marcadores/'),
  ('bond-paper', 'Resma papel bond blanco A4, 75 g', 4.65, 'Super Paco en Rappi', 'https://www.rappi.com.ec/p/resma-de-papel-bond-blanco-075grs-a-142702'),
  ('loose-sheets', 'Paquete de hojas A4, 50 hojas', 0.59, 'Donald Papelería', 'https://donald.ec/collections/escribe'),
  ('folder-pack', 'Folder de cartulina manila, paquete x5', 1.29, 'Super Paco en Rappi', 'https://www.rappi.com.ec/p/resma-de-papel-bond-blanco-075grs-a-142702')
on conflict (id) do update set
  description = excluded.description,
  unit_price = excluded.unit_price,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  is_active = true,
  updated_at = now();
