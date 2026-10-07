import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, CirclePlus, Eye, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../shared/components/Button/Button'
import { Modal } from '../../../shared/components/Modal/Modal'
import { institutions } from '../mocks/academicContentMock'
import { useAcademicContent } from '../hooks/useAcademicContent'
import type { AcademicContentEntry, AcademicContentKind } from '../types/academicContent.types'
import './AcademicContentManager.css'

interface Props { kind: AcademicContentKind; title: string; singular: string }

const emptyEntry = (kind: AcademicContentKind, institutionId: string): AcademicContentEntry => ({
  id: crypto.randomUUID(), institutionId, kind, title: '', description: '', periodId: '', status: 'draft', date: '', location: '',
  studentName: '', grade: '', distinction: '', startDate: '', endDate: '', isCurrent: false, sourceName: '', sourceUrl: '', updatedAt: new Date().toISOString(),
})

const pageSize = 5

function dateLabel(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

export function AcademicContentManager({ kind, title, singular }: Props) {
  const { entries, save, remove } = useAcademicContent()
  const [institutionId, setInstitutionId] = useState(institutions[0].id)
  const [editing, setEditing] = useState<AcademicContentEntry | null>(null)
  const [notice, setNotice] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formStep, setFormStep] = useState<1 | 2>(1)
  const [page, setPage] = useState(1)
  const institutionEntries = entries.filter(entry => entry.institutionId === institutionId)
  const periods = institutionEntries.filter(entry => entry.kind === 'period').sort((a, b) => b.startDate.localeCompare(a.startDate))
  const currentPeriod = periods.find(period => period.isCurrent)
  const visibleEntries = useMemo(() => institutionEntries.filter(entry => entry.kind === kind)
    .sort((a, b) => (b.date || b.startDate || b.updatedAt).localeCompare(a.date || a.startDate || a.updatedAt)), [institutionEntries, kind])
  const pageCount = Math.max(1, Math.ceil(visibleEntries.length / pageSize))
  const pageEntries = visibleEntries.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1) }, [institutionId, kind])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const update = (field: keyof AcademicContentEntry, value: string | boolean) => {
    setEditing(current => current ? { ...current, [field]: value } : current)
    if (typeof value === 'string' && value.trim()) setFieldErrors(current => { const next = { ...current }; delete next[field]; return next })
  }
  const fieldError = (field: keyof AcademicContentEntry): ReactNode => fieldErrors[field] && <span className="academic-field-error" id={`academic-error-${field}`} role="alert">{fieldErrors[field]}</span>
  const fieldProps = (field: keyof AcademicContentEntry) => ({ 'aria-invalid': Boolean(fieldErrors[field]), 'aria-describedby': fieldErrors[field] ? `academic-error-${field}` : undefined })
  const beginCreate = () => { setNotice(''); setFieldErrors({}); setFormStep(1); setEditing(emptyEntry(kind, institutionId)) }
  const beginEdit = (entry: AcademicContentEntry) => { setNotice(''); setFieldErrors({}); setFormStep(1); setEditing({ ...entry }) }
  const validateFields = (requiredFields: (keyof AcademicContentEntry)[]) => {
    if (!editing) return false
    const nextErrors: Record<string, string> = Object.fromEntries(requiredFields
      .filter(field => typeof editing[field] !== 'string' || !String(editing[field]).trim())
      .map(field => [field, 'Completa este campo.']))
    if (kind === 'period' && editing.startDate && editing.endDate && editing.endDate < editing.startDate) nextErrors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio.'
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }
  const saveForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    const contentFields: (keyof AcademicContentEntry)[] = kind === 'news' ? ['title', 'description', 'date'] : ['title', 'description', 'date', 'location']
    if ((kind === 'news' || kind === 'event') && formStep === 1) {
      if (validateFields(contentFields)) setFormStep(2)
      return
    }
    const requiredFields: (keyof AcademicContentEntry)[] = kind === 'news' || kind === 'event' ? contentFields : kind === 'honor' ? ['studentName', 'grade', 'distinction'] : ['title', 'startDate', 'endDate']
    if (!validateFields(requiredFields)) return
    try {
      save(editing)
      setEditing(null)
      setNotice(`${singular} guardado.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el registro.')
    }
  }
  const deleteEntry = (entry: AcademicContentEntry) => {
    if (!window.confirm(`¿Eliminar ${entry.title || entry.studentName}?`)) return
    try { remove(entry.id); setNotice(`${singular} eliminado.`) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo eliminar el registro.') }
  }
  const previewRecognition = async (entry: AcademicContentEntry) => {
    const institutionName = institutions.find(institution => institution.id === entry.institutionId)?.name ?? title
    const periodName = periods.find(period => period.id === entry.periodId)?.title ?? ''
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    const previewWindow = window.open('about:blank', '_blank')
    if (!previewWindow) {
      setNotice('El navegador bloqueó la pestaña del reconocimiento. Permite ventanas emergentes e inténtalo de nuevo.')
      return
    }
    previewWindow.opener = null
    previewWindow.document.title = `Reconocimiento de ${entry.studentName}`
    try {
      const { createRecognitionPdf } = await import('../../honors/services/createRecognitionPdf')
      previewWindow.location.href = createRecognitionPdf(entry, institutionName, periodName, accent)
    } catch {
      previewWindow.close()
      setNotice('No se pudo generar el PDF del reconocimiento.')
    }
  }
  const renderPagination = (position: 'top' | 'bottom') => visibleEntries.length > pageSize && <nav className={`academic-pagination is-${position}`} aria-label={`Paginación de ${title}`}><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior"><ArrowLeft size={16} /></button><span>Página {page} de {pageCount}</span><button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Página siguiente"><ArrowRight size={16} /></button></nav>

  return <section className="page-content academic-content-page">
    <header className="academic-page-heading"><div><h1>{title}</h1><p>Administra el contenido de cada institución.</p></div>
      <label className="institution-picker">Institución<select value={institutionId} onChange={event => setInstitutionId(event.target.value)}>{institutions.map(institution => <option key={institution.id} value={institution.id}>{institution.name}</option>)}</select></label>
    </header>
    {notice && <p className="academic-notice" role="status">{notice}</p>}
    {kind === 'period' && <section className="current-period-card" aria-label="Período académico vigente">
      <div className="current-period-icon"><CalendarDays size={20} /></div><div><span>PERÍODO VIGENTE</span><strong>{currentPeriod?.title ?? 'No hay un período vigente'}</strong>{currentPeriod && <small>{dateLabel(currentPeriod.startDate)} – {dateLabel(currentPeriod.endDate)}</small>}</div>
    </section>}
    <section className="academic-list" aria-label={title}>
      <div className="academic-list-heading"><div><h2>{kind === 'period' ? 'Histórico de períodos' : `${title} de ${institutions.find(institution => institution.id === institutionId)?.name}`}</h2><span>{visibleEntries.length}</span></div><Button variant="primary" onClick={beginCreate}><CirclePlus size={18} />{`Nuevo ${singular.toLowerCase()}`}</Button></div>
      {renderPagination('top')}
      {visibleEntries.length === 0 ? <p className="academic-empty">No hay registros para esta institución.</p> : <div className="academic-entry-list">{pageEntries.map(entry => {
        const linkedPeriod = periods.find(period => period.id === entry.periodId)
        const mainText = kind === 'honor' ? entry.studentName : entry.title
        const subText = kind === 'honor' ? `${entry.distinction}${entry.grade ? ` · ${entry.grade}` : ''}` : entry.description
        return <article className="academic-entry" key={entry.id}>
          <div className="academic-entry-copy"><div className="academic-entry-title"><h3>{mainText}</h3>{kind === 'period' ? <span className={entry.isCurrent ? 'entry-status is-current' : 'entry-status'}>{entry.isCurrent ? 'Vigente' : 'Histórico'}</span> : <span className={`entry-status ${entry.status === 'published' ? 'is-published' : ''}`}>{entry.status === 'published' ? 'Publicado' : 'Borrador'}</span>}</div>
            {subText && <p>{subText}</p>}
            <small>{kind === 'period' ? `${dateLabel(entry.startDate)} – ${dateLabel(entry.endDate)}` : kind === 'event' ? `${dateLabel(entry.date)}${entry.location ? ` · ${entry.location}` : ''}` : kind === 'honor' ? linkedPeriod?.title ?? 'Sin período académico' : `${entry.date ? dateLabel(entry.date) : 'Sin fecha'} · ${linkedPeriod?.title ?? 'Sin período académico'}`}</small>
          </div>
          <div className="academic-entry-actions">{kind === 'honor' && <button type="button" className="academic-icon-button is-preview" onClick={() => previewRecognition(entry)} aria-label={`Ver reconocimiento de ${mainText}`} title="Ver reconocimiento"><Eye size={18} /></button>}<button type="button" className="academic-icon-button" onClick={() => beginEdit(entry)} aria-label={`Editar ${mainText}`}><Pencil size={17} /></button>{kind !== 'period' && <button type="button" className="academic-icon-button is-danger" onClick={() => deleteEntry(entry)} aria-label={`Eliminar ${mainText}`}><Trash2 size={17} /></button>}</div>
        </article>
      })}</div>}
      {renderPagination('bottom')}
    </section>
    <Modal open={editing !== null} title={`${editing && visibleEntries.some(entry => entry.id === editing.id) ? 'Editar' : 'Nuevo'} ${singular.toLowerCase()}`} onClose={() => setEditing(null)}>
      {editing && <form className="academic-form" noValidate onSubmit={saveForm}>
        {(kind === 'news' || kind === 'event') && <div className="academic-stepper" aria-label={`Paso ${formStep} de 2`}>
          <div className={formStep === 1 ? 'is-active' : 'is-complete'}><span>1</span><b>Contenido</b></div><i /><div className={formStep === 2 ? 'is-active' : ''}><span>2</span><b>Publicación</b></div>
        </div>}
        {kind === 'news' || kind === 'event' ? formStep === 1 ? <div className="academic-form-step">
            <h3>{kind === 'news' ? 'Redacta la noticia' : 'Detalles del evento'}</h3>
            <div className="academic-form-grid">
              <label>Título<input required maxLength={120} {...fieldProps('title')} value={editing.title} onChange={event => update('title', event.target.value)} />{fieldError('title')}</label>
              <label>{kind === 'news' ? 'Fecha de publicación' : 'Fecha'}<input required type="date" {...fieldProps('date')} value={editing.date} onChange={event => update('date', event.target.value)} />{fieldError('date')}</label>
            </div>
            <label>{kind === 'news' ? 'Noticia' : 'Descripción'}<textarea required rows={kind === 'news' ? 4 : 2} {...fieldProps('description')} value={editing.description} onChange={event => update('description', event.target.value)} />{fieldError('description')}</label>
            {kind === 'event' && <label>Lugar<input required {...fieldProps('location')} value={editing.location} onChange={event => update('location', event.target.value)} />{fieldError('location')}</label>}
          </div> : <div className="academic-form-step">
            <h3>Revisa y publica</h3>
            <div className="academic-publication-preview"><strong>{editing.title}</strong><p>{editing.description}</p><small>{editing.date ? dateLabel(editing.date) : ''}{kind === 'event' && editing.location ? ` · ${editing.location}` : ''}</small></div>
            <div className="academic-form-grid">
              <label>Período académico (opcional)<select value={editing.periodId} onChange={event => update('periodId', event.target.value)}><option value="">Sin período</option>{periods.map(period => <option key={period.id} value={period.id}>{period.title}{period.isCurrent ? ' · Vigente' : ''}</option>)}</select></label>
              <label>Estado<select value={editing.status} onChange={event => update('status', event.target.value)}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label>
            </div>
          </div>
        : kind === 'honor' ? <>
          <label>Estudiante<input required {...fieldProps('studentName')} value={editing.studentName} onChange={event => update('studentName', event.target.value)} />{fieldError('studentName')}</label>
          <label>Curso o grado<input required {...fieldProps('grade')} value={editing.grade} onChange={event => update('grade', event.target.value)} />{fieldError('grade')}</label>
          <label>Reconocimiento<input required {...fieldProps('distinction')} value={editing.distinction} onChange={event => update('distinction', event.target.value)} />{fieldError('distinction')}</label>
        </> : <>
          <label>Nombre del período<input required {...fieldProps('title')} value={editing.title} onChange={event => update('title', event.target.value)} placeholder="2026–2027" />{fieldError('title')}</label>
          <div className="academic-form-grid"><label>Fecha de inicio<input required type="date" {...fieldProps('startDate')} value={editing.startDate} onChange={event => update('startDate', event.target.value)} />{fieldError('startDate')}</label><label>Fecha de fin<input required type="date" min={editing.startDate} {...fieldProps('endDate')} value={editing.endDate} onChange={event => update('endDate', event.target.value)} />{fieldError('endDate')}</label></div>
          <label className="academic-checkbox"><input type="checkbox" checked={editing.isCurrent} onChange={event => update('isCurrent', event.target.checked)} /><span>Marcar como período vigente</span></label>
        </>}
        {kind === 'honor' && <><label>Período académico (opcional)<select value={editing.periodId} onChange={event => update('periodId', event.target.value)}><option value="">Sin período</option>{periods.map(period => <option key={period.id} value={period.id}>{period.title}{period.isCurrent ? ' · Vigente' : ''}</option>)}</select></label><label>Estado<select value={editing.status} onChange={event => update('status', event.target.value)}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label></>}
        <div className="academic-form-actions"><Button type="button" onClick={() => setEditing(null)}>Cancelar</Button>{(kind === 'news' || kind === 'event') && formStep === 2 && <Button type="button" onClick={() => setFormStep(1)}>Atrás</Button>}<Button variant="primary" type="submit">{(kind === 'news' || kind === 'event') && formStep === 1 ? <>Continuar<ArrowRight size={17} /></> : <><Check size={17} />Guardar</>}</Button></div>
      </form>}
    </Modal>
  </section>
}
