INSERT INTO "invoice_products" (
  "id", "description", "unit_price", "source_name", "source_url", "image_url", "is_active", "is_public", "stock"
) VALUES
  ('notebook', 'Cuaderno universitario 1 línea, 100 hojas', 1.20, 'Donald Papelería', 'https://donald.ec/products/escribe-cuaderno-universitario-1-linea-100h', '/products/notebook.jpg', true, true, 24),
  ('marker', 'Marcador permanente punta biselada', 0.63, 'Materiales de Arte PRECISE', 'https://arteprecise.com/tienda/categoria-producto/marcadores/', '/products/marker.jpg', true, true, 18),
  ('bond-paper', 'Resma papel bond blanco A4, 75 g', 4.65, 'Super Paco en Rappi', 'https://www.rappi.com.ec/p/resma-de-papel-bond-blanco-075grs-a-142702', '/products/bond-paper.jpg', true, true, 12),
  ('loose-sheets', 'Paquete de hojas A4, 50 hojas', 0.59, 'Donald Papelería', 'https://donald.ec/collections/escribe', '/products/loose-sheets.jpg', true, true, 30),
  ('folder-pack', 'Folder de cartulina manila, paquete x5', 1.29, 'Papelería local', 'https://donald.ec/collections/escribe', '/products/folder-pack.jpg', true, true, 16),
  ('colored-pencils', 'Lápices de colores, caja x12', 1.85, 'Papelería local', 'https://donald.ec/collections/escribe', '/products/colored-pencils.jpg', true, true, 9)
ON CONFLICT ("id") DO NOTHING;
