import { useState } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'
import type { InvoiceDraft, InvoiceLine } from '../types/invoice.types'
import './InvoiceForm.css'

interface Props {
  draft: InvoiceDraft
  onField: (field: keyof Omit<InvoiceDraft, 'lines'>, value: string) => void
  onUpdate: (id: string, field: 'description' | 'quantity' | 'unitPrice', value: string | number) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onSubmit: () => void
  onReset: () => void
}

export function InvoiceForm({ draft, onField, onUpdate, onAdd, onRemove, onSubmit, onReset }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const setError = (key: string, message: string) => setErrors(current => ({ ...current, [key]: message }))
  const clearError = (key: string) => setErrors(current => {
    const next = { ...current }
    delete next[key]
    return next
  })
  const validateAndSubmit = () => {
    const next: Record<string, string> = {}
    if (!draft.customer.trim()) next.customer = 'Ingresa el nombre del cliente.'
    if (!draft.identification.trim()) next.identification = 'Ingresa la identificación.'
    if (!draft.date) next.date = 'Selecciona la fecha de emisión.'
    if (!draft.paymentMethod) next.paymentMethod = 'Selecciona una forma de pago.'
    draft.lines.forEach(line => {
      if (!line.description.trim()) next[`${line.id}-description`] = 'Ingresa la descripción del producto.'
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) next[`${line.id}-quantity`] = 'Ingresa una cantidad mayor que cero.'
      if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) next[`${line.id}-unitPrice`] = 'Ingresa un precio mayor que cero.'
    })
    setErrors(next)
    if (Object.keys(next).length === 0) onSubmit()
  }
  const fieldError = (key: string) => errors[key] && <span className="invoice-field-error" id={`invoice-error-${key}`} role="alert">{errors[key]}</span>

  return <section className="invoice-card">
    <div className="card-heading"><h2>Factura de venta</h2></div>
    <div className="form-grid">
      <label>Cliente<input required aria-invalid={!!errors.customer} aria-describedby={errors.customer ? 'invoice-error-customer' : undefined} value={draft.customer} onChange={e => { onField('customer', e.target.value); if (e.target.value.trim()) clearError('customer') }} />{fieldError('customer')}</label>
      <label>Identificación<input required type="text" inputMode="numeric" autoComplete="off" maxLength={10} pattern="[0-9]{0,10}" aria-invalid={!!errors.identification} aria-describedby={errors.identification ? 'invoice-error-identification' : undefined} value={draft.identification} onChange={e => { const value = e.target.value.replace(/\D/g, '').slice(0, 10); onField('identification', value); if (value.trim()) clearError('identification') }} />{fieldError('identification')}</label>
      <label>Fecha de emisión<input required type="date" aria-invalid={!!errors.date} aria-describedby={errors.date ? 'invoice-error-date' : undefined} value={draft.date} onChange={e => { onField('date', e.target.value); if (e.target.value) clearError('date') }} />{fieldError('date')}</label>
      <label>Forma de pago<select required aria-invalid={!!errors.paymentMethod} aria-describedby={errors.paymentMethod ? 'invoice-error-paymentMethod' : undefined} value={draft.paymentMethod} onChange={e => { onField('paymentMethod', e.target.value); if (e.target.value) clearError('paymentMethod') }}><option value="" disabled>Selecciona una forma de pago</option><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select>{fieldError('paymentMethod')}</label>
    </div>
    <div className="line-items"><div className="items-heading"><h3>Productos</h3><button className="text-button" onClick={onAdd}><Plus size={18} /> Agregar ítem</button></div>
      <div className="item-table"><div className="table-header"><span>Descripción</span><span>Cantidad</span><span>Precio unitario</span><span aria-hidden="true" /><span>Total</span></div>
        {draft.lines.map(line => <div className="table-row" key={line.id}>
          <label className="table-cell description-cell"><span>Descripción</span><input required aria-label="Descripción" aria-invalid={!!errors[`${line.id}-description`]} aria-describedby={errors[`${line.id}-description`] ? `invoice-error-${line.id}-description` : undefined} value={line.description} onChange={e => { onUpdate(line.id, 'description', e.target.value); if (e.target.value.trim()) clearError(`${line.id}-description`) }} />{fieldError(`${line.id}-description`)}</label>
          <label className="table-cell quantity-cell"><span>Cantidad</span><input required aria-label="Cantidad" aria-invalid={!!errors[`${line.id}-quantity`]} aria-describedby={errors[`${line.id}-quantity`] ? `invoice-error-${line.id}-quantity` : undefined} type="number" min="0.01" value={line.quantity} onChange={e => { onUpdate(line.id, 'quantity', e.target.value); if (Number(e.target.value) > 0) clearError(`${line.id}-quantity`) }} />{fieldError(`${line.id}-quantity`)}</label>
          <label className="table-cell price-cell"><span>Precio unitario</span><input required aria-label="Precio unitario" aria-invalid={!!errors[`${line.id}-unitPrice`]} aria-describedby={errors[`${line.id}-unitPrice`] ? `invoice-error-${line.id}-unitPrice` : undefined} type="number" min="0.01" step=".01" value={line.unitPrice} onChange={e => { onUpdate(line.id, 'unitPrice', e.target.value); if (Number(e.target.value) > 0) clearError(`${line.id}-unitPrice`) }} />{fieldError(`${line.id}-unitPrice`)}</label>
          <button className="icon-button delete-button" disabled={draft.lines.length === 1} onClick={() => onRemove(line.id)} aria-label="Eliminar ítem"><Trash2 size={18} /></button>
          <div className="table-row-total"><span>Total</span><output>{usd.format(line.quantity * line.unitPrice)}</output></div>
        </div>)}
      </div>
    </div>
    <div className="actions"><button className="secondary-button" type="button" onClick={() => { setErrors({}); onReset() }}>Restablecer</button><button className="primary-button" type="button" onClick={validateAndSubmit}><FileText size={18} /> Guardar factura</button></div>
  </section>
}

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })
