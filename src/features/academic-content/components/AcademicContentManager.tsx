import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Check, ChevronDown, CirclePlus, Clock3, Eye, GraduationCap, ImagePlus, Monitor, Pencil, Trash2, UsersRound } from 'lucide-react'
import { Button } from '../../../shared/components/Button/Button'
import { Modal } from '../../../shared/components/Modal/Modal'
import { useAcademicContent } from '../hooks/useAcademicContent'
import type { AcademicContentEntry, AcademicContentKind, AcademicPublicationStatus, HonorCategory } from '../types/academicContent.types'
import { tenantInstitution } from '../../../core/config/tenant'
import { getHonorCategory, OFFICIAL_DISTINCTIONS, sortOfficialDistinctions } from '../../honors/utils/honorRules'
import { getStudentAvatar, getStudentInitials } from '../../honors/utils/studentAvatar'
import { AcademicPostPreviewPage } from '../pages/AcademicPostPreviewPage'
import './AcademicContentManager.css'

interface Props { kind: AcademicContentKind; title: string; singular: string; onPreview?: (entry: AcademicContentEntry) => void }

const emptyEntry = (kind: AcademicContentKind, institutionId: string): AcademicContentEntry => ({
  id: crypto.randomUUID(), institutionId, kind, title: '', description: '', periodId: '', status: 'draft', date: kind === 'news' || kind === 'event' ? todayISO() : '', time: kind === 'event' ? '' : undefined, location: '',
  studentName: '', grade: '', distinction: '', honorCategory: kind === 'honor' ? 'institutional' : undefined, startDate: '', endDate: '', isCurrent: false, sourceName: '', sourceUrl: '', updatedAt: new Date().toISOString(),
  author: kind === 'news' || kind === 'event' ? 'Brigitte Rodríguez' : undefined,
})

const pageSize = 5
const defaultCover = 'https://futuresocsci.mcmaster.ca/app/uploads/2024/07/Thubnail-photo-2-1400x600.jpg'
const eventCover = 'https://socialsciences.careers.mcmaster.ca/app/uploads/2025/10/Untitled-design-27.png'

function dateLabel(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

function todayISO() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function AcademicContentManager({ kind, title, singular, onPreview }: Props) {
  const { entries, save, remove } = useAcademicContent()
  const [editing, setEditing] = useState<AcademicContentEntry | null>(null)
  const [notice, setNotice] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formStep, setFormStep] = useState<1 | 2>(1)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | AcademicPublicationStatus>('all')
  const [expandedHonorPeriod, setExpandedHonorPeriod] = useState<string | null>(null)
  const autoExpandedOfficialGroup = useRef(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const periods = entries.filter(entry => entry.kind === 'period').sort((a, b) => b.startDate.localeCompare(a.startDate))
  const currentPeriod = periods.find(period => period.isCurrent)
  const visibleEntries = useMemo(() => entries.filter(entry => entry.kind === kind)
    .sort((a, b) => (b.date || b.startDate || b.updatedAt).localeCompare(a.date || a.startDate || a.updatedAt)), [entries, kind])
  const filteredEntries = useMemo(() => kind !== 'news' && kind !== 'event' || statusFilter === 'all'
    ? visibleEntries
    : visibleEntries.filter(entry => entry.status === statusFilter), [kind, statusFilter, visibleEntries])
  const honorGroups = useMemo(() => {
    if (kind !== 'honor') return []
    const groups = new Map<string, AcademicContentEntry[]>()
    visibleEntries.forEach(entry => {
      const category = getHonorCategory(entry)
      const key = `${entry.periodId || 'no-period'}:${category}`
      groups.set(key, [...(groups.get(key) ?? []), entry])
    })
    const result = [...groups.entries()].map(([key, people]) => {
      const [periodId, category] = key.split(':')
      return {
      key,
      periodId,
      category: category as 'official' | 'institutional',
      people: category === 'official' ? sortOfficialDistinctions(people) : people,
      year: periods.find(period => period.id === periodId)?.title ?? 'Año sin período',
    }})
    if (currentPeriod && !groups.has(`${currentPeriod.id}:official`)) {
      result.push({ key: `${currentPeriod.id}:official`, periodId: currentPeriod.id, category: 'official', people: [], year: currentPeriod.title })
    }
    return result.sort((a, b) => b.year.localeCompare(a.year) || (a.category === 'official' ? -1 : 1))
  }, [kind, visibleEntries, periods, currentPeriod])
  const listCount = kind === 'honor' ? visibleEntries.length : filteredEntries.length
  const paginationCount = kind === 'honor' ? honorGroups.length : listCount
  const pageCount = Math.max(1, Math.ceil(paginationCount / pageSize))
  const pageEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize)
  const pageHonorGroups = honorGroups.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1) }, [kind, statusFilter])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])
  useEffect(() => {
    if (kind !== 'honor' || autoExpandedOfficialGroup.current) return
    const currentGroup = honorGroups.find(group => group.category === 'official' && group.periodId === currentPeriod?.id)
    if (currentGroup) {
      setExpandedHonorPeriod(currentGroup.key)
      autoExpandedOfficialGroup.current = true
    }
  }, [kind, honorGroups, currentPeriod])

  const update = (field: keyof AcademicContentEntry, value: string | boolean) => {
    setEditing(current => current ? { ...current, [field]: value } : current)
    if (typeof value === 'string' && value.trim()) setFieldErrors(current => { const next = { ...current }; delete next[field]; return next })
  }
  const fieldError = (field: keyof AcademicContentEntry): ReactNode => fieldErrors[field] && <span className="academic-field-error" id={`academic-error-${field}`} role="alert">{fieldErrors[field]}</span>
  const fieldProps = (field: keyof AcademicContentEntry) => ({ 'aria-invalid': Boolean(fieldErrors[field]), 'aria-describedby': fieldErrors[field] ? `academic-error-${field}` : undefined })
  const beginCreate = (officialDistinction?: typeof OFFICIAL_DISTINCTIONS[number], periodId = currentPeriod?.id ?? '') => {
    setNotice(''); setFieldErrors({}); setFormStep(1)
    const entry = emptyEntry(kind, tenantInstitution.id)
    setEditing(officialDistinction ? { ...entry, honorCategory: 'official', grade: 'Tercero de Bachillerato', distinction: officialDistinction, periodId } : entry)
  }
  const beginEdit = (entry: AcademicContentEntry) => { setNotice(''); setFieldErrors({}); setFormStep(1); setEditing({ ...entry, author: 'Brigitte Rodríguez' }) }
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
    const category = kind === 'honor' ? getHonorCategory(editing) : 'institutional'
    const requiredFields: (keyof AcademicContentEntry)[] = kind === 'news' || kind === 'event' ? contentFields : kind === 'honor' ? category === 'official' ? ['studentName', 'grade', 'distinction', 'periodId', 'schedule', 'modality'] : ['studentName', 'grade', 'distinction', 'periodId'] : ['title', 'startDate', 'endDate']
    if (!validateFields(requiredFields)) return
    try {
      save(kind === 'honor' ? { ...editing, honorCategory: category, officialOrder: category === 'official' ? OFFICIAL_DISTINCTIONS.indexOf(editing.distinction as typeof OFFICIAL_DISTINCTIONS[number]) + 1 : undefined } : editing)
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
    if (!entry || previewLoading) return
    setPreviewLoading(true)
    setNotice('')
    const previewWindow = window.open('about:blank', '_blank')
    if (!previewWindow) {
      setNotice('El navegador bloqueó la pestaña del cuadro de honor. Permite ventanas emergentes e inténtalo de nuevo.')
      setPreviewLoading(false)
      return
    }
    previewWindow.opener = null
    previewWindow.document.title = 'Cuadro de honor'
    previewWindow.document.body.textContent = 'Preparando el cuadro de honor…'
    const institutionName = tenantInstitution.name
    const periodName = periods.find(period => period.id === entry.periodId)?.title ?? ''
    const periodRecognitions = entries.filter(candidate => candidate.kind === 'honor' && candidate.periodId === entry.periodId)
    const recognitionEntries = [...sortOfficialDistinctions(periodRecognitions.filter(candidate => getHonorCategory(candidate) === 'official')), ...periodRecognitions.filter(candidate => getHonorCategory(candidate) === 'institutional')]
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    try {
      const { createRecognitionPdf } = await import('../../honors/services/createRecognitionPdf')
      const pdfUrl = await createRecognitionPdf(recognitionEntries, institutionName, periodName, accent)
      previewWindow.location.replace(pdfUrl)
    } catch {
      previewWindow.close()
      setNotice('No se pudo generar el PDF del reconocimiento.')
    } finally {
      setPreviewLoading(false)
    }
  }
  const renderPagination = (position: 'top' | 'bottom') => pageCount > 1 && <nav className={`academic-pagination is-${position}`} aria-label={`Paginación de ${title}`}><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior"><ArrowLeft size={16} /></button><span>Página {page} de {pageCount}</span><button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Página siguiente"><ArrowRight size={16} /></button></nav>

  const saveEditedPublication = (entry: AcademicContentEntry) => {
    try {
      save({ ...entry, date: editing?.date || todayISO(), author: 'Brigitte Rodríguez' })
      setEditing(null)
      setNotice(`${singular} guardado.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar la publicación.')
    }
  }

  if (editing && (kind === 'news' || kind === 'event')) return <AcademicPostPreviewPage
    entry={editing}
    mode="edit"
    isNew={!visibleEntries.some(entry => entry.id === editing.id)}
    periods={periods.map(period => ({ id: period.id, title: period.title }))}
    onChange={setEditing}
    onSave={saveEditedPublication}
    onCancel={() => setEditing(null)}
  />

  return <section className="page-content academic-content-page">
    {kind !== 'honor' ? <header className="academic-page-heading"><div><h1>{title}</h1></div>
    </header> : <header className="academic-page-heading honor-page-heading"><div><p className="honor-page-kicker">Reconocemos el esfuerzo y los logros de nuestros estudiantes</p><h1>{title}</h1><p>Administra las distinciones oficiales y los reconocimientos institucionales por período.</p></div><Button variant="primary" onClick={() => beginCreate()}><CirclePlus size={18} />Nuevo reconocimiento</Button>
    </header>}
    {notice && <p className="academic-notice" role="status">{notice}</p>}
    {kind === 'period' && <section className="current-period-card" aria-label="Período académico vigente">
      <div className="current-period-icon"><CalendarDays size={20} /></div><div><span>PERÍODO VIGENTE</span><strong>{currentPeriod?.title ?? 'No hay un período vigente'}</strong>{currentPeriod && <small>{dateLabel(currentPeriod.startDate)} – {dateLabel(currentPeriod.endDate)}</small>}</div>
    </section>}
    <section className={kind === 'honor' ? 'is-honor-list' : `academic-list ${kind === 'news' || kind === 'event' ? 'is-publication-list' : ''}`} aria-label={title}>
      {kind === 'period' && <div className="academic-list-heading"><div><h2>Histórico de períodos</h2><span aria-label={`${listCount} ${singular.toLowerCase()}`}>{listCount}</span></div><Button variant="primary" onClick={() => beginCreate()}><CirclePlus size={18} />{`Nuevo ${singular.toLowerCase()}`}</Button></div>}
      {(kind === 'news' || kind === 'event') && <div className="publication-toolbar"><div className="publication-filters" role="group" aria-label="Filtrar publicaciones por estado">
        {([
          { value: 'all', label: 'Todas', count: visibleEntries.length },
          { value: 'published', label: 'Publicadas', count: visibleEntries.filter(entry => entry.status === 'published').length },
          { value: 'draft', label: 'Borradores', count: visibleEntries.filter(entry => entry.status === 'draft').length },
        ] as const).map(option => <button key={option.value} type="button" className={statusFilter === option.value ? 'is-active' : ''} aria-pressed={statusFilter === option.value} onClick={() => setStatusFilter(option.value)}>{option.label}<span>{option.count}</span></button>)}
      </div><Button variant="primary" onClick={() => beginCreate()}><CirclePlus size={18} />{kind === 'news' ? 'Nueva noticia' : 'Nuevo evento'}</Button></div>}
      {renderPagination('top')}
      {listCount === 0 && kind !== 'honor' ? <p className="academic-empty">No hay registros para esta institución.</p> : kind === 'honor' ? <div className="academic-entry-list honor-period-list">{pageHonorGroups.map(group => {
        const groupKey = group.key
        const expanded = expandedHonorPeriod === groupKey
        return <article className="academic-honor-group" key={groupKey}>
          <div className="academic-entry honor-period-entry">
            <div className="academic-entry-copy"><div className="academic-entry-title"><h3>{group.category === 'official' ? 'Distinciones oficiales' : 'Reconocimientos institucionales'}</h3><span className="honor-people-count"><UsersRound size={14} />{group.people.length} {group.people.length === 1 ? 'estudiante' : 'estudiantes'}</span></div><small className="honor-period-year"><CalendarDays size={15} aria-hidden="true" />{group.year}</small></div>
            <div className="academic-entry-actions">{group.people.length > 0 && <button type="button" className="academic-icon-button is-preview" onClick={() => previewRecognition(group.people[0])} disabled={previewLoading} aria-label={`Ver cuadro de honor ${group.year} en PDF`} title={previewLoading ? 'Generando PDF…' : 'Ver cuadro de honor'}><Eye size={18} /></button>}<button type="button" className="academic-icon-button honor-expand-button" onClick={() => setExpandedHonorPeriod(expanded ? null : groupKey)} aria-expanded={expanded} aria-label={expanded ? 'Ocultar personas' : 'Ver personas'} title={expanded ? 'Ocultar personas' : 'Ver personas'}><ChevronDown size={18} /></button></div>
          </div>
          {expanded && (group.category === 'official' ? <div className="honor-official-slots" aria-label={`Puestos oficiales ${group.year}`}>{OFFICIAL_DISTINCTIONS.map((distinction, index) => {
            const person = group.people.find(entry => entry.distinction === distinction)
            return <article className={`honor-official-slot${person ? ' is-assigned' : ''}`} key={distinction}>
              <div className="honor-profile-header">
                {person ? getStudentAvatar(person.studentName) ? <img className="honor-student-avatar" src={getStudentAvatar(person.studentName)} alt={`Fotografía de ${person.studentName}`} loading="lazy" /> : <span className="honor-student-initials" aria-hidden="true">{getStudentInitials(person.studentName)}</span> : <span className="honor-slot-number">{index + 1}</span>}
                <div className="honor-slot-copy">
                  {person ? <>
                    <div className="honor-slot-title-row"><strong className="honor-slot-student-name">{person.studentName}</strong><div className="honor-slot-actions"><button type="button" className="honor-card-action" onClick={() => beginEdit(person)} aria-label={`Editar ${person.studentName}`} title="Editar"><Pencil size={16} /></button><button type="button" className="honor-card-action is-danger" onClick={() => deleteEntry(person)} aria-label={`Eliminar ${person.studentName}`} title="Eliminar"><Trash2 size={16} /></button></div></div>
                    <span className="honor-slot-distinction">{distinction}</span>
                  </> : <><strong>{distinction}</strong><span className="honor-slot-empty">Sin asignar</span></>}
                </div>
              </div>
              {person && <div className="honor-slot-meta">
                {person.grade && <span><GraduationCap size={14} aria-hidden="true" />{person.grade}</span>}
                {person.schedule && <span><Clock3 size={14} aria-hidden="true" />{person.schedule}</span>}
                {person.campus && <span><Building2 size={14} aria-hidden="true" />{person.campus}</span>}
                {person.modality && <span><Monitor size={14} aria-hidden="true" />{person.modality}</span>}
              </div>}
              {!person && <Button type="button" onClick={() => beginCreate(distinction, group.periodId)}><CirclePlus size={16} />Asignar</Button>}
            </article>
          })}</div> : <div className="honor-people-list" aria-label={`Reconocimientos institucionales ${group.year}`}>{group.people.map(person => <article className="academic-entry honor-person-entry" key={person.id}>{getStudentAvatar(person.studentName) ? <img className="honor-student-avatar" src={getStudentAvatar(person.studentName)} alt={`Fotografía de ${person.studentName}`} loading="lazy" /> : <span className="honor-student-initials" aria-hidden="true">{getStudentInitials(person.studentName)}</span>}<div className="academic-entry-copy"><h3>{person.studentName}</h3><p>{person.distinction} · {person.grade}</p></div><div className="honor-person-controls"><div className="academic-entry-actions"><button type="button" className="academic-icon-button" onClick={() => beginEdit(person)} aria-label={`Editar ${person.studentName}`}><Pencil size={17} /></button><button type="button" className="academic-icon-button is-danger" onClick={() => deleteEntry(person)} aria-label={`Eliminar ${person.studentName}`}><Trash2 size={17} /></button></div><span className={`entry-status ${person.status === 'published' ? 'is-published' : ''}`}>{person.status === 'published' ? 'Publicado' : 'Borrador'}</span></div></article>)}</div>)}
        </article>
      })}</div> : <div className="academic-entry-list">{pageEntries.map(entry => {
        const linkedPeriod = periods.find(period => period.id === entry.periodId)
        const mainText = entry.title
        const subText = entry.description
        return (kind === 'news' || kind === 'event') ? <article className="publication-post" key={entry.id}>
          <img className="publication-post-image" src={entry.imageUrl || (kind === 'event' ? eventCover : defaultCover)} alt="" loading="lazy" />
          <div className="publication-post-body"><div className="academic-entry-title"><h3>{mainText}</h3><span className={`entry-status ${entry.status === 'published' ? 'is-published' : ''}`}>{entry.status === 'published' ? 'Publicado' : 'Borrador'}</span></div><p>{subText}</p><small>{dateLabel(entry.date)}{kind === 'event' && entry.location ? ` · ${entry.location}` : ''}</small><div className="academic-entry-actions"><button type="button" className="academic-icon-button is-preview" onClick={() => onPreview?.(entry)} aria-label={`Ver vista previa de ${mainText}`} title="Vista previa"><Eye size={18} /></button><button type="button" className="academic-icon-button" onClick={() => beginEdit(entry)} aria-label={`Editar ${mainText}`} title="Editar"><Pencil size={17} /></button><button type="button" className="academic-icon-button is-danger" onClick={() => deleteEntry(entry)} aria-label={`Eliminar ${mainText}`} title="Eliminar"><Trash2 size={17} /></button></div></div>
        </article> : <article className="academic-entry" key={entry.id}>
          <div className="academic-entry-copy"><div className="academic-entry-title"><h3>{mainText}</h3>{kind === 'period' ? <span className={entry.isCurrent ? 'entry-status is-current' : 'entry-status'}>{entry.isCurrent ? 'Vigente' : 'Histórico'}</span> : <span className={`entry-status ${entry.status === 'published' ? 'is-published' : ''}`}>{entry.status === 'published' ? 'Publicado' : 'Borrador'}</span>}</div>
            {subText && <p>{subText}</p>}
            <small>{kind === 'period' ? `${dateLabel(entry.startDate)} – ${dateLabel(entry.endDate)}` : kind === 'event' ? `${dateLabel(entry.date)}${entry.location ? ` · ${entry.location}` : ''}` : `${entry.date ? dateLabel(entry.date) : 'Sin fecha'} · ${linkedPeriod?.title ?? 'Sin período académico'}`}</small>
          </div>
          <div className="academic-entry-actions"><button type="button" className="academic-icon-button" onClick={() => beginEdit(entry)} aria-label={`Editar ${mainText}`}><Pencil size={17} /></button>{kind !== 'period' && <button type="button" className="academic-icon-button is-danger" onClick={() => deleteEntry(entry)} aria-label={`Eliminar ${mainText}`}><Trash2 size={17} /></button>}</div>
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
            <label>{kind === 'news' ? 'Redacción completa' : 'Descripción del evento'}<textarea required rows={kind === 'news' ? 8 : 5} {...fieldProps('description')} value={editing.description} onChange={event => update('description', event.target.value)} placeholder="Escribe la publicación. Puedes separar los párrafos con una línea en blanco." />{fieldError('description')}</label>
            <label>Autor<input maxLength={100} value={editing.author ?? ''} onChange={event => update('author', event.target.value)} placeholder="Equipo editorial" /></label>
            <label>Foto de portada<input type="url" placeholder="https://…" value={editing.imageUrl ?? ''} onChange={event => update('imageUrl', event.target.value)} /><small className="academic-help-text">Puedes pegar un enlace de imagen. Si lo dejas vacío, se usará una foto de estudiantes.</small></label>
            <div className="cover-choice"><span>Foto sugerida</span><button type="button" onClick={() => update('imageUrl', defaultCover)}><ImagePlus size={16} /> Usar foto de estudiantes</button></div>
            {kind === 'event' && <label>Lugar<input required {...fieldProps('location')} value={editing.location} onChange={event => update('location', event.target.value)} />{fieldError('location')}</label>}
          </div> : <div className="academic-form-step">
            <h3>Revisa y publica</h3>
            <article className="publication-preview-card"><img src={editing.imageUrl || (kind === 'event' ? eventCover : defaultCover)} alt="Vista previa de portada" /><div><small>{kind === 'news' ? 'NOTICIA' : 'EVENTO'} · {editing.date ? dateLabel(editing.date) : 'Fecha'}</small><strong>{editing.title || 'Título de la publicación'}</strong><p>{editing.description || 'Aquí aparecerá el texto de la publicación.'}</p>{kind === 'event' && editing.location && <small>{editing.location}</small>}</div></article>
            <div className="academic-form-grid">
              <label>Año lectivo<select required {...fieldProps('periodId')} value={editing.periodId} onChange={event => update('periodId', event.target.value)}><option value="">Selecciona un año</option>{periods.map(period => <option key={period.id} value={period.id}>{period.title}{period.isCurrent ? ' · Vigente' : ''}</option>)}</select>{fieldError('periodId')}</label>
            </div>
            <fieldset className="publication-status"><legend>Estado de la publicación</legend><label className={editing.status === 'draft' ? 'is-selected' : ''}><input type="radio" name="publication-status" value="draft" checked={editing.status === 'draft'} onChange={() => update('status', 'draft')} /><span><b>Guardar como borrador</b><small>Solo visible en administración</small></span></label><label className={editing.status === 'published' ? 'is-selected' : ''}><input type="radio" name="publication-status" value="published" checked={editing.status === 'published'} onChange={() => update('status', 'published')} /><span><b>Publicar</b><small>Visible en la página institucional</small></span></label></fieldset>
          </div>
        : kind === 'honor' ? <>
          <label>Categoría<select value={getHonorCategory(editing)} onChange={event => { const category = event.target.value as HonorCategory; setEditing(current => current ? { ...current, honorCategory: category, grade: category === 'official' ? 'Tercero de Bachillerato' : current.grade === 'Tercero de Bachillerato' ? '' : current.grade, distinction: category === 'official' ? '' : current.distinction, officialOrder: undefined } : current); setFieldErrors({}) }}><option value="institutional">Reconocimiento institucional</option><option value="official">Distinción oficial</option></select></label>
          <label>Estudiante<input required {...fieldProps('studentName')} value={editing.studentName} onChange={event => update('studentName', event.target.value)} placeholder="Nombres y apellidos" />{fieldError('studentName')}</label>
          {getHonorCategory(editing) === 'official' ? <label>Nivel educativo<select required value={editing.grade} onChange={event => update('grade', event.target.value)}><option value="">Selecciona el nivel</option><option value="Tercero de Bachillerato">Tercero de Bachillerato</option></select>{fieldError('grade')}<small className="academic-help-text">El artículo 191 establece estas distinciones para estudiantes de tercer curso de Bachillerato.</small></label> : <label>Nivel educativo<input required {...fieldProps('grade')} value={editing.grade} onChange={event => update('grade', event.target.value)} placeholder="Ej. Noveno de EGB" />{fieldError('grade')}</label>}
          {getHonorCategory(editing) === 'official' ? <>
            <label>Distinción<select required {...fieldProps('distinction')} value={editing.distinction} onChange={event => update('distinction', event.target.value)}><option value="">Selecciona según la jerarquía</option>{OFFICIAL_DISTINCTIONS.map((distinction, index) => <option key={distinction} value={distinction}>{index + 1}. {distinction}</option>)}</select>{fieldError('distinction')}</label>
            <div className="academic-form-grid"><label>Jornada<select required {...fieldProps('schedule')} value={editing.schedule ?? ''} onChange={event => update('schedule', event.target.value)}><option value="">Selecciona una jornada</option><option>Matutina</option><option>Vespertina</option><option>Nocturna</option></select>{fieldError('schedule')}</label><label>Modalidad<select required {...fieldProps('modality')} value={editing.modality ?? ''} onChange={event => update('modality', event.target.value)}><option value="">Selecciona una modalidad</option><option>Presencial</option><option>Semipresencial</option><option>A distancia</option></select>{fieldError('modality')}</label></div>
            <label>Sede (si corresponde)<input value={editing.campus ?? ''} onChange={event => update('campus', event.target.value)} placeholder="Sede institucional" /></label>
          </> : <label>Reconocimiento<input required {...fieldProps('distinction')} value={editing.distinction} onChange={event => update('distinction', event.target.value)} placeholder="Ej. Mérito científico" />{fieldError('distinction')}</label>}
          <label>Período lectivo<select required {...fieldProps('periodId')} value={editing.periodId} onChange={event => update('periodId', event.target.value)}><option value="">Selecciona un período</option>{periods.map(period => <option key={period.id} value={period.id}>{period.title}{period.isCurrent ? ' · Vigente' : ''}</option>)}</select>{fieldError('periodId')}</label>
        </> : <>
          <label>Nombre del período<input required {...fieldProps('title')} value={editing.title} onChange={event => update('title', event.target.value)} placeholder="2026–2027" />{fieldError('title')}</label>
          <div className="academic-form-grid"><label>Fecha de inicio<input required type="date" {...fieldProps('startDate')} value={editing.startDate} onChange={event => update('startDate', event.target.value)} />{fieldError('startDate')}</label><label>Fecha de fin<input required type="date" min={editing.startDate} {...fieldProps('endDate')} value={editing.endDate} onChange={event => update('endDate', event.target.value)} />{fieldError('endDate')}</label></div>
          <label className="academic-checkbox"><input type="checkbox" checked={editing.isCurrent} onChange={event => update('isCurrent', event.target.checked)} /><span>Marcar como período vigente</span></label>
        </>}
        {kind === 'honor' && <><label>Estado<select value={editing.status} onChange={event => update('status', event.target.value)}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label></>}
        <div className="academic-form-actions"><Button type="button" onClick={() => setEditing(null)}>Cancelar</Button>{(kind === 'news' || kind === 'event') && formStep === 2 && <Button type="button" onClick={() => setFormStep(1)}>Atrás</Button>}<Button variant="primary" type="submit">{(kind === 'news' || kind === 'event') && formStep === 1 ? <>Continuar<ArrowRight size={17} /></> : <><Check size={17} />Guardar</>}</Button></div>
      </form>}
    </Modal>
  </section>
}
