import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CreditCard, FileText, IdCard, Minus, Package, Plus, UserRound } from 'lucide-react'
import { sanitizeHtml } from '../../../../shared/utils/sanitizeHtml'
import type { InvoiceDraft, InvoiceProduct } from '../types/invoice.types'
import './InvoiceForm.css'

interface Props {
  activeStep: 1 | 2
  isLoading?: boolean
  draft: InvoiceDraft
  onField: (field: keyof Omit<InvoiceDraft, 'lines'>, value: string) => void
  products: InvoiceProduct[]
  onUpdate: (id: string, field: 'productId' | 'quantity', value: string | number) => void
  onAdd: (productId: string) => void
  onSetQuantity: (productId: string, quantity: number) => void
  onRemove: (id: string) => void
  onNext: () => void
  onPrevious: () => void
}

export function InvoiceForm({ activeStep, isLoading = false, draft, products, onField, onUpdate, onAdd, onSetQuantity, onRemove, onNext, onPrevious }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [productPage, setProductPage] = useState(0)
  const productsPerPage = 6
  const productPageCount = Math.max(1, Math.ceil(products.length / productsPerPage))
  const visibleProducts = products.slice(productPage * productsPerPage, (productPage + 1) * productsPerPage)
  const clearError = (key: string) => setErrors(current => {
    const next = { ...current }
    delete next[key]
    return next
  })
  const validateStep = () => {
    const next: Record<string, string> = {}
    if (activeStep === 2) {
      if (!draft.customer.trim()) next.customer = 'Ingresa el nombre del cliente.'
      if (!/^\d{10}$/.test(draft.identification)) next.identification = 'La cédula debe tener exactamente 10 dígitos.'
      if (!draft.date) next.date = 'Selecciona la fecha de emisión.'
      if (!draft.paymentMethod) next.paymentMethod = 'Selecciona una forma de pago.'
    }
    if (activeStep === 1) {
      if (draft.lines.length === 0) next.products = 'Agrega al menos un producto a la factura.'
      draft.lines.forEach(line => {
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) next[`${line.id}-quantity`] = 'Ingresa una cantidad mayor que cero.'
      })
    }
    setErrors(next)
    if (Object.keys(next).length === 0) onNext()
  }
  const fieldError = (key: string) => errors[key] && <span className="invoice-field-error" id={`invoice-error-${key}`} role="alert">{errors[key]}</span>

  return <div className="invoice-form-sections">
    {activeStep === 2 && <section className="invoice-card invoice-details-card" aria-labelledby="invoice-details-title">
    <div className="card-heading"><div className="invoice-title"><span className="invoice-title-icon"><FileText size={21} aria-hidden="true" /></span><div><p className="invoice-section-kicker">DATOS DE EMISIÓN</p><h2 id="invoice-details-title">Cliente y pago</h2></div></div></div>
    <div className="form-grid">
      <label><span className="invoice-field-label"><UserRound size={16} aria-hidden="true" />Cliente</span><input required maxLength={60} aria-invalid={!!errors.customer} aria-describedby={errors.customer ? 'invoice-error-customer' : undefined} value={draft.customer} onChange={e => { const rawValue = e.target.value; const cleanValue = sanitizeHtml(rawValue, 60).replace(/[^\p{L}\s]/gu, '').replace(/\s+/gu, ' ').trim(); const value = cleanValue && /\s$/u.test(rawValue) ? `${cleanValue} ` : cleanValue; onField('customer', value); if (value.trim()) clearError('customer') }} />{fieldError('customer')}</label>
      <label><span className="invoice-field-label"><IdCard size={16} aria-hidden="true" />Identificación</span><input required type="text" inputMode="numeric" autoComplete="off" maxLength={10} pattern="[0-9]{10}" aria-invalid={!!errors.identification} aria-describedby={errors.identification ? 'invoice-error-identification' : undefined} value={draft.identification} onChange={e => { const value = sanitizeHtml(e.target.value, 10).replace(/\D/g, '').slice(0, 10); onField('identification', value); if (/^\d{10}$/.test(value)) clearError('identification') }} />{fieldError('identification')}</label>
      <label><span className="invoice-field-label"><CalendarDays size={16} aria-hidden="true" />Fecha de emisión</span><input required type="date" aria-invalid={!!errors.date} aria-describedby={errors.date ? 'invoice-error-date' : undefined} value={draft.date} onChange={e => { onField('date', e.target.value); if (e.target.value) clearError('date') }} />{fieldError('date')}</label>
      <label><span className="invoice-field-label"><CreditCard size={16} aria-hidden="true" />Forma de pago</span><select required aria-invalid={!!errors.paymentMethod} aria-describedby={errors.paymentMethod ? 'invoice-error-paymentMethod' : undefined} value={draft.paymentMethod} onChange={e => { onField('paymentMethod', e.target.value); if (e.target.value) clearError('paymentMethod') }}><option value="" disabled>Selecciona una forma de pago</option><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select>{fieldError('paymentMethod')}</label>
    </div>
    <div className="invoice-step-actions invoice-step-actions-navigation"><div className="invoice-step-navigation" aria-label="Navegación de pasos"><button type="button" onClick={onPrevious} aria-label="Anterior">Anterior</button><button type="button" onClick={validateStep}>Siguiente</button></div></div>
    </section>}
    {activeStep === 1 && <section className="invoice-card invoice-products-card" aria-label="Productos">
    <div className="line-items"><div className="items-heading"><p>Elige los productos para incluir en la factura</p></div>
      {fieldError('products')}
      {activeStep === 1 && isLoading ? <div className="invoice-products-skeleton" role="status" aria-label="Cargando productos">
        {Array.from({ length: 4 }, (_, index) => <div className="invoice-product-skeleton-card" key={index} aria-hidden="true"><i /><div><b /><span /><span /></div></div>)}
      </div> : <div className="invoice-products-list">
        {visibleProducts.map(product => {
          const line = draft.lines.find(item => item.productId === product.id)
          const available = product.isAvailable && product.stock > 0
          const quantity = line?.quantity ?? 0
          const remainingStock = Math.max(0, product.stock - quantity)
          const hasRemainingStock = available && remainingStock > 0
          return <article className={`invoice-product-card${line ? ' is-selected' : ''}${available ? '' : ' is-unavailable'}`} key={product.id}>
            <img className="invoice-product-image" src={product.imageUrl ?? '/products/notebook.jpg'} alt={product.description} loading="lazy" />
            <div className="invoice-product-content">
              <div className="invoice-product-main">
                <h3>{product.description}</h3>
                <span className={`invoice-stock${hasRemainingStock ? '' : ' is-empty'}`}><Package size={14} aria-hidden="true" />{hasRemainingStock ? `Stock ${remainingStock}` : 'Sin stock'}</span>
              </div>
              <div className="invoice-product-meta">
                <div className="invoice-product-unit"><span>P. unitario</span><strong>{usd.format(product.unitPrice)}</strong></div>
                <div className="invoice-product-quantity"><div className="invoice-quantity-control" role="group" aria-label={`Unidades de ${product.description}`}><button type="button" aria-label={`Restar ${product.description}`} disabled={quantity === 0} onClick={() => { if (line && quantity === 1) onRemove(line.id); else if (line) onUpdate(line.id, 'quantity', quantity - 1); clearError(`${line?.id ?? product.id}-quantity`) }}><Minus size={16} /></button><input aria-label={`Cantidad de ${product.description}`} type="number" inputMode="numeric" min="0" max={product.stock} value={quantity} onChange={event => { onSetQuantity(product.id, Number(event.currentTarget.value)); clearError(`${line?.id ?? product.id}-quantity`) }} /><button type="button" aria-label={`Sumar ${product.description}`} disabled={!available || quantity >= product.stock} onClick={() => { if (line) onUpdate(line.id, 'quantity', quantity + 1); else onAdd(product.id); clearError('products') }}><Plus size={16} /></button></div>{line && fieldError(`${line.id}-quantity`)}</div>
                <div className="invoice-product-total"><span>Total</span><strong>{usd.format(quantity * product.unitPrice)}</strong></div>
              </div>
            </div>
          </article>
        })}
      </div>}
      {productPageCount > 1 && <nav className="invoice-product-pagination" aria-label="Páginas de productos"><button type="button" aria-label="Productos anteriores" disabled={productPage === 0} onClick={() => setProductPage(page => Math.max(0, page - 1))}><ChevronLeft size={18} /></button><span>{productPage * productsPerPage + 1}–{Math.min((productPage + 1) * productsPerPage, products.length)} de {products.length}</span><button type="button" aria-label="Más productos" disabled={productPage + 1 >= productPageCount} onClick={() => setProductPage(page => Math.min(productPageCount - 1, page + 1))}><ChevronRight size={18} /></button></nav>}
    </div>
    <div className="invoice-step-actions invoice-step-actions-navigation"><div className="invoice-step-navigation" aria-label="Navegación de pasos"><button type="button" onClick={onPrevious} disabled aria-label="Anterior">Anterior</button><button type="button" onClick={validateStep} disabled={isLoading}>Siguiente</button></div></div>
    </section>}
  </div>
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
