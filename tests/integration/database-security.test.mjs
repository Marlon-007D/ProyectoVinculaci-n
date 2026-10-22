import 'dotenv/config'
import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL

test('protected invoice tables deny anonymous and authenticated roles', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
  try {
    const tables = await sql.unsafe(`
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where nspname = 'public' and relname in ('invoice_products', 'invoices', 'invoice_items')
      order by relname
    `)
    assert.equal(tables.length, 3)
    for (const table of tables) {
      assert.equal(table.relrowsecurity, true, `${table.relname} must enable RLS`)
      assert.equal(table.relforcerowsecurity, true, `${table.relname} must force RLS`)
    }

    const policies = await sql.unsafe(`
      select policyname from pg_policies
      where schemaname = 'public' and tablename in ('invoice_products', 'invoices', 'invoice_items')
    `)
    assert.deepEqual(policies.map(row => row.policyname).sort(), [
      'invoice_items_session_capability_access',
      'invoice_products_public_catalog_read',
      'invoices_session_capability_access',
    ])

    for (const role of ['anon', 'authenticated']) {
      await sql.unsafe('begin')
      try {
        await sql.unsafe(`set local role ${role}`)
        if (role === 'anon') {
          const rows = await sql.unsafe('select count(*)::int as count from public.invoices')
          assert.equal(rows[0].count, 0, 'anonymous access without a session capability must see no invoices')
        } else {
          await assert.rejects(
            () => sql.unsafe('select count(*) from public.invoices'),
            error => error?.code === '42501',
          )
        }
      } finally {
        await sql.unsafe('rollback')
      }
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
})

test('invoice RLS scopes Supabase CRUD to the session capability', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
  const invoiceSession = '77777777-7777-4777-8777-777777777777'
  const otherSession = '88888888-8888-4888-8888-888888888888'
  try {
    await sql.unsafe('begin')
    await sql.unsafe('set local role anon')
    await sql.unsafe(`select set_config('request.headers', '{"x-invoice-session":"${invoiceSession}"}', true)`)
    const [created] = await sql.unsafe(`
      insert into public.invoices (
        institution_id, owner_user_id, session_id, customer_name, customer_identification,
        issued_on, payment_method, subtotal, tax, total
      ) values (
        null, null, '${invoiceSession}', 'Cliente de sesión', '0000000000',
        '2026-10-17', 'Efectivo', 1.00, 0.15, 1.15
      ) returning id
    `)
    await sql.unsafe(`
      insert into public.invoice_items (invoice_id, product_id, position, description, quantity, unit_price, line_total)
      values ('${created.id}', null, 1, 'Producto simulado', 1, 1.00, 1.00)
    `)
    const ownRows = await sql.unsafe('select id from public.invoices')
    assert.equal(ownRows.length, 1)
    const ownItems = await sql.unsafe('select id from public.invoice_items')
    assert.equal(ownItems.length, 1)

    await sql.unsafe(`select set_config('request.headers', '{"x-invoice-session":"${otherSession}"}', true)`)
    const otherRows = await sql.unsafe('select id from public.invoices')
    assert.equal(otherRows.length, 0)
    const otherDelete = await sql.unsafe(`delete from public.invoices where id = '${created.id}' returning id`)
    assert.equal(otherDelete.length, 0)
  } finally {
    try {
      await sql.unsafe('rollback')
    } finally {
      await sql.end({ timeout: 5 })
    }
  }
})

test('anonymous role can only read explicitly public catalog rows', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
  try {
    await sql.unsafe('begin')
    await sql.unsafe(`
      insert into public.invoice_products (id, description, unit_price, source_name, source_url, stock, is_public)
      values
        ('public-catalog-test', 'Producto público', 1.00, 'Prueba', 'https://example.test/publico', 2, true),
        ('private-catalog-test', 'Producto privado', 1.00, 'Prueba', 'https://example.test/privado', 2, false)
    `)
    await sql.unsafe('set local role anon')
    const visible = await sql.unsafe(`
      select id from public.invoice_products
      where id in ('public-catalog-test', 'private-catalog-test') order by id
    `)
    assert.deepEqual(visible.map(row => row.id), ['public-catalog-test'])
    await assert.rejects(
      () => sql.unsafe(`delete from public.invoice_products where id = 'public-catalog-test'`),
      error => error?.code === '42501',
    )
  } finally {
    try {
      await sql.unsafe('rollback')
    } finally {
      await sql.end({ timeout: 5 })
    }
  }
})

test('invoice constraints and foreign keys reject invalid records', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
  const validInvoiceId = '11111111-1111-4111-8111-111111111111'
  try {
    await sql.unsafe('begin')
    await sql.unsafe(`
      insert into public.invoice_products (id, description, unit_price, source_name, source_url, stock)
      values ('constraint-test-product', 'Producto de prueba', 1.00, 'Prueba', 'https://example.test/producto', 1)
    `)
    await sql.unsafe(`
      insert into public.invoices (
        id, institution_id, owner_user_id, customer_name, customer_identification,
        issued_on, payment_method, subtotal, tax, total
      ) values (
        '${validInvoiceId}', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
        'Cliente de prueba', '0000000000', '2026-10-17', 'Efectivo', 1.00, 0.15, 1.15
      )
    `)

    await sql.unsafe('savepoint invalid_invoice_total')
    await assert.rejects(
      () => sql.unsafe(`
        insert into public.invoices (
          institution_id, owner_user_id, customer_name, customer_identification,
          issued_on, payment_method, subtotal, tax, total
        ) values (
          '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
          'Cliente inválido', '0000000000', '2026-10-17', 'Efectivo', 1.00, 0.15, 1.00
        )
      `),
      error => error?.code === '23514',
    )
    await sql.unsafe('rollback to savepoint invalid_invoice_total')

    await sql.unsafe('savepoint invalid_item_quantity')
    await assert.rejects(
      () => sql.unsafe(`
        insert into public.invoice_items (invoice_id, product_id, position, description, quantity, unit_price, line_total)
        values ('${validInvoiceId}', 'constraint-test-product', 1, 'Ítem inválido', 0, 1.00, 1.00)
      `),
      error => error?.code === '23514',
    )
    await sql.unsafe('rollback to savepoint invalid_item_quantity')

    await sql.unsafe('savepoint missing_product')
    await assert.rejects(
      () => sql.unsafe(`
        insert into public.invoice_items (invoice_id, product_id, position, description, quantity, unit_price, line_total)
        values ('${validInvoiceId}', 'missing-product', 1, 'Ítem inválido', 1, 1.00, 1.00)
      `),
      error => error?.code === '23503',
    )
    await sql.unsafe('rollback to savepoint missing_product')
  } finally {
    try {
      await sql.unsafe('rollback')
    } finally {
      await sql.end({ timeout: 5 })
    }
  }
})
