import './InterestPageSkeleton.css'

export function InterestPageSkeleton() {
  return <section className="page-content interest-page interest-page-skeleton" role="status" aria-label="Cargando simulador de interés financiero" aria-busy="true">
    <span className="interest-skeleton-sr-only">Cargando simulador de interés</span>
    <div className="simulator-grid">
      <div className="interest-skeleton-form"><div className="interest-skeleton-heading"><i /><b /></div><div className="interest-skeleton-tabs"><i /><i /></div><div className="interest-skeleton-fields">{Array.from({ length: 3 }, (_, index) => <div key={index}><i /><b /></div>)}</div><div className="interest-skeleton-formula" /></div>
      <div className="interest-skeleton-result"><i /><b /><strong /><span /><div /><div /><em /></div>
    </div>
  </section>
}
