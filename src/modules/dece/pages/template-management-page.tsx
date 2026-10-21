import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { useDeceData } from '../services/dece-data-context'
import { createDeceFormService, getStandardTemplateQuestionCodes, type FormQuestion, type QuestionType, type QuestionValidation } from '../services/form-service'
import PdfActionButton from '../components/pdf-action-button'
import styles from './template-management-page.module.css'

type Template = { id: string; code: string; name: string; isActive: boolean; versionId: string | null; status: string; questions: FormQuestion[]; updatedAt: string | null }
const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: 'text', label: 'Texto corto' }, { value: 'textarea', label: 'Texto largo' }, { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' }, { value: 'boolean', label: 'Sí / No' }, { value: 'single_select', label: 'Selección única' }, { value: 'multi_select', label: 'Selección múltiple' },
]
const readRoute = () => {
  const match = location.pathname.match(/\/plantillas(?:\/([^/]+))?\/?$/)
  return { id: match?.[1] ?? '', search: new URLSearchParams(location.search) }
}
const sectionName = (question: FormQuestion) => question.display_config?.section?.trim() || 'General'
const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'America/Guayaquil' }).format(new Date(date)) : 'Sin registro'
const isTemplateRetired = (template: Template) => !template.isActive || template.status === 'Retirada'
const errorMessage = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : typeof (cause as { message?: unknown } | null)?.message === 'string' ? (cause as { message: string }).message : fallback
const userError = (cause: unknown, fallback: string) => (cause as { code?: string } | null)?.code === '42501' ? 'No tienes permiso para realizar esta acción. No se guardaron cambios.' : errorMessage(cause, fallback)

export default function TemplateManagementPage() {
  const integration = useDeceData()
  const service = useMemo(() => integration ? createDeceFormService(integration.client) : null, [integration?.client])
  const [templates, setTemplates] = useState<Template[]>([])
  const [includeRetired, setIncludeRetired] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [route, setRoute] = useState(readRoute)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMessage, setPdfMessage] = useState('')
  const listScroll = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const dialogReturn = useRef<HTMLElement | null>(null)
  const pendingRestore = useRef(false)
  const search = route.search.get('q') ?? ''
  const page = Math.max(1, Number(route.search.get('pagina') || 1))
  const activeSection = route.search.get('seccion') || ''

  const updateRoute = useCallback((next: { id?: string; section?: string; page?: number; q?: string }, replace = false) => {
    const current = readRoute()
    const base = location.pathname.replace(/\/plantillas(?:\/[^/]+)?\/?$/, '')
    const params = current.search
    if (next.section !== undefined) next.section ? params.set('seccion', next.section) : params.delete('seccion')
    if (next.page !== undefined) next.page > 1 ? params.set('pagina', String(next.page)) : params.delete('pagina')
    if (next.q !== undefined) next.q.trim() ? params.set('q', next.q) : params.delete('q')
    const query = params.toString()
    const path = `${base}/plantillas${next.id === undefined ? current.id ? `/${current.id}` : '' : next.id ? `/${next.id}` : ''}${query ? `?${query}` : ''}`
    if (next.id !== undefined && !current.id && next.id) {
      listScroll.current = window.scrollY
      pendingRestore.current = false
    }
    if (next.id !== undefined && current.id && !next.id) pendingRestore.current = true
    history[replace ? 'replaceState' : 'pushState'](null, '', path)
    setRoute(readRoute())
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!integration) { setLoading(false); setError('No hay una institución activa en la sesión.'); return }
    if (!silent) setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await integration.client.from('form_definitions')
        .select('form_definition_id,code,name,is_active,updated_at,form_versions(form_version_id,version_number,status)')
        .eq('institution_id', integration.institutionId).order('name')
      if (queryError) throw queryError
      const definitions = data ?? []
      const selected = definitions.map(definition => {
        const versions = (definition.form_versions ?? []) as Array<{ form_version_id: string; version_number: number; status: string }>
        const version = versions.sort((a, b) => b.version_number - a.version_number)[0]
        return { definition, version }
      })
      const versionIds = selected.flatMap(item => item.version ? [item.version.form_version_id] : [])
      const { data: questions, error: questionsError } = versionIds.length
        ? await integration.client.from('form_questions').select('form_question_id,form_version_id,code,label,help_text,data_type,source_field,is_required,is_system,is_active,position,display_config,updated_at,form_question_options(question_option_id,value,label,position)').in('form_version_id', versionIds).order('position')
        : { data: [], error: null }
      if (questionsError) throw questionsError
      const questionRows = (questions ?? []) as Array<FormQuestion & { is_active?: boolean; updated_at?: string; form_version_id: string }>
      setTemplates(selected.map(({ definition, version }) => {
        const ownQuestions = questionRows.filter(question => question.form_version_id === version?.form_version_id)
        const stamps = [definition.updated_at, ...ownQuestions.map(question => question.updated_at)].filter((value): value is string => Boolean(value))
        const updatedAt = stamps.sort().at(-1) ?? null
        const status = !definition.is_active ? 'Retirada' : version?.status === 'published' ? 'Publicada' : version?.status === 'draft' ? 'Borrador' : version?.status === 'retired' ? 'Retirada' : 'Borrador'
        return { id: definition.form_definition_id, code: definition.code, name: definition.name, isActive: definition.is_active, versionId: version?.form_version_id ?? null, status, questions: ownQuestions, updatedAt }
      }))
    } catch (cause) { setError(errorMessage(cause, 'No se pudieron cargar las fichas.')) }
    finally { if (!silent) setLoading(false) }
  }, [integration])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const sync = () => {
      const next = readRoute()
      if (route.id && !next.id) pendingRestore.current = true
      setRoute(next)
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [route.id])
  useEffect(() => { if (pendingRestore.current && !route.id) { window.scrollTo({ top: listScroll.current }); pendingRestore.current = false } }, [route.id])
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  const selected = templates.find(template => template.id === route.id)
  const retiredTemplateCount = templates.filter(template => !template.isActive || template.status === 'Retirada').length
  const visibleTemplates = useMemo(() => {
    const normalizedSearch = templateSearch.trim().toLocaleLowerCase('es')
    return templates.filter(template => {
      const retired = !template.isActive || template.status === 'Retirada'
      const matches = !normalizedSearch || (template.name + ' ' + template.code).toLocaleLowerCase('es').includes(normalizedSearch)
      return (includeRetired || !retired) && matches
    })
  }, [templates, includeRetired, templateSearch])
  const sections = useMemo(() => [...new Set(selected?.questions.map(sectionName) ?? [])], [selected])
  const filtered = useMemo(() => (selected?.questions ?? []).filter(question => !search || question.label.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))), [selected, search])
  const visibleSections = search ? [...new Set(filtered.map(sectionName))] : sections
  const currentSection = search ? '' : visibleSections.includes(activeSection) ? activeSection : visibleSections[0] ?? ''
  const sectionQuestions = filtered.filter(question => search || sectionName(question) === currentSection)
  const pageCount = Math.max(1, Math.ceil(sectionQuestions.length / 10))
  const pagedQuestions = sectionQuestions.slice((page - 1) * 10, page * 10)

  useEffect(() => { if (route.id && page > pageCount) updateRoute({ page: pageCount }, true) }, [page, pageCount, route.id, updateRoute])

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!integration || !service || !name.trim()) return
    setBusy(true); setError('')
    try { const created = await service.createFormTemplate(integration.institutionId, name); await load(); setName(''); setCreateOpen(false); updateRoute({ id: created.id }) }
    catch (cause) { setError(userError(cause, 'No se pudo crear la ficha.')) }
    finally { setBusy(false) }
  }

  async function resetDefaults() {
    if (!service || !integration) return
    setBusy(true); setError('')
    try {
      const { data: definitions, error: definitionError } = await integration.client.from('form_definitions').select('form_definition_id,code,is_active,form_versions(form_version_id,version_number,status)').eq('institution_id', integration.institutionId)
      if (definitionError) throw definitionError
      const retiredTemplateCount = (definitions ?? []).filter(definition => definition.is_active && definition.code !== 'general' && definition.code !== 'authorization').length
      const versionsById = new Map<string, 'general' | 'authorization'>()
      const versionIds = (definitions ?? []).filter(definition => definition.code === 'general' || definition.code === 'authorization').flatMap(definition => {
        const versions = (definition.form_versions ?? []) as Array<{ form_version_id: string; version_number: number; status: string }>
        const version = versions.filter(item => item.status === 'published').sort((a, b) => b.version_number - a.version_number)[0]
        if (!version || (definition.code !== 'general' && definition.code !== 'authorization')) return []
        versionsById.set(version.form_version_id, definition.code)
        return [version.form_version_id]
      })
      let customCount = 0
      let draftCount = 0
      if (versionIds.length) {
        const [{ data: questionRows, error: countError }, { count: submissionsCount, error: submissionsError }] = await Promise.all([
          integration.client.from('form_questions').select('form_question_id,form_version_id,code').in('form_version_id', versionIds).eq('is_system', false).eq('is_active', true),
          integration.client.from('form_submissions').select('form_submission_id', { count: 'exact', head: true }).in('form_version_id', versionIds).eq('status', 'draft'),
        ])
        if (countError) throw countError
        if (submissionsError) throw submissionsError
        customCount = (questionRows ?? []).filter(question => {
          const formCode = versionsById.get(question.form_version_id)
          return !formCode || !getStandardTemplateQuestionCodes(formCode).includes(question.code)
        }).length
        draftCount = submissionsCount ?? 0
      }
      setBusy(false)
      const confirmation = await Swal.fire({
        title: 'Restablecer plantillas base',
        text: `Se publicará una versión nueva de las fichas General y Autorización. Preguntas personalizadas agregadas que dejarán de estar disponibles en la nueva versión: ${customCount}. Borradores en curso que quedarán asociados a la versión anterior: ${draftCount}. Fichas no base que se retirarán: ${retiredTemplateCount}. Solo quedarán activas Autorización y Registro general. Las respuestas ya guardadas se conservan.`,
        icon: 'warning', showCancelButton: true, confirmButtonText: 'Restablecer plantillas', cancelButtonText: 'Cancelar',
        confirmButtonColor: '#b42318', focusConfirm: false, focusCancel: true,
      })
      if (!confirmation.isConfirmed) return
      setBusy(true)
      await service.resetDefaultTemplates(integration.institutionId)
      await load(true)
      await Swal.fire({ title: 'Plantillas restablecidas', text: 'Se creó una nueva versión de las fichas base. Las respuestas guardadas se conservaron.', icon: 'success', confirmButtonText: 'Aceptar' })
    } catch (cause) { setError(userError(cause, 'No se pudieron restablecer las plantillas.')) }
    finally { setBusy(false) }
  }

  async function changeQuestion(question: FormQuestion & { is_active?: boolean }) {
    if (!integration || !selected?.versionId || question.is_system) return
    const next = question.is_active === false
    if (!next) {
      const confirmation = await Swal.fire({ title: 'Desactivar pregunta', text: 'La pregunta dejará de estar disponible para completar. Las respuestas ya guardadas se conservan.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Desactivar pregunta', cancelButtonText: 'Cancelar', confirmButtonColor: '#b42318', focusConfirm: false, focusCancel: true })
      if (!confirmation.isConfirmed) return
    }
    setBusy(true); setError('')
    try {
      const { error: updateError } = await integration.client.from('form_questions').update({ is_active: next, updated_at: new Date().toISOString() }).eq('form_version_id', selected.versionId).eq('form_question_id', question.form_question_id).eq('is_system', false)
      if (updateError) throw updateError
      await load(true)
    } catch (cause) { setError(userError(cause, 'No se pudo cambiar el estado de la pregunta.')) }
    finally { setBusy(false) }
  }

  async function toggleTemplateStatus(template: Template) {
    if (!service || !integration) return
    const retired = isTemplateRetired(template)
    if (!retired && (template.code === 'general' || template.code === 'authorization')) return
    const confirmation = await Swal.fire({
      title: retired ? 'Restablecer ficha' : 'Retirar ficha',
      text: retired ? 'La ficha volverá a estar disponible para el equipo DECE.' : 'La ficha dejará de estar disponible. Los borradores y respuestas guardadas se conservan.',
      icon: 'warning', showCancelButton: true,
      confirmButtonText: retired ? 'Restablecer ficha' : 'Retirar ficha',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: retired ? '#2563eb' : '#b42318',
      focusConfirm: false, focusCancel: true,
    })
    if (!confirmation.isConfirmed) return
    setBusy(true); setError('')
    try {
      if (retired) await service.activateFormTemplate(template.id)
      else await service.deactivateFormTemplate(template.id)
      await load(true)
      await Swal.fire({ title: retired ? 'Ficha restablecida' : 'Ficha retirada', text: retired ? 'La ficha está disponible nuevamente.' : 'La ficha se retiró y puede volver a mostrarse desde el filtro.', icon: 'success', confirmButtonText: 'Aceptar' })
    } catch (cause) { setError(userError(cause, retired ? 'No se pudo restablecer la ficha.' : 'No se pudo retirar la ficha.')) }
    finally { setBusy(false) }
  }
  async function generatePdf(template: Template, preview: boolean) {
    if (!integration || pdfBusy || isTemplateRetired(template)) return
    setPdfBusy(true); setPdfMessage('Generando PDF…')
    try {
      const { createDecePdfService } = await import('../services/pdf-service')
      const blob = await createDecePdfService(integration.client).blankForm(integration.institutionId, template.code, null, integration.profileId, preview)
      if (preview && blob instanceof Blob) { setPdfUrl(URL.createObjectURL(blob)); setPdfMessage('Vista PDF lista.') }
      else setPdfMessage('PDF descargado correctamente.')
    } catch (cause) { setPdfMessage(cause instanceof Error ? cause.message : 'No se pudo generar el PDF.') }
    finally { setPdfBusy(false) }
  }

  if (loading) return <LoadingState />
  if (route.id && !selected) return <div className="page-content container-fluid"><Breadcrumbs onList={() => updateRoute({ id: '' })} /><h1>Ficha no encontrada</h1><p>La ficha no existe o no pertenece a la institución activa.</p><button className="btn btn-outline-secondary" onClick={() => updateRoute({ id: '' })}>Volver a plantillas</button></div>
  if (!route.id) return <div className={`page-content container-fluid ${styles.page}`} ref={listRef}>
    <Breadcrumbs />
    <header className={styles.header}><div><span className="eyebrow">CONFIGURACIÓN DECE</span><h1>Plantillas de fichas</h1><p>Organiza las fichas y sus preguntas para la institución.</p></div><div className={styles.actions}><button type="button" className="button btn secondary" disabled={busy} onClick={() => void resetDefaults()}>Restablecer plantillas</button><button type="button" className="button btn primary" onClick={() => { dialogReturn.current = document.activeElement as HTMLElement; setCreateOpen(true) }}>Crear nueva ficha</button></div></header>
    {error && <div className="notice" role="alert">{error}</div>}
    <div className={styles.templateFilters}><label htmlFor="template-search">Buscar fichas</label><div className={styles.templateFilterControls}><input id="template-search" className="form-control" type="search" value={templateSearch} onChange={event => setTemplateSearch(event.target.value)} placeholder="Nombre o código de ficha" /><button type="button" className="btn btn-outline-secondary" aria-pressed={includeRetired} onClick={() => setIncludeRetired(value => !value)}>{includeRetired ? 'Ocultar fichas retiradas' : 'Incluir fichas retiradas (' + retiredTemplateCount + ')'}</button></div><span className={styles.filterHint}>{includeRetired ? 'Se muestran también las fichas retiradas.' : retiredTemplateCount + ' fichas retiradas ocultas.'}</span></div>
    {visibleTemplates.length === 0 ? <section className={styles.empty}><h2>{templateSearch ? 'No hay fichas que coincidan' : includeRetired ? 'No hay fichas registradas' : 'No hay fichas activas'}</h2><p>{templateSearch ? 'Prueba con otro nombre o código.' : 'Crea una ficha o restablece las plantillas base.'}</p>{!templateSearch && <button className="button btn primary" onClick={() => setCreateOpen(true)}>Crear nueva ficha</button>}</section> : <div className={styles.grid}>{visibleTemplates.map((template, index) => <TemplateCard key={template.id} template={template} index={index} pdfBusy={pdfBusy} actionBusy={busy} onOpen={() => updateRoute({ id: template.id })} onPdf={() => generatePdf(template, false)} onToggleStatus={() => void toggleTemplateStatus(template)} />)}</div>}
    {createOpen && <TemplateDialog title="Crear nueva ficha" onClose={() => { setCreateOpen(false); dialogReturn.current?.focus() }}><form onSubmit={event => void createTemplate(event)}><label className="form-label" htmlFor="new-template-name">Nombre de la ficha</label><input id="new-template-name" autoFocus className="form-control mb-3" required value={name} onChange={event => setName(event.target.value)} /><div className="d-flex justify-content-end gap-2"><button type="button" className="btn btn-outline-secondary" onClick={() => { setCreateOpen(false); dialogReturn.current?.focus() }}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Crear ficha'}</button></div></form></TemplateDialog>}
  </div>

  return <TemplateDetail template={selected!} search={search} activeSection={currentSection} visibleSections={visibleSections} resultCount={filtered.length} questions={pagedQuestions} page={page} pageCount={pageCount} busy={busy} error={error} notice={notice} pdfUrl={pdfUrl} pdfBusy={pdfBusy} pdfMessage={pdfMessage} onBack={() => updateRoute({ id: '' })} onTemplate={() => updateRoute({ section: '', page: 1 })} onSection={value => updateRoute({ section: value, page: 1 })} onSearch={value => updateRoute({ q: value, page: 1 }, true)} onPage={value => updateRoute({ page: value })} onQuestion={() => { dialogReturn.current = document.activeElement as HTMLElement }} onChangeQuestion={question => void changeQuestion(question)} onPreview={() => void generatePdf(selected!, true)} onClosePdf={() => { URL.revokeObjectURL(pdfUrl); setPdfUrl(''); setPdfMessage('') }} onReload={() => void load(true)} onSaved={() => setNotice('Pregunta guardada correctamente.')} />
}

function LoadingState() { return <div className="page-content container-fluid" role="status" aria-live="polite">Cargando…</div> }

function Breadcrumbs({ name, section, onList, onTemplate }: { name?: string; section?: string; onList?: () => void; onTemplate?: () => void }) {
  const base = location.pathname.replace(/\/plantillas(?:\/[^/]+)?\/?$/, '')
  return <nav aria-label="Migas de pan" className={styles.breadcrumb}><ol><li><a href={base || '/panel/dece'}>Panel principal</a></li>{name ? <><li><a href={`${base}/plantillas${location.search}`} onClick={event => { event.preventDefault(); onList?.() }}>Plantillas de fichas</a></li><li>{section ? <a href={location.pathname} onClick={event => { event.preventDefault(); onTemplate?.() }}>{name}</a> : <span aria-current="page">{name}</span>}</li>{section && <li aria-current="page">{section}</li>}</> : <li aria-current="page">Plantillas de fichas</li>}</ol></nav>
}

function TemplateCard({ template, index, pdfBusy, actionBusy, onOpen, onPdf, onToggleStatus }: { template: Template; index: number; pdfBusy: boolean; actionBusy: boolean; onOpen: () => void; onPdf: () => Promise<void>; onToggleStatus: () => void }) {
  const questionCount = template.questions.filter(question => (question as FormQuestion & { is_active?: boolean }).is_active !== false).length
  const sectionsCount = new Set(template.questions.map(sectionName)).size
  const retired = isTemplateRetired(template)
  const isBase = template.code === 'general' || template.code === 'authorization'
  return <article className={styles.card} style={{ animationDelay: (index * 40) + 'ms' }}>
    <div className={styles.cardTop}><span className={styles.status + ' ' + styles[template.status.toLowerCase()]}>{template.status}</span><span className={styles.date}>Actualizada {dateLabel(template.updatedAt)}</span></div>
    <h2><a href={location.pathname.replace(/\/plantillas(?:\/[^/]+)?\/?$/, '') + '/plantillas/' + template.id} className={styles.titleLink} onClick={event => { event.preventDefault(); onOpen() }}>{template.name}</a></h2>
    <p className={styles.metrics}>{questionCount} preguntas activas <span aria-hidden="true">·</span> {sectionsCount} secciones</p>
    <div className={styles.cardActions}><PdfActionButton label="Descargar PDF" generate={onPdf} disabled={pdfBusy || actionBusy || retired} className="btn btn-outline-secondary btn-sm" />{(retired || !isBase) && <button type="button" className={'btn btn-sm ' + (retired ? 'btn-outline-success' : 'btn-outline-danger')} disabled={actionBusy} onClick={onToggleStatus}>{retired ? 'Restablecer ficha' : 'Retirar ficha'}</button>}</div>
    {pdfBusy && <span className="visually-hidden" role="status" aria-live="polite">Generando PDF…</span>}
  </article>
}

function TemplateDetail({ template, search, activeSection, visibleSections, resultCount, questions, page, pageCount, busy, error, notice, pdfUrl, pdfBusy, pdfMessage, onBack, onTemplate, onSection, onSearch, onPage, onQuestion, onChangeQuestion, onPreview, onClosePdf, onReload, onSaved }: {
  template: Template; search: string; activeSection: string; visibleSections: string[]; resultCount: number; questions: Array<FormQuestion & { is_active?: boolean }>; page: number; pageCount: number; busy: boolean; error: string; notice: string; pdfUrl: string; pdfBusy: boolean; pdfMessage: string; onBack: () => void; onTemplate: () => void; onSection: (value: string) => void; onSearch: (value: string) => void; onPage: (value: number) => void; onQuestion: () => void; onChangeQuestion: (question: FormQuestion & { is_active?: boolean }) => void; onPreview: () => void; onClosePdf: () => void; onReload: () => void; onSaved: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [dialogError, setDialogError] = useState('')
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [label, setLabel] = useState(''); const [section, setSection] = useState('General'); const [type, setType] = useState<QuestionType>('text'); const [required, setRequired] = useState(false); const [format, setFormat] = useState<QuestionValidation['format'] | ''>(''); const [min, setMin] = useState(''); const [max, setMax] = useState(''); const [integer, setInteger] = useState(false); const [options, setOptions] = useState('')
  const integration = useDeceData(); const service = integration ? createDeceFormService(integration.client) : null
  const closeQuestion = () => { setDialogOpen(false); setLabel(''); setOptions(''); setDialogError('') }
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleSections.length) % visibleSections.length; onSection(visibleSections[next]); window.setTimeout(() => tabRefs.current[next]?.focus(), 0) } }
  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!service || !template.versionId || !label.trim()) return
    if (min && max && Number(min) > Number(max)) { setDialogError('El valor mínimo no puede ser mayor que el máximo.'); return }
    setDialogError(''); setSavingQuestion(true)
    try {
      await service.addQuestion(template.versionId, { code: `custom_${crypto.randomUUID()}`, label: label.trim(), help_text: null, data_type: type, is_required: required, display_config: { section: section.trim() || 'General', validation: { ...(type === 'text' && format ? { format } : {}), ...(type === 'number' && min ? { min: Number(min) } : {}), ...(type === 'number' && max ? { max: Number(max) } : {}), ...(type === 'number' && integer ? { integer: true } : {}) } } }, ['single_select', 'multi_select'].includes(type) ? options.split('\n') : [])
      closeQuestion(); onReload(); onSaved()
    } catch (cause) { setDialogError(userError(cause, 'No se pudo guardar la pregunta. El texto sigue disponible para reintentar.')) }
    finally { setSavingQuestion(false) }
  }
  return <div className={`page-content container-fluid ${styles.page} ${styles.detail}`}>
    <Breadcrumbs name={template.name} section={search ? 'Resultados de búsqueda' : activeSection} onList={onBack} onTemplate={onTemplate} />
    <header className={styles.detailHeader}><div><span className={`${styles.status} ${styles[template.status.toLowerCase()]}`}>{template.status}</span><h1>{template.name}</h1><p>{template.questions.filter(item => (item as FormQuestion & { is_active?: boolean }).is_active !== false).length} preguntas activas · {new Set(template.questions.map(sectionName)).size} secciones · Actualizada {dateLabel(template.updatedAt)}</p></div><div className={styles.actions}><button type="button" className="btn btn-outline-secondary" disabled={pdfBusy || isTemplateRetired(template)} onClick={onPreview}>{pdfBusy ? 'Generando…' : 'Vista PDF'}</button><button type="button" className="btn btn-primary" onClick={() => { onQuestion(); setSection(activeSection || 'General'); setDialogOpen(true) }}>Crear pregunta</button></div></header>
    {error && <div className="notice" role="alert">{error}</div>}
    {notice && <div className="notice" role="status" aria-live="polite">{notice}</div>}
    <div className={styles.search}><label htmlFor="question-search">Buscar pregunta</label><input id="question-search" className="form-control" value={search} onChange={event => onSearch(event.target.value)} placeholder="Escribe parte del texto" /></div>
    {!search && <div className={styles.tabs} role="tablist" aria-label="Secciones de la ficha">{visibleSections.map((sectionName, index) => <button id={`section-tab-${index}`} aria-controls="section-questions" ref={element => { tabRefs.current[index] = element }} type="button" key={sectionName} role="tab" aria-selected={sectionName === activeSection} tabIndex={sectionName === activeSection ? 0 : -1} onKeyDown={event => handleKey(event, index)} onClick={() => onSection(sectionName)}>{sectionName}</button>)}</div>}
    {search && <p role="status" aria-live="polite">{resultCount} resultados. La búsqueda incluye todas las secciones.</p>}
    <div id="section-questions" role="tabpanel" aria-labelledby={!search ? `section-tab-${visibleSections.indexOf(activeSection)}` : undefined}><QuestionList questions={questions} busy={busy} searching={Boolean(search)} onChange={onChangeQuestion} /></div>
    <nav className={styles.pagination} aria-label="Paginación de preguntas"><button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button><span>Página {page} de {pageCount}</span><button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Siguiente</button></nav>
    <span className="visually-hidden" role="status" aria-live="polite">{pdfMessage}</span>
    {pdfMessage && !pdfBusy && !pdfMessage.includes('correctamente') && !pdfMessage.includes('lista') && <p className="alert alert-danger" role="alert">{pdfMessage}</p>}
    {dialogOpen && <TemplateDialog title="Crear pregunta" onClose={closeQuestion}><form onSubmit={event => void saveQuestion(event)} className={styles.questionForm}>{dialogError && <p className="alert alert-danger" role="alert">{dialogError}</p>}<label className="form-label">Texto de la pregunta<input autoFocus required className="form-control" value={label} onChange={event => setLabel(event.target.value)} /></label><label className="form-label">Tipo<select className="form-select" value={type} onChange={event => setType(event.target.value as QuestionType)}>{questionTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="form-label">Sección<input className="form-control" value={section} onChange={event => setSection(event.target.value)} /></label><label className="form-check"><input className="form-check-input" type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} /><span className="form-check-label">Respuesta obligatoria</span></label>{type === 'text' && <label className="form-label">Validación<select className="form-select" value={format} onChange={event => setFormat(event.target.value as QuestionValidation['format'] | '')}><option value="">Sin restricción</option><option value="phone">Teléfono</option><option value="email">Correo electrónico</option><option value="national_id">Cédula</option></select></label>}{type === 'number' && <div className="row g-2"><label className="col form-label">Mínimo<input className="form-control" type="number" value={min} onChange={event => setMin(event.target.value)} /></label><label className="col form-label">Máximo<input className="form-control" type="number" value={max} onChange={event => setMax(event.target.value)} /></label><label className="col-12 form-check"><input className="form-check-input" type="checkbox" checked={integer} onChange={event => setInteger(event.target.checked)} /><span className="form-check-label">Solo enteros</span></label></div>}{['single_select', 'multi_select'].includes(type) && <label className="form-label">Opciones, una por línea<textarea className="form-control" required value={options} onChange={event => setOptions(event.target.value)} /></label>}<div className="d-flex justify-content-end gap-2"><button type="button" className="btn btn-outline-secondary" onClick={closeQuestion}>Cancelar</button><button className="btn btn-primary" disabled={savingQuestion}>{savingQuestion ? 'Guardando…' : 'Guardar pregunta'}</button></div></form></TemplateDialog>}
    {pdfUrl && <TemplateDialog title="Vista PDF" onClose={onClosePdf}><div className={styles.pdfFrame}><iframe title={`Vista previa de ${template.name}`} src={pdfUrl} /></div><div className="d-flex flex-wrap justify-content-between gap-2 mt-3"><a className="btn btn-outline-secondary" href={pdfUrl} target="_blank" rel="noreferrer">Abrir en una pestaña nueva</a><a className="btn btn-primary" href={pdfUrl} download={`ficha-${template.code}.pdf`}>Descargar</a></div></TemplateDialog>}
  </div>
}

function QuestionList({ questions, busy, searching, onChange }: { questions: Array<FormQuestion & { is_active?: boolean }>; busy: boolean; searching: boolean; onChange: (question: FormQuestion & { is_active?: boolean }) => void }) {
  if (!questions.length) return <section className={styles.empty}><h2>{searching ? 'Sin resultados' : 'Esta sección no tiene preguntas'}</h2><p>{searching ? 'Prueba con otra búsqueda.' : 'Puedes agregar preguntas a esta sección.'}</p></section>
  return <div className={styles.questionList}>{questions.map(question => <article className={styles.question} key={question.form_question_id}><div className={styles.questionTitle}><h2>{question.label}</h2><p>{sectionName(question)} · {questionTypes.find(item => item.value === question.data_type)?.label ?? question.data_type} · {question.is_required ? 'Obligatoria' : 'Opcional'} · {question.is_active === false ? 'Inactiva' : 'Activa'}{question.is_system && ' · Del sistema'}</p></div>{!question.is_system && <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => onChange(question)}>{question.is_active === false ? 'Activar' : 'Desactivar'}</button>}</article>)}</div>
}

function TemplateDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  useEffect(() => { dialog.current?.showModal(); return () => { if (dialog.current?.open) dialog.current.close() } }, [])
  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    const rect = dialog.current?.getBoundingClientRect()
    if (!rect) return
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag.current || !dialog.current) return
    const rect = dialog.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, drag.current.left + event.clientX - drag.current.x))
    const top = Math.max(8, Math.min(window.innerHeight - rect.height - 8, drag.current.top + event.clientY - drag.current.y))
    dialog.current.style.margin = '0'
    dialog.current.style.left = left + 'px'
    dialog.current.style.top = top + 'px'
  }
  const endDrag = () => { drag.current = null }
  return <dialog ref={dialog} className={styles.dialog} aria-label={title} onCancel={event => { event.preventDefault(); onClose() }}><header onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><h2>{title}</h2><button type="button" className={styles.close} aria-label="Cerrar" onClick={onClose}>×</button></header>{children}</dialog>
}
