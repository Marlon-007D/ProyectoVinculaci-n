import 'dotenv/config'
import assert from 'node:assert/strict'
import test from 'node:test'

const rawUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const configured = Boolean(rawUrl && anonKey)
const projectUrl = configured
  ? new URL(rawUrl).origin
  : ''

function headers(sessionId, extra = {}) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'x-invoice-session': sessionId,
    ...extra,
  }
}

async function request(path, sessionId, options = {}) {
  const response = await fetch(`${projectUrl}/rest/v1/${path}`, {
    ...options,
    headers: headers(sessionId, options.headers),
  })
  const body = response.status === 204 ? null : await response.json()
  assert.ok(response.ok, `Supabase returned ${response.status}: ${JSON.stringify(body)}`)
  return body
}

test('Supabase REST persists invoice CRUD and isolates a different session', { skip: !configured }, async () => {
  const sessionId = crypto.randomUUID()
  const otherSessionId = crypto.randomUUID()
  let invoiceId
  try {
    invoiceId = await request('rpc/save_simulated_invoice', sessionId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_invoice_id: null,
        p_payload: {
          customer: 'Prueba REST',
          identification: '0000000000',
          date: '2026-10-17',
          paymentMethod: 'Efectivo',
          totals: { subtotal: 1.2, tax: 0.18, total: 1.38 },
          lines: [{ productId: 'notebook', description: 'Cuaderno de prueba', quantity: 1, unitPrice: 1.2 }],
        },
      }),
    })

    const ownInvoices = await request(
      'invoices?select=id,customer_name,invoice_items(id,description,quantity)&order=created_at.desc',
      sessionId,
    )
    const created = ownInvoices.find(invoice => invoice.id === invoiceId)
    assert.equal(created?.customer_name, 'Prueba REST')
    assert.equal(created?.invoice_items.length, 1)

    const hiddenInvoices = await request('invoices?select=id', otherSessionId)
    assert.equal(hiddenInvoices.some(invoice => invoice.id === invoiceId), false)

    const updatedId = await request('rpc/save_simulated_invoice', sessionId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_invoice_id: invoiceId,
        p_payload: {
          customer: 'Prueba REST actualizada',
          identification: '0000000000',
          date: '2026-10-17',
          paymentMethod: 'Transferencia',
          totals: { subtotal: 0.63, tax: 0.09, total: 0.72 },
          lines: [{ productId: 'marker', description: 'Marcador de prueba', quantity: 1, unitPrice: 0.63 }],
        },
      }),
    })
    assert.equal(updatedId, invoiceId)

    const removed = await request(`invoices?id=eq.${invoiceId}&select=id`, sessionId, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    })
    assert.equal(removed.length, 1)
    invoiceId = undefined
  } finally {
    if (invoiceId) {
      await request(`invoices?id=eq.${invoiceId}`, sessionId, { method: 'DELETE' }).catch(() => {})
    }
  }
})
