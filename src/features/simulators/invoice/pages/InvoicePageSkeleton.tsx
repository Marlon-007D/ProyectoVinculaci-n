import './InvoicePageSkeleton.css'

export function InvoicePageSkeleton() {
  return <section className="page-content invoice-page invoice-page-skeleton" role="status" aria-label="Cargando facturación electrónica" aria-busy="true">
    <span className="invoice-skeleton-sr-only">Cargando factura</span>
    <div className="workspace">
      <div className="invoice-skeleton-card">
        <div className="invoice-skeleton-heading"><i /><b /></div>
        <div className="invoice-skeleton-fields">{Array.from({ length: 4 }, (_, index) => <div key={index}><i /><b /></div>)}</div>
        <div className="invoice-skeleton-products"><i /><div className="invoice-skeleton-table"><b />{Array.from({ length: 3 }, (_, index) => <div key={index}><i /><i /><i /></div>)}</div></div>
        <div className="invoice-skeleton-actions"><i /><i /></div>
      </div>
      <div className="invoice-skeleton-summary"><i /><b />{Array.from({ length: 3 }, (_, index) => <div key={index}><i /><i /></div>)}</div>
    </div>
    <div className="invoice-skeleton-history"><i /><div>{Array.from({ length: 2 }, (_, index) => <b key={index} />)}</div></div>
  </section>
}
