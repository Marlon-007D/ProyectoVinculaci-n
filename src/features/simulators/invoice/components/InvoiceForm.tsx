import { useState } from 'react'
import { CalendarDays, CreditCard, FileText, IdCard, Plus, ShoppingBag, Trash2, UserRound } from 'lucide-react'
import type { InvoiceDraft, InvoiceLine, InvoiceProduct } from '../types/invoice.types'
import { sampleInvoiceQuantities } from '../mocks/invoiceMock'
import './InvoiceForm.css'

interface Props {
  draft: InvoiceDraft
  onField: (field: keyof Omit<InvoiceDraft, 'lines'>, value: string) => void
  products: InvoiceProduct[]
  catalogNotice: string
  onUpdate: (id: string, field: 'productId' | 'quantity', value: string | number) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onSubmit: () => void
  onReset: () => void
}

export function InvoiceForm({ draft, products, catalogNotice, onField, onUpdate, onAdd, onRemove, onSubmit, onReset }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const availableProducts = products.filter(product => !draft.lines.some(line => line.productId === product.id))
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
      if (!line.productId) next[`${line.id}-product`] = 'Selecciona un producto.'
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) next[`${line.id}-quantity`] = 'Ingresa una cantidad mayor que cero.'
    })
    setErrors(next)
    if (Object.keys(next).length === 0) onSubmit()
  }
  const fieldError = (key: string) => errors[key] && <span className="invoice-field-error" id={`invoice-error-${key}`} role="alert">{errors[key]}</span>

  return <section className="invoice-card">
    <div className="card-heading"><div className="invoice-title"><span className="invoice-title-icon"><FileText size={21} aria-hidden="true" /></span><h2>Factura de venta</h2></div></div>
    <div className="form-grid">
      <label><span className="invoice-field-label"><UserRound size={16} aria-hidden="true" />Cliente</span><input required aria-invalid={!!errors.customer} aria-describedby={errors.customer ? 'invoice-error-customer' : undefined} value={draft.customer} onChange={e => { onField('customer', e.target.value); if (e.target.value.trim()) clearError('customer') }} />{fieldError('customer')}</label>
      <label><span className="invoice-field-label"><IdCard size={16} aria-hidden="true" />Identificación</span><input required type="text" inputMode="numeric" autoComplete="off" maxLength={10} pattern="[0-9]{0,10}" aria-invalid={!!errors.identification} aria-describedby={errors.identification ? 'invoice-error-identification' : undefined} value={draft.identification} onChange={e => { const value = e.target.value.replace(/\D/g, '').slice(0, 10); onField('identification', value); if (value.trim()) clearError('identification') }} />{fieldError('identification')}</label>
      <label><span className="invoice-field-label"><CalendarDays size={16} aria-hidden="true" />Fecha de emisión</span><input required type="date" aria-invalid={!!errors.date} aria-describedby={errors.date ? 'invoice-error-date' : undefined} value={draft.date} onChange={e => { onField('date', e.target.value); if (e.target.value) clearError('date') }} />{fieldError('date')}</label>
      <label><span className="invoice-field-label"><CreditCard size={16} aria-hidden="true" />Forma de pago</span><select required aria-invalid={!!errors.paymentMethod} aria-describedby={errors.paymentMethod ? 'invoice-error-paymentMethod' : undefined} value={draft.paymentMethod} onChange={e => { onField('paymentMethod', e.target.value); if (e.target.value) clearError('paymentMethod') }}><option value="" disabled>Selecciona una forma de pago</option><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select>{fieldError('paymentMethod')}</label>
    </div>
    <div className="line-items"><div className="items-heading"><h3><ShoppingBag size={18} aria-hidden="true" />Productos</h3><button className="text-button" type="button" onClick={onAdd} disabled={availableProducts.length === 0} title={availableProducts.length === 0 ? 'Ya agregaste todos los productos disponibles' : undefined}><Plus size={18} /> Agregar ítem</button></div>
      {catalogNotice && <p className="invoice-catalog-notice" role="status">{catalogNotice}</p>}
      <div className="item-table"><div className="table-header"><span>Producto</span><span>Cantidad</span><span>Precio unitario</span><span aria-hidden="true" /><span>Total</span></div>
        {draft.lines.map(line => <div className="table-row" key={line.id}>
          <label className="table-cell description-cell"><span>Producto</span><select required aria-label="Producto" aria-invalid={!!errors[`${line.id}-product`]} aria-describedby={errors[`${line.id}-product`] ? `invoice-error-${line.id}-product` : undefined} value={line.productId ?? ''} onChange={e => { onUpdate(line.id, 'productId', e.target.value); if (e.target.value) clearError(`${line.id}-product`) }}><option value="" disabled>Selecciona un producto</option>{products.filter(product => product.id === line.productId || !draft.lines.some(other => other.id !== line.id && other.productId === product.id)).map(product => <option key={product.id} value={product.id}>{product.description}</option>)}</select>{fieldError(`${line.id}-product`)}</label>
          <label className="table-cell quantity-cell"><span>Cantidad</span><select required aria-label="Cantidad" aria-invalid={!!errors[`${line.id}-quantity`]} aria-describedby={errors[`${line.id}-quantity`] ? `invoice-error-${line.id}-quantity` : undefined} value={line.quantity} onChange={e => { onUpdate(line.id, 'quantity', e.target.value); if (Number(e.target.value) > 0) clearError(`${line.id}-quantity`) }}>{!sampleInvoiceQuantities.some(quantity => quantity === line.quantity) && <option value={line.quantity}>{line.quantity}</option>}{sampleInvoiceQuantities.map(quantity => <option key={quantity} value={quantity}>{quantity}</option>)}</select>{fieldError(`${line.id}-quantity`)}</label>
          <label className="table-cell price-cell"><span>Precio unitario</span><input required aria-label="Precio unitario (cargado del catálogo)" type="number" min="0.01" step=".01" value={line.unitPrice} readOnly title="Precio cargado del catálogo" /></label>
          <button className="icon-button delete-button" disabled={draft.lines.length === 1} onClick={() => onRemove(line.id)} aria-label="Eliminar ítem"><Trash2 size={18} /></button>
          <div className="table-row-total"><span>Total</span><output>{usd.format(line.quantity * line.unitPrice)}</output></div>
        </div>)}
      </div>
    </div>
    <div className="actions"><button className="secondary-button" type="button" onClick={() => { setErrors({}); onReset() }}>Restablecer</button><button className="primary-button" type="button" onClick={validateAndSubmit}><FileText size={18} /> Guardar factura</button></div>
  </section>
}

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })
