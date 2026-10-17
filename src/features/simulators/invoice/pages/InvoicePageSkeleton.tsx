import './InvoicePageSkeleton.css'

const steps = ['Productos', 'Datos de emisión', 'Total factura']

export function InvoicePageSkeleton() {
  return <section className="page-content invoice-page invoice-page-skeleton" role="status" aria-label="Cargando facturación electrónica" aria-busy="true">
    <span className="invoice-skeleton-sr-only">Cargando catálogo de productos</span>
    <nav className="invoice-skeleton-stepper" aria-hidden="true"><ol>{steps.map((step, index) => <li className={index === 0 ? 'is-current' : ''} key={step}><span className="invoice-skeleton-step-number">{index + 1}</span><span>{step}</span></li>)}</ol></nav>
    <div className="invoice-skeleton-products-heading" aria-hidden="true">Elige los productos para incluir en la factura</div>
    <div className="invoice-skeleton-product-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <article className="invoice-skeleton-product-card" key={index}>
      <i className="invoice-skeleton-product-image" />
      <div className="invoice-skeleton-product-content"><b className="invoice-skeleton-product-title" /><span className="invoice-skeleton-product-stock" />
        <div className="invoice-skeleton-product-meta"><span /><b /><span /><b /></div>
      </div>
    </article>)}</div>
    <div className="invoice-skeleton-actions" aria-hidden="true"><i /><i /></div>
  </section>
}
