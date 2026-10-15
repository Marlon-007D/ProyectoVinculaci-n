import './ConverterPageSkeleton.css'

export function ConverterPageSkeleton() {
  return <section className="page-content converter-page converter-page-skeleton" role="status" aria-label="Cargando conversor de unidades y monedas" aria-busy="true">
    <span className="converter-skeleton-sr-only">Cargando conversor</span>
    <div className="simulator-grid">
      <div className="converter-skeleton-form"><div className="converter-skeleton-heading"><i /><b /></div><div className="converter-skeleton-tabs"><i /><i /></div><div className="converter-skeleton-fields"><div><i /><b /></div><i /><div><i /><b /></div></div><div className="converter-skeleton-note" /></div>
      <div className="converter-skeleton-result"><i /><b /><strong /><span /><div /><div /></div>
    </div>
  </section>
}
