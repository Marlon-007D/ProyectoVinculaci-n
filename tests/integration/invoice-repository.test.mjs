import 'dotenv/config'
import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import { createPostgresInvoiceRepository } from '../../server/repositories/PostgresInvoiceRepository.ts'

const databaseUrl = process.env.DATABASE_URL
const institutionId = '44444444-4444-4444-8444-444444444444'
const ownerUserId = '55555555-5555-4555-8555-555555555555'

test('server repository performs tenant-scoped invoice CRUD', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
  try {
    await sql.unsafe('begin')
    const repository = createPostgresInvoiceRepository(sql, { institutionId, userId: ownerUserId })
    const created = await repository.save({
      customer: 'Cliente de integración',
      identification: '0000000000',
      date: '2026-10-17',
      paymentMethod: 'Efectivo',
      lines: [{ id: 'test-line', productId: 'notebook', description: 'Cuaderno universitario 1 línea, 100 hojas', quantity: 2, unitPrice: 1.2 }],
      totals: { subtotal: 2.4, tax: 0.36, total: 2.76 },
    })
    assert.equal((await repository.list()).length, 1)
    assert.equal(created.lines[0].productId, 'notebook')

    const updated = await repository.update(created.id, {
      customer: 'Cliente actualizado',
      identification: '0000000000',
      date: '2026-10-17',
      paymentMethod: 'Transferencia',
      lines: [{ id: 'test-line-updated', productId: 'marker', description: 'Marcador permanente punta biselada', quantity: 3, unitPrice: 0.63 }],
      totals: { subtotal: 1.89, tax: 0.28, total: 2.17 },
    })
    assert.equal(updated.customer, 'Cliente actualizado')
    assert.equal(updated.lines[0].productId, 'marker')

    const otherTenant = createPostgresInvoiceRepository(sql, { institutionId: '66666666-6666-4666-8666-666666666666', userId: ownerUserId })
    await assert.rejects(() => otherTenant.remove(created.id), /no encontrada/)

    await repository.remove(created.id)
    assert.deepEqual(await repository.list(), [])
  } finally {
    try {
      await sql.unsafe('rollback')
    } finally {
      await sql.end({ timeout: 5 })
    }
  }
})
