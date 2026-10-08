import type { AcademicContentKind } from '../types/academicContent.types'
import './AcademicContentSkeleton.css'

interface Props { kind: AcademicContentKind; title: string }

export function AcademicContentSkeleton({ kind, title }: Props) {
  const honor = kind === 'honor'
  const periods = kind === 'period'
  const rows = periods ? 4 : 3
  return <section className={`page-content academic-content-page academic-content-skeleton is-${kind}`} role="status" aria-label={`Cargando ${title.toLocaleLowerCase('es-EC')}`} aria-busy="true">
    <span className="academic-skeleton-sr-only">Cargando contenido</span>
    <div className="academic-skeleton-heading"><div><i /><b /></div><span /></div>
    {periods && <div className="academic-skeleton-current"><i /><div><b /><span /></div></div>}
    <div className="academic-skeleton-list">
      <div className="academic-skeleton-list-heading"><div><i /><b /></div><span /></div>
      <div className="academic-skeleton-rows">{Array.from({ length: rows }, (_, index) => <div className="academic-skeleton-row" key={index}>
        <div className="academic-skeleton-copy"><div className="academic-skeleton-title"><b />{honor && <i className="academic-skeleton-count" />}</div><span /><i /></div>
        <div className="academic-skeleton-row-actions">{Array.from({ length: honor ? 3 : 2 }, (_, actionIndex) => <i key={actionIndex} />)}</div>
      </div>)}</div>
    </div>
  </section>
}
