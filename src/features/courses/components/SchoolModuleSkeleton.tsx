import './SchoolModuleSkeleton.css'

interface Props {
  courseCount: number
}

export function SchoolModuleSkeleton({ courseCount }: Props) {
  return <section className="page-content school-module-skeleton" aria-busy="true" aria-label="Cargando módulo">
    <span className="school-module-skeleton-sr-only">Cargando el módulo seleccionado</span>
    <header className="school-module-skeleton-header">
      <div className="school-module-skeleton-heading">
        <span className="school-skeleton-block school-skeleton-kicker" />
        <span className="school-skeleton-block school-skeleton-title" />
        <span className="school-skeleton-block school-skeleton-description" />
      </div>
      <span className="school-skeleton-block school-skeleton-count" />
    </header>
    <div className="school-module-skeleton-grid">
      {Array.from({ length: Math.max(1, courseCount) }, (_, index) => <article className="school-module-skeleton-card" key={index}>
        <div className="school-module-skeleton-card-head">
          <span className="school-skeleton-block school-skeleton-icon" />
          <span className="school-skeleton-block school-skeleton-topics" />
        </div>
        <span className="school-skeleton-block school-skeleton-course-title" />
        <span className="school-skeleton-block school-skeleton-course-description" />
        <span className="school-skeleton-block school-skeleton-course-description short" />
      </article>)}
    </div>
  </section>
}
