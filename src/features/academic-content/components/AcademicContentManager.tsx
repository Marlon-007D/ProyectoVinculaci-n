import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Award, CalendarDays, Check, CirclePlus, Clock3, Eye, GraduationCap, ImagePlus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../../shared/components/Button/Button'
import { Modal } from '../../../shared/components/Modal/Modal'
import { useAcademicContent } from '../hooks/useAcademicContent'
import { AcademicContentSkeleton } from './AcademicContentSkeleton'
import type { AcademicContentEntry, AcademicContentKind, AcademicPublicationStatus, HonorCategory } from '../types/academicContent.types'
import { tenantInstitution } from '../../../core/config/tenant'
import { supabase } from '../../../core/supabaseClient'
import { useTenant } from '../../../core/TenantContext'
import { getHonorCategory, getOfficialFlagKind, normalizeOfficialDistinction, OFFICIAL_DISTINCTIONS } from '../../honors/utils/honorRules'
import { getStudentAvatar, getStudentInitials } from '../../honors/utils/studentAvatar'
import { OfficialFlag } from '../../honors/components/OfficialFlag'
import { notify } from '../../../shared/components/Toaster/notify'
import { EmptyState } from '../../../shared/components/EmptyState/EmptyState'
import { buildHonorGroups, HONOR_EMPTY_MESSAGE } from '../utils/honorGroups'
import { AcademicPostPreviewPage } from '../pages/AcademicPostPreviewPage'
import { createAcademicContentImageUploader } from '../services/academicContentImageService'
import { createAcademicPeriodRepository, type AcademicPeriodOption } from '../services/academicPeriodRepository'
import styles from './NewsPublicationList.module.css'
import './AcademicContentManager.css'

interface Props { kind: AcademicContentKind; title: string; singular: string; onPreview?: (entry: AcademicContentEntry) => void }

const emptyEntry = (kind: AcademicContentKind, institutionId: string): AcademicContentEntry => ({
  id: crypto.randomUUID(), institutionId, kind, title: '', description: '', periodId: '', status: kind === 'honor' ? 'published' : 'draft', date: kind === 'news' || kind === 'event' ? todayISO() : '', time: kind === 'event' ? '' : undefined, location: '',
  studentName: '', grade: '', distinction: '', honorCategory: kind === 'honor' ? 'institutional' : undefined, startDate: '', endDate: '', isCurrent: false, sourceName: '', sourceUrl: '', updatedAt: new Date().toISOString(),
  author: kind === 'news' || kind === 'event' ? 'Brigitte Rodríguez' : undefined,
})

const pageSize = 5
const OFFICIAL_DISPLAY_DISTINCTIONS = [OFFICIAL_DISTINCTIONS[3], OFFICIAL_DISTINCTIONS[0], OFFICIAL_DISTINCTIONS[4], OFFICIAL_DISTINCTIONS[1], OFFICIAL_DISTINCTIONS[2], ...OFFICIAL_DISTINCTIONS.slice(5)]
const defaultCover = 'https://futuresocsci.mcmaster.ca/app/uploads/2024/07/Thubnail-photo-2-1400x600.jpg'
const eventCover = 'https://socialsciences.careers.mcmaster.ca/app/uploads/2025/10/Untitled-design-27.png'
const publicationImageUploader = createAcademicContentImageUploader(supabase)
const academicPeriodRepository = createAcademicPeriodRepository(supabase)

function dateLabel(value: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

function gradeLabel(value: string) {
  if (/^tercero de bachillerato$/i.test(value.trim())) return '3ro BGU'
  const ordinals: Record<string, number> = { primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5, sexto: 6, séptimo: 7, septimo: 7, octavo: 8, noveno: 9, décimo: 10, decimo: 10 }
  return value.replace(/^(primero|segundo|tercero|cuarto|quinto|sexto|séptimo|septimo|octavo|noveno|décimo|decimo)\b/i, ordinal => `${ordinals[ordinal.toLocaleLowerCase('es-EC')]}.º`)
}

function isThirdBachillerato(value: string) {
  const normalized = value.trim().toLocaleLowerCase('es-EC').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalized.includes('tercero de bachillerato')
    || /^tercero\s+(?:de\s+)?bgu$/.test(normalized)
    || /^3(?:ro|ero|er|º)?\s*(?:bgu|bachillerato)$/.test(normalized)
}

function todayISO() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

export function AcademicContentManager({ kind, title, singular, onPreview }: Props) {
  const { activeInstitution } = useTenant()
  const institutionId = activeInstitution?.institution_id ?? (kind === 'honor' ? null : tenantInstitution.id)
  const { entries, students, loading, error, reload, save, remove } = useAcademicContent(kind, institutionId)
  const [editing, setEditing] = useState<AcademicContentEntry | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formStep, setFormStep] = useState<1 | 2>(1)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | AcademicPublicationStatus>('all')
  const [publicationSearch, setPublicationSearch] = useState('')
  const [publicationSearchOpen, setPublicationSearchOpen] = useState(false)
  const [publicationDate, setPublicationDate] = useState('')
  const [expandedHonorPeriod, setExpandedHonorPeriod] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [publicationPeriods, setPublicationPeriods] = useState<AcademicPeriodOption[]>([])
  const autoExpandedOfficialGroup = useRef(false)
  const periods = entries.filter(entry => entry.kind === 'period').sort((a, b) => b.startDate.localeCompare(a.startDate))
  const currentPeriod = periods.find(period => period.isCurrent)
  const defaultPublicationPeriodId = publicationPeriods.find(period => period.isCurrent)?.id ?? publicationPeriods[0]?.id ?? ''
  const visibleEntries = useMemo(() => entries.filter(entry => entry.kind === kind)
    .sort((a, b) => (b.date || b.startDate || b.updatedAt).localeCompare(a.date || a.startDate || a.updatedAt)), [entries, kind])
  const filteredEntries = useMemo(() => {
    const query = publicationSearch.trim().toLocaleLowerCase('es-EC')
    return visibleEntries.filter(entry => {
      const matchesStatus = (kind !== 'news' && kind !== 'event') || statusFilter === 'all' || entry.status === statusFilter
      const matchesSearch = !query || `${entry.title} ${entry.description}`.toLocaleLowerCase('es-EC').includes(query)
      const matchesDate = !publicationDate || entry.date === publicationDate
      return matchesStatus && matchesSearch && matchesDate
    })
  }, [kind, publicationDate, publicationSearch, statusFilter, visibleEntries])
  const honorGroups = useMemo(() => kind === 'honor' ? buildHonorGroups(visibleEntries, periods, currentPeriod) : [], [kind, visibleEntries, periods, currentPeriod])
  const listCount = kind === 'honor' ? visibleEntries.length : filteredEntries.length
  const isPublication = kind === 'news' || kind === 'event'
  const paginationCount = kind === 'honor' ? honorGroups.length : listCount
  const pageCount = Math.max(1, Math.ceil(paginationCount / pageSize))
  const pageEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize)
  const pageHonorGroups = honorGroups.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1) }, [kind, publicationDate, publicationSearch, statusFilter])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])
  useEffect(() => {
    if (kind !== 'honor' || autoExpandedOfficialGroup.current) return
    const currentGroup = honorGroups.find(group => group.category === 'official' && group.periodId === currentPeriod?.id)
    if (currentGroup) {
      setExpandedHonorPeriod(currentGroup.key)
      autoExpandedOfficialGroup.current = true
    }
  }, [kind, honorGroups, currentPeriod])
  useEffect(() => {
    if ((kind !== 'news' && kind !== 'event') || !institutionId) {
      setPublicationPeriods([])
      return
    }

    let isCurrent = true
    void academicPeriodRepository.list(institutionId)
      .then(periodOptions => { if (isCurrent) setPublicationPeriods(periodOptions) })
      .catch(() => { if (isCurrent) setPublicationPeriods([]) })

    return () => { isCurrent = false }
  }, [institutionId, kind])
  useEffect(() => {
    if (!editing || (kind !== 'news' && kind !== 'event') || editing.periodId || !defaultPublicationPeriodId) return
    setEditing(current => current && !current.periodId ? { ...current, periodId: defaultPublicationPeriodId } : current)
  }, [defaultPublicationPeriodId, editing, kind])

  if (loading) return <AcademicContentSkeleton kind={kind} title={title} />
  if (kind === 'honor' && error) return <section className="page-content academic-content-page is-honor-page"><p className="academic-notice" role="alert">{error}</p><Button variant="primary" onClick={reload}>Reintentar</Button></section>
  if ((kind === 'news' || kind === 'event') && error) return <section className="page-content academic-content-page">{!isPublication && <header className="academic-page-heading"><div><h1>{title}</h1></div></header>}<p className="academic-notice" role="alert">{error}</p><Button variant="primary" onClick={reload}>Reintentar</Button></section>

  const update = (field: keyof AcademicContentEntry, value: string | boolean) => {
    setEditing(current => current ? { ...current, [field]: value } : current)
    if (typeof value === 'string' && value.trim()) setFieldErrors(current => { const next = { ...current }; delete next[field]; return next })
  }
  const fieldError = (field: keyof AcademicContentEntry): ReactNode => fieldErrors[field] && <span className="academic-field-error" id={`academic-error-${field}`} role="alert">{fieldErrors[field]}</span>
  const fieldProps = (field: keyof AcademicContentEntry) => ({ 'aria-invalid': Boolean(fieldErrors[field]), 'aria-describedby': fieldErrors[field] ? `academic-error-${field}` : undefined })
  const beginCreate = (officialDistinction?: typeof OFFICIAL_DISTINCTIONS[number], periodId = currentPeriod?.id ?? '') => {
    setFieldErrors({}); setFormStep(1)
    const entry = emptyEntry(kind, institutionId ?? tenantInstitution.id)
    const publicationEntry = kind === 'news' || kind === 'event'
      ? { ...entry, periodId: defaultPublicationPeriodId }
      : entry
    setEditing(officialDistinction ? { ...entry, honorCategory: 'official', grade: 'Tercero de Bachillerato', distinction: officialDistinction, periodId } : publicationEntry)
  }
  const beginEdit = (entry: AcademicContentEntry) => { setFieldErrors({}); setFormStep(1); setEditing({ ...entry, author: 'Brigitte Rodríguez', distinction: kind === 'honor' && getHonorCategory(entry) === 'official' ? normalizeOfficialDistinction(entry.distinction) : entry.distinction }) }
  const validateFields = (requiredFields: (keyof AcademicContentEntry)[]) => {
    if (!editing) return false
    const nextErrors: Record<string, string> = Object.fromEntries(requiredFields
      .filter(field => typeof editing[field] !== 'string' || !String(editing[field]).trim())
      .map(field => [field, 'Completa este campo.']))
    if (kind === 'period' && editing.startDate && editing.endDate && editing.endDate < editing.startDate) nextErrors.endDate = 'La fecha de fin debe ser posterior a la fecha de inicio.'
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }
  const saveForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    const contentFields: (keyof AcademicContentEntry)[] = kind === 'news' ? ['title', 'description', 'date'] : ['title', 'description', 'date', 'location']
    if ((kind === 'news' || kind === 'event') && formStep === 1) {
      if (validateFields(contentFields)) setFormStep(2)
      return
    }
    const category = kind === 'honor' ? getHonorCategory(editing) : 'institutional'
    const requiredFields: (keyof AcademicContentEntry)[] = kind === 'news' || kind === 'event' ? contentFields : kind === 'honor' ? category === 'official' ? ['studentId', 'distinction', 'periodId', 'schedule', 'modality'] : ['studentId', 'grade', 'distinction', 'periodId'] : ['title', 'startDate', 'endDate']
    if (!validateFields(requiredFields)) return
    try {
      setSaving(true)
      await save(kind === 'honor' ? { ...editing, status: 'published', distinction: category === 'official' ? normalizeOfficialDistinction(editing.distinction) : editing.distinction, honorCategory: category, officialOrder: category === 'official' ? OFFICIAL_DISTINCTIONS.indexOf(normalizeOfficialDistinction(editing.distinction) as typeof OFFICIAL_DISTINCTIONS[number]) + 1 : undefined } : editing)
      setEditing(null)
      notify.success(`${singular} guardado`, { id: 'academic-content-save', description: 'Los cambios ya están registrados.' })
    } catch (error) {
      notify.error('No se pudo guardar el registro', { id: 'academic-content-save', description: errorMessage(error, 'Intenta nuevamente.') })
    } finally {
      setSaving(false)
    }
  }
  const deleteEntry = async (entry: AcademicContentEntry) => {
    if (!window.confirm(`¿Eliminar ${entry.title || entry.studentName}?`)) return
    try { await remove(entry.id); notify.success(`${singular} eliminado`, { id: 'academic-content-delete' }) }
    catch (error) { notify.error('No se pudo eliminar el registro', { id: 'academic-content-delete', description: errorMessage(error, 'Intenta nuevamente.') }) }
  }
  const renderPagination = (position: 'top' | 'bottom') => pageCount > 1 && <nav className={isPublication ? `${styles.publicationPagination} ${position === 'top' ? styles.paginationTop : styles.paginationBottom}` : `academic-pagination is-${position}`} aria-label={`Paginación de ${title}`}><button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior"><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span></button><span className={isPublication ? styles.paginationCount : ''}>{isPublication ? `Pág. ${page}/${pageCount}` : `Página ${page} de ${pageCount}`}</span><button type="button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Página siguiente"><span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button></nav>

  const saveEditedPublication = async (entry: AcademicContentEntry) => {
    try {
      setSaving(true)
      await save({ ...entry, date: editing?.date || todayISO(), author: 'Brigitte Rodríguez' })
      setEditing(null)
      notify.success('Publicación guardada', { id: 'academic-content-save' })
    } catch (error) {
      notify.error('No se pudo guardar la publicación', { id: 'academic-content-save', description: errorMessage(error, 'Intenta nuevamente.') })
    } finally {
      setSaving(false)
    }
  }

  if (editing && (kind === 'news' || kind === 'event')) return <AcademicPostPreviewPage
    entry={editing}
    mode="edit"
    isNew={!visibleEntries.some(entry => entry.id === editing.id)}
    periods={publicationPeriods.map(period => ({ id: period.id, title: period.title }))}
    isSaving={saving}
    onChange={setEditing}
    onUploadImage={file => publicationImageUploader.upload({ institutionId: editing.institutionId, publicationId: editing.id, file })}
    onSave={saveEditedPublication}
    onCancel={() => setEditing(null)}
  />

  return <section className={`page-content academic-content-page${kind === 'honor' ? ' is-honor-page' : ''}${isPublication ? ` ${styles.newsPage}` : ''}`}>
    {kind !== 'honor' && !isPublication && <header className="academic-page-heading"><div><h1>{title}</h1></div>
    </header>}
    {kind === 'period' && <section className="current-period-card" aria-label="Período académico vigente">
      <div className="current-period-icon"><CalendarDays size={20} /></div><div><span>PERÍODO VIGENTE</span><strong>{currentPeriod?.title ?? 'No hay un período vigente'}</strong>{currentPeriod && <small>{dateLabel(currentPeriod.startDate)} – {dateLabel(currentPeriod.endDate)}</small>}</div>
    </section>}
    <section className={kind === 'honor' ? 'is-honor-list' : `academic-list ${kind === 'news' || kind === 'event' ? 'is-publication-list' : ''}${isPublication ? ` ${styles.newsList}` : ''}`} aria-label={title}>
      {kind === 'period' && <div className="academic-list-heading"><div><h2>Histórico de períodos</h2><span aria-label={`${listCount} ${singular.toLowerCase()}`}>{listCount}</span></div><Button variant="primary" onClick={() => beginCreate()}><CirclePlus size={18} />{`Nuevo ${singular.toLowerCase()}`}</Button></div>}
      {(kind === 'news' || kind === 'event') && <div className={`${isPublication ? styles.toolbar : 'publication-toolbar'}${isPublication && publicationSearchOpen ? ` ${styles.toolbarSearching}` : ''}`}><div className={isPublication ? styles.filters : 'publication-filters'} role="group" aria-label="Filtrar publicaciones por estado">
        {([
          { value: 'all', label: 'Todas', count: visibleEntries.length },
          { value: 'published', label: 'Publicadas', count: visibleEntries.filter(entry => entry.status === 'published').length },
          { value: 'draft', label: 'Borradores', count: visibleEntries.filter(entry => entry.status === 'draft').length },
        ] as const).map(option => <button key={option.value} type="button" className={isPublication ? `${styles.filterChip}${statusFilter === option.value ? ` ${styles.filterChipActive}` : ''}` : statusFilter === option.value ? 'is-active' : ''} aria-pressed={statusFilter === option.value} onClick={() => setStatusFilter(option.value)}>{option.label}<span>{option.count}</span></button>)}
      </div>{isPublication && <div className={`${styles.searchTools}${publicationSearchOpen ? ` ${styles.searchToolsOpen}` : ''}`}><label className={`${styles.searchField}${publicationSearchOpen ? ` ${styles.searchFieldOpen}` : ''}`}><button type="button" className={styles.searchToggle} aria-label={publicationSearchOpen ? 'Cerrar búsqueda' : 'Buscar publicaciones'} aria-expanded={publicationSearchOpen} onClick={() => setPublicationSearchOpen(open => !open)}><span className="material-symbols-rounded" aria-hidden="true">search</span></button>{publicationSearchOpen && <input autoFocus type="search" value={publicationSearch} onChange={event => setPublicationSearch(event.target.value)} placeholder={`Buscar ${kind === 'news' ? 'noticias' : 'eventos'}`} aria-label={`Buscar ${kind === 'news' ? 'noticias' : 'eventos'} por texto`} />}</label><label className={`${styles.statusSelectField} ${statusFilter === 'all' ? styles.statusAll : statusFilter === 'published' ? styles.statusPublishedFilter : styles.statusDraftFilter}`}><span className="material-symbols-rounded" aria-hidden="true">{statusFilter === 'all' ? 'filter_list' : statusFilter === 'published' ? 'check_circle' : 'edit_note'}</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | AcademicPublicationStatus)} aria-label="Filtrar por estado"><option value="all">Todas</option><option value="published">Publicadas</option><option value="draft">Borradores</option></select></label><label className={styles.dateField}><span className="material-symbols-rounded" aria-hidden="true">calendar_month</span><input type="date" value={publicationDate} onChange={event => setPublicationDate(event.target.value)} aria-label="Filtrar publicaciones por fecha" title="Filtrar por fecha" /></label></div>}<div className={isPublication ? styles.toolbarActions : ''}>{renderPagination('top')}<Button variant="primary" className={isPublication ? styles.newButton : ''} onClick={() => beginCreate()}>{isPublication ? <span className="material-symbols-rounded" aria-hidden="true">add</span> : <CirclePlus size={18} />}{kind === 'news' ? 'Nueva noticia' : 'Nuevo evento'}</Button></div></div>}
      {listCount === 0 && kind !== 'honor' ? <p className="academic-empty">No hay registros para esta institución.</p> : kind === 'honor' && honorGroups.length === 0 ? <EmptyState icon={Award} title="Aún no hay distinciones">{HONOR_EMPTY_MESSAGE}</EmptyState> : kind === 'honor' ? <div className="academic-entry-list honor-period-list">{pageHonorGroups.map(group => {
        const groupKey = group.key
        const expanded = expandedHonorPeriod === groupKey
        return <article className="academic-honor-group" key={groupKey}>
          <div className="academic-entry honor-period-entry">
            {group.category === 'official' ? <div className="honor-period-static">
              <div className="academic-entry-copy"><div className="academic-entry-title"><h3>{group.category === 'official' ? 'Distinciones oficiales' : 'Reconocimientos institucionales'}</h3></div><small className="honor-period-year"><CalendarDays size={15} aria-hidden="true" />{group.year}</small></div>
            </div> : <button type="button" className="honor-period-toggle" onClick={() => setExpandedHonorPeriod(expanded ? null : groupKey)} aria-expanded={expanded}>
              <div className="academic-entry-copy"><div className="academic-entry-title"><h3>Reconocimientos institucionales</h3></div><small className="honor-period-year"><CalendarDays size={15} aria-hidden="true" />{group.year}</small></div>
            </button>}
          </div>
          {(group.category === 'official' || expanded) && (group.category === 'official' ? <div className="honor-official-slots" aria-label={`Puestos oficiales ${group.year}`}>{OFFICIAL_DISPLAY_DISTINCTIONS.map((distinction, index) => {
            const person = group.people.find(entry => normalizeOfficialDistinction(entry.distinction) === distinction)
            const isFlagBearer = distinction === OFFICIAL_DISTINCTIONS[0]
            const isFirstEscort = distinction.startsWith('1er. escolta')
            const positionClass = distinction === OFFICIAL_DISTINCTIONS[0] ? ' is-flag-bearer-slot' : distinction === OFFICIAL_DISTINCTIONS[1] ? ' is-city-standard-bearer' : distinction === OFFICIAL_DISTINCTIONS[2] ? ' is-school-standard-bearer' : distinction === OFFICIAL_DISTINCTIONS[3] ? ' is-national-first-escort' : distinction === OFFICIAL_DISTINCTIONS[4] ? ' is-national-second-escort' : distinction === OFFICIAL_DISTINCTIONS[5] ? ' is-city-first-escort' : distinction === OFFICIAL_DISTINCTIONS[6] ? ' is-city-second-escort' : distinction === OFFICIAL_DISTINCTIONS[7] ? ' is-school-first-escort' : distinction === OFFICIAL_DISTINCTIONS[8] ? ' is-school-second-escort' : ''
            return <article className={`honor-official-slot${person ? ' is-assigned' : ''}${isFirstEscort ? ' is-first-escort' : ''}${positionClass}`} key={distinction}>
              <div className="honor-profile-header">
                {person ? (person.imageUrl ?? getStudentAvatar(person.studentName)) ? <img className={`honor-student-avatar${isFlagBearer ? ' is-flag-bearer' : ''}`} src={person.imageUrl ?? getStudentAvatar(person.studentName)} alt={`Fotografía de ${person.studentName}`} loading="lazy" /> : <span className={`honor-student-initials${isFlagBearer ? ' is-flag-bearer' : ''}`} aria-hidden="true">{getStudentInitials(person.studentName)}</span> : <span className={`honor-slot-number${isFlagBearer ? ' is-flag-bearer' : ''}`}>{index + 1}</span>}
                <div className="honor-slot-copy">
                  {person ? <>
                    <div className="honor-slot-title-row"><strong className="honor-slot-student-name">{person.studentName}</strong><div className="honor-slot-actions"><button type="button" className="honor-card-action" onClick={() => beginEdit(person)} aria-label={`Editar ${person.studentName}`} title="Editar"><Pencil size={16} /></button><button type="button" className="honor-card-action is-danger" onClick={() => deleteEntry(person)} aria-label={`Eliminar ${person.studentName}`} title="Eliminar"><Trash2 size={16} /></button></div></div>
                    <span className="honor-slot-distinction"><OfficialFlag kind={getOfficialFlagKind(distinction)} /><span>{distinction}</span></span>
                  </> : <><strong>{distinction}</strong><span className="honor-slot-empty">Sin asignar</span></>}
                </div>
              </div>
              {person && <div className="honor-slot-meta">
                {(person.grade || person.schedule) && <span>{person.grade && <><GraduationCap size={16} aria-hidden="true" />{gradeLabel(person.grade)}</>}{person.grade && person.schedule && <i className="honor-meta-separator" aria-hidden="true" />}{person.schedule && <><Clock3 size={16} aria-hidden="true" />{person.schedule}</>}</span>}
              </div>}
              {!person && <Button type="button" onClick={() => beginCreate(distinction, group.periodId)}><CirclePlus size={16} />Asignar</Button>}
            </article>
          })}</div> : <div className="honor-people-list" aria-label={`Reconocimientos institucionales ${group.year}`}>{group.people.map(person => <article className="academic-entry honor-person-entry" key={person.id}>{getStudentAvatar(person.studentName) ? <img className="honor-student-avatar" src={getStudentAvatar(person.studentName)} alt={`Fotografía de ${person.studentName}`} loading="lazy" /> : <span className="honor-student-initials" aria-hidden="true">{getStudentInitials(person.studentName)}</span>}<div className="academic-entry-copy"><h3>{person.studentName}</h3><p>{person.distinction} · {gradeLabel(person.grade)}</p></div><div className="honor-person-controls"><div className="academic-entry-actions"><button type="button" className="academic-icon-button" onClick={() => beginEdit(person)} aria-label={`Editar ${person.studentName}`}><Pencil size={17} /></button><button type="button" className="academic-icon-button is-danger" onClick={() => deleteEntry(person)} aria-label={`Eliminar ${person.studentName}`}><Trash2 size={17} /></button></div><span className={`entry-status ${person.status === 'published' ? 'is-published' : ''}`}>{person.status === 'published' ? 'Publicado' : 'Borrador'}</span></div></article>)}</div>)}
        </article>
      })}</div> : <div className={isPublication ? styles.postsGrid : 'academic-entry-list'}>{pageEntries.map(entry => {
        const linkedPeriod = periods.find(period => period.id === entry.periodId)
        const mainText = entry.title
        const subText = entry.description
        return (kind === 'news' || kind === 'event') ? <article className={isPublication ? styles.postCard : 'publication-post'} key={entry.id}>
          {isPublication ? <div className={`${styles.postMedia}${kind === 'event' ? ` ${styles.eventMedia}` : ''}`}><img className={styles.postImage} src={entry.imageUrl || (kind === 'event' ? eventCover : defaultCover)} alt="" loading="lazy" />{kind === 'event' && entry.location && <span className={styles.eventLocation}><span className="material-symbols-rounded" aria-hidden="true">location_on</span>{entry.location}</span>}</div> : <img className="publication-post-image" src={entry.imageUrl || (kind === 'event' ? eventCover : defaultCover)} alt="" loading="lazy" />}
          <div className={isPublication ? styles.postBody : 'publication-post-body'}><div className={isPublication ? styles.postTitle : 'academic-entry-title'}><h3>{mainText}</h3><span className={isPublication ? `${styles.statusChip}${entry.status === 'published' ? ` ${styles.statusPublished}` : ''}` : `entry-status ${entry.status === 'published' ? 'is-published' : ''}`}>{entry.status === 'published' ? 'Publicado' : 'Borrador'}</span></div><p>{subText}</p><div className={isPublication ? styles.postFooter : ''}><small>{isPublication && <span className="material-symbols-rounded" aria-hidden="true">calendar_month</span>}{dateLabel(entry.date)}</small><div className={isPublication ? styles.postActions : 'academic-entry-actions'}><button type="button" className={`${isPublication ? `${styles.postAction} ${styles.previewAction}` : 'academic-icon-button is-preview'}`} onClick={() => onPreview?.(entry)} aria-label={`Ver vista previa de ${mainText}`} title="Vista previa">{isPublication ? <span className="material-symbols-rounded" aria-hidden="true">visibility</span> : <Eye size={18} />}</button><button type="button" className={isPublication ? styles.postAction : 'academic-icon-button'} onClick={() => beginEdit(entry)} aria-label={`Editar ${mainText}`} title="Editar">{isPublication ? <span className="material-symbols-rounded" aria-hidden="true">edit</span> : <Pencil size={17} />}</button><button type="button" className={isPublication ? `${styles.postAction} ${styles.dangerAction}` : 'academic-icon-button is-danger'} onClick={() => deleteEntry(entry)} aria-label={`Eliminar ${mainText}`} title="Eliminar">{isPublication ? <span className="material-symbols-rounded" aria-hidden="true">delete</span> : <Trash2 size={17} />}</button></div></div></div>
        </article> : <article className="academic-entry" key={entry.id}>
          <div className="academic-entry-copy"><div className="academic-entry-title"><h3>{mainText}</h3>{kind === 'period' ? <span className={entry.isCurrent ? 'entry-status is-current' : 'entry-status'}>{entry.isCurrent ? 'Vigente' : 'Histórico'}</span> : <span className={`entry-status ${entry.status === 'published' ? 'is-published' : ''}`}>{entry.status === 'published' ? 'Publicado' : 'Borrador'}</span>}</div>
            {subText && <p>{subText}</p>}
            <small>{kind === 'period' ? `${dateLabel(entry.startDate)} – ${dateLabel(entry.endDate)}` : kind === 'event' ? dateLabel(entry.date) : `${entry.date ? dateLabel(entry.date) : 'Sin fecha'} · ${linkedPeriod?.title ?? 'Sin período académico'}`}</small>
          </div>
          <div className="academic-entry-actions"><button type="button" className="academic-icon-button" onClick={() => beginEdit(entry)} aria-label={`Editar ${mainText}`}><Pencil size={17} /></button>{kind !== 'period' && <button type="button" className="academic-icon-button is-danger" onClick={() => deleteEntry(entry)} aria-label={`Eliminar ${mainText}`}><Trash2 size={17} /></button>}</div>
        </article>
      })}</div>}
      {!isPublication && renderPagination('bottom')}
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
          <label>Categoría<select value={getHonorCategory(editing)} onChange={event => { const category = event.target.value as HonorCategory; setEditing(current => { if (!current) return current; const student = students.find(item => item.id === current.studentId); const isEligible = category !== 'official' || Boolean(student && isThirdBachillerato(student.grade)); return { ...current, honorCategory: category, studentId: isEligible ? current.studentId : '', studentName: isEligible ? current.studentName : '', grade: category === 'official' ? 'Tercero de Bachillerato' : isEligible ? student?.grade ?? current.grade : '', distinction: category === 'official' ? '' : current.distinction, officialOrder: undefined } }); setFieldErrors({}) }}><option value="institutional">Reconocimiento institucional</option><option value="official">Distinción oficial</option></select></label>
          <label>Estudiante<select required {...fieldProps('studentId')} value={editing.studentId ?? ''} onChange={event => { const student = students.find(item => item.id === event.target.value); setEditing(current => current ? { ...current, studentId: student?.id ?? '', studentName: student?.name ?? '', grade: getHonorCategory(current) === 'official' ? 'Tercero de Bachillerato' : student?.grade ?? '' } : current); setFieldErrors(current => { const next = { ...current }; delete next.studentId; delete next.studentName; delete next.grade; return next }) }}><option value="">Selecciona un estudiante registrado</option>{students.filter(student => getHonorCategory(editing) !== 'official' || isThirdBachillerato(student.grade)).map(student => <option key={student.id} value={student.id}>{student.name}{student.grade ? ` · ${gradeLabel(student.grade)}` : ''}</option>)}</select>{fieldError('studentId')}{students.length === 0 && <small className="academic-help-text">No hay estudiantes registrados para esta institución.</small>}</label>
          {getHonorCategory(editing) === 'official' ? <label>Nivel educativo<input value="Tercero de Bachillerato" readOnly /><small className="academic-help-text">El artículo 191 establece estas distinciones para estudiantes de tercer curso de Bachillerato.</small></label> : <label>Nivel educativo<input value={editing.grade} readOnly placeholder="Se completa al seleccionar al estudiante" /></label>}
          {getHonorCategory(editing) === 'official' ? <>
            <label>Distinción<select required {...fieldProps('distinction')} value={editing.distinction} onChange={event => update('distinction', event.target.value)}><option value="">Selecciona según la jerarquía</option>{OFFICIAL_DISTINCTIONS.map((distinction, index) => <option key={distinction} value={distinction}>{index + 1}. {distinction}</option>)}</select>{fieldError('distinction')}</label>
            <div className="academic-form-grid"><label>Jornada<select required {...fieldProps('schedule')} value={editing.schedule ?? ''} onChange={event => update('schedule', event.target.value)}><option value="">Selecciona una jornada</option><option>Matutina</option><option>Vespertina</option><option>Nocturna</option></select>{fieldError('schedule')}</label><label>Modalidad<select required {...fieldProps('modality')} value={editing.modality ?? ''} onChange={event => update('modality', event.target.value)}><option value="">Selecciona una modalidad</option><option>Presencial</option><option>Semipresencial</option><option>A distancia</option></select>{fieldError('modality')}</label></div>
            <label>Sede (si corresponde)<input value={editing.campus ?? ''} onChange={event => update('campus', event.target.value)} placeholder="Sede institucional" /></label>
          </> : <label>Reconocimiento<input required {...fieldProps('distinction')} value={editing.distinction} onChange={event => update('distinction', event.target.value)} placeholder="Ej. Mérito científico" />{fieldError('distinction')}</label>}
          <label>Período lectivo<select required {...fieldProps('periodId')} value={editing.periodId} onChange={event => update('periodId', event.target.value)}><option value="">Selecciona un período</option>{periods.map(period => <option key={period.id} value={period.id}>{period.title}{period.isCurrent ? ' · Vigente' : ''}</option>)}</select>{fieldError('periodId')}</label>
          <label>Foto del estudiante
            {editing.imageUrl && <img className="honor-form-photo-preview" src={editing.imageUrl} alt={`Foto actual de ${editing.studentName}`} />}
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={photoUploading} onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                setPhotoError('La foto debe ser PNG, JPG o WebP y pesar máximo 5 MB.')
                return
              }
              setPhotoUploading(true)
              setPhotoError('')
              const path = `${editing.institutionId}/honors/${editing.id}/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`
              void supabase.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
                .then(({ error: uploadError }) => {
                  if (uploadError) throw uploadError
                  const imageUrl = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
                  setEditing(current => current ? { ...current, imageUrl } : current)
                })
                .catch(() => setPhotoError('No se pudo subir la foto al bucket. Verifica el permiso de carga.'))
                .finally(() => setPhotoUploading(false))
            }} />
            <small className="academic-help-text">{photoUploading ? 'Subiendo foto al bucket…' : 'PNG, JPG o WebP · máximo 5 MB. Se guarda en Supabase Storage.'}</small>
            {photoError && <small className="academic-field-error" role="alert">{photoError}</small>}
          </label>
        </> : <>
          <label>Nombre del período<input required {...fieldProps('title')} value={editing.title} onChange={event => update('title', event.target.value)} placeholder="2026–2027" />{fieldError('title')}</label>
          <div className="academic-form-grid"><label>Fecha de inicio<input required type="date" {...fieldProps('startDate')} value={editing.startDate} onChange={event => update('startDate', event.target.value)} />{fieldError('startDate')}</label><label>Fecha de fin<input required type="date" min={editing.startDate} {...fieldProps('endDate')} value={editing.endDate} onChange={event => update('endDate', event.target.value)} />{fieldError('endDate')}</label></div>
          <label className="academic-checkbox"><input type="checkbox" checked={editing.isCurrent} onChange={event => update('isCurrent', event.target.checked)} /><span>Marcar como período vigente</span></label>
        </>}
        {kind === 'honor' && <><label>Estado<select value={editing.status} onChange={event => update('status', event.target.value)}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label></>}
        <div className="academic-form-actions"><Button type="button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>{(kind === 'news' || kind === 'event') && formStep === 2 && <Button type="button" onClick={() => setFormStep(1)} disabled={saving}>Atrás</Button>}<Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : (kind === 'news' || kind === 'event') && formStep === 1 ? <>Continuar<ArrowRight size={17} /></> : <><Check size={17} />Guardar</>}</Button></div>
      </form>}
    </Modal>
  </section>
}
