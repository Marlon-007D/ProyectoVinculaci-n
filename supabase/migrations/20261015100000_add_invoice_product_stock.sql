alter table public.invoice_products
  add column if not exists stock integer not null default 0 check (stock >= 0);

update public.invoice_products
set stock = case id
  when 'notebook' then 24
  when 'marker' then 18
  when 'bond-paper' then 12
  when 'loose-sheets' then 30
  when 'folder-pack' then 16
  when 'colored-pencils' then 9
  else stock
end;
