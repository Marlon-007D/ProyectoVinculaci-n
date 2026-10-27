import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { Student } from '../types'
import { useDeceData } from '../services/dece-data-context'
import { createDeceFormService } from '../services/form-service'
import styles from './form-submissions-page.module.css'

type Status = 'draft' | 'submitted' | 'reviewed'
type Row = { id: string; student: Student; form: { id: string; code: string; name: string; version: number }; status: Status; updatedAt: string; reviewedAt: string | null; disabled: boolean; previous: boolean }
type Order = 'student' | 'form' | 'status' | 'date'
type View = 'table' | 'cards'
const PAGE_SIZES = [10, 20, 30, 40]
const STORAGE_KEY = 'dece.submissions.preferences'
const CONFIRM_DELAY_SECONDS = 3
const statusText: Record<Status, string> = { draft: 'Borrador', submitted: 'Enviada', reviewed: 'Revisada' }

function readPreferences() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as { size?: number; view?: View } } catch { return {} }
}
function readQuery() {
  const params = new URLSearchParams(location.search)
  const size = Number(params.get('tam'))
  const page = Number(params.get('pagina'))
  const order = params.get('orden')
  const view = params.get('vista')
  const group = params.get('agrupar')
  const direction = params.get('dir')
  const state = params.get('estado')
  return {
    form: params.get('ficha') || 'all', state: state === 'draft' || state === 'submitted' || state === 'reviewed' ? state : 'all', includeDisabled: params.get('deshabilitadas') === 'true', includePrevious: params.get('anteriores') === '1',
    order: (['student', 'form', 'status', 'date'].includes(order || '') ? order : 'date') as Order,
    direction: direction === 'asc' || direction === 'desc' ? direction : 'desc', group: group === 'student' || group === 'form' ? group : 'none',
    view: view === 'table' || view === 'cards' ? view : (readPreferences().view || (window.matchMedia('(max-width: 700px)').matches ? 'cards' : 'table')), page: Number.isInteger(page) && page > 0 ? page : 1,
    size: PAGE_SIZES.includes(size) ? size : PAGE_SIZES.includes(readPreferences().size || 10) ? readPreferences().size! : 10,
  }
}

export default function FormSubmissionsPage({ onOpen }: { onOpen: (student: Student, code: string, submissionId: string, readOnly?: boolean) => void }) {
  const integration = useDeceData()
  const service = useMemo(() => integration ? createDeceFormService(integration.client) : null, [integration?.client])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [query, setQuery] = useState(readQuery)
  const [busyId, setBusyId] = useState('')

  const updateQuery = useCallback((patch: Partial<typeof query>, resetPage = false) => {
    setQuery(current => {
      const next = { ...current, ...patch, ...(resetPage ? { page: 1 } : {}) }
      const params = new URLSearchParams()
      if (next.form !== 'all') params.set('ficha', next.form)
      if (next.state !== 'all') params.set('estado', next.state)
      if (next.includeDisabled) params.set('deshabilitadas', 'true')
      if (next.includePrevious) params.set('anteriores', '1')
      if (next.order !== 'date') params.set('orden', next.order)
      if (next.direction !== 'desc') params.set('dir', next.direction)
      if (next.group !== 'none') params.set('agrupar', next.group)
      params.set('vista', next.view); params.set('pagina', String(next.page)); params.set('tam', String(next.size))
      history.replaceState(history.state, '', `${location.pathname}?${params.toString()}`)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ size: next.size, view: next.view }))
      return next
    })
  }, [])

  useEffect(() => {
    const onPop = () => setQuery(readQuery())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    let live = true
    async function load() {
      if (!integration) return
      setLoading(true); setError('')
      try {
        const { data: definitionRows, error: definitionsError } = await integration.client.from('form_definitions')
          .select('form_definition_id, code, name, is_active').eq('institution_id', integration.institutionId)
        if (definitionsError) throw definitionsError
        const definitions = definitionRows ?? []
        const ids = definitions.map(item => item.form_definition_id)
        if (!ids.length) { if (live) setRows([]); return }
        const { data: versionRows, error: versionsError } = await integration.client.from('form_versions')
          .select('form_version_id, form_definition_id, version_number, status').in('form_definition_id', ids)
        if (versionsError) throw versionsError
        const versions = (versionRows ?? []) as Array<{ form_version_id: string; form_definition_id: string; version_number: number; status: string }>
        if (!versions.length) { if (live) setRows([]); return }
        const versionIds = versions.map(item => item.form_version_id)
        const { data: submissionRows, error: submissionError } = await integration.client.from('form_submissions')
          .select('form_submission_id, student_id, form_version_id, status, updated_at').in('form_version_id', versionIds).order('updated_at', { ascending: false })
        if (submissionError) throw submissionError
        const submissions = (submissionRows ?? []) as Array<{ form_submission_id: string; student_id: string; form_version_id: string; status: Status; updated_at: string }>
        if (!submissions.length) { if (live) setRows([]); return }
        const studentIds = [...new Set(submissions.map(item => item.student_id))]
        const { data: studentRows, error: studentsError } = await integration.client.from('students')
          .select('student_id, institution_id, national_id, first_name, last_name, grade_level').eq('institution_id', integration.institutionId).in('student_id', studentIds)
        if (studentsError) throw studentsError
        const students = new Map((studentRows ?? []).map(item => [item.student_id, item]))
        const definitionMap = new Map(definitions.map(item => [item.form_definition_id, item]))
        const versionMap = new Map(versions.map(item => [item.form_version_id, item]))
        const currentVersionByDefinition = new Map<string, typeof versions[number]>()
        for (const definition of definitions) {
          const formVersions = versions.filter(version => version.form_definition_id === definition.form_definition_id)
          const published = formVersions.filter(version => version.status === 'published')
          const latest = [...(published.length ? published : formVersions)].sort((a, b) => b.version_number - a.version_number)[0]
          if (latest) currentVersionByDefinition.set(definition.form_definition_id, latest)
        }
        const latestSubmissionByVersion = new Map<string, typeof submissions[number]>()
        for (const item of submissions) {
          const key = `${item.student_id}:${item.form_version_id}`
          const previousSubmission = latestSubmissionByVersion.get(key)
          if (!previousSubmission || item.updated_at > previousSubmission.updated_at) latestSubmissionByVersion.set(key, item)
        }
        const mapped = [...latestSubmissionByVersion.values()].flatMap(item => {
          const studentRow = students.get(item.student_id), version = versionMap.get(item.form_version_id)
          const definition = version && definitionMap.get(version.form_definition_id)
          if (!studentRow || !version || !definition) return []
          const currentVersion = currentVersionByDefinition.get(definition.form_definition_id)
          if (!currentVersion) return []
          const previous = currentVersion.form_version_id !== version.form_version_id
          const student: Student = { recordId: studentRow.student_id, id: studentRow.national_id ?? 'Sin identificación', name: `${studentRow.last_name} ${studentRow.first_name}`.trim(), firstName: studentRow.first_name, lastName: studentRow.last_name, grade: studentRow.grade_level ?? 'Sin grado', initials: `${studentRow.first_name} ${studentRow.last_name}`.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(), color: 'lavender' }
          return [{ id: item.form_submission_id, student, form: { id: definition.form_definition_id, code: definition.code, name: definition.name, version: version.version_number }, status: item.status, updatedAt: item.updated_at, reviewedAt: item.status === 'reviewed' ? item.updated_at : null, disabled: definition.is_active === false, previous }]
        })
        if (live) setRows(mapped)
      } catch (cause) {
        const issue = cause as { message?: string; code?: string }
        if (live) { setRows([]); setError(issue.code === '42501' ? 'No tienes permiso para consultar los envíos de esta institución (42501).' : `No se pudieron cargar las fichas. ${issue.message ?? ''}${issue.code ? ` (${issue.code})` : ''}`) }
      } finally { if (live) setLoading(false) }
    }
    void load()
    return () => { live = false }
  }, [integration])

  const enabledRows = useMemo(() => rows.filter(row => (query.includeDisabled || !row.disabled) && (query.includePrevious || !row.previous)), [rows, query.includeDisabled, query.includePrevious])
  const forms = useMemo(() => Array.from(new Map(enabledRows.map(row => [row.form.id, row.form])).values()), [enabledRows])
  const filtered = useMemo(() => enabledRows.filter(row => (query.form === 'all' || row.form.id === query.form) && (query.state === 'all' || row.status === query.state)), [enabledRows, query])
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let result = 0
    if (query.order === 'student') result = `${a.student.lastName} ${a.student.firstName}`.localeCompare(`${b.student.lastName} ${b.student.firstName}`, 'es')
    else if (query.order === 'form') result = a.form.name.localeCompare(b.form.name, 'es')
    else if (query.order === 'status') result = statusText[a.status].localeCompare(statusText[b.status], 'es')
    else result = a.updatedAt.localeCompare(b.updatedAt)
    return query.direction === 'asc' ? result : -result
  }), [filtered, query.order, query.direction])
  const pageCount = Math.max(1, Math.ceil(sorted.length / query.size))
  const page = Math.min(query.page, pageCount)
  const pageRows = sorted.slice((page - 1) * query.size, page * query.size)
  const from = sorted.length ? (page - 1) * query.size + 1 : 0
  const to = Math.min(page * query.size, sorted.length)
  const grouped = useMemo(() => {
    if (query.group === 'none') return [{ label: '', rows: pageRows }]
    const map = new Map<string, Row[]>()
    pageRows.forEach(row => { const label = query.group === 'student' ? row.student.name : row.form.name; map.set(label, [...(map.get(label) ?? []), row]) })
    return [...map].map(([label, rows]) => ({ label, rows }))
  }, [pageRows, query.group])

  async function reopen(row: Row) {
    if (row.previous) return
    const { default: Swal } = await import('sweetalert2')
    let seconds = CONFIRM_DELAY_SECONDS
    let interval = 0
    const result = await Swal.fire({ title: '¿Abrir la ficha para edición?', text: `La ficha de ${row.student.name} volverá a borrador y el estudiante o el DECE podrán modificar sus respuestas.`, icon: 'warning', showCancelButton: true, focusCancel: true, confirmButtonText: `Confirmar (${seconds})`, cancelButtonText: 'Cancelar', confirmButtonColor: 'var(--dece-primary, #6750a4)', cancelButtonColor: 'var(--dece-surface-variant, #e8e5ed)', customClass: { popup: 'dece-alert-popup', title: 'dece-alert-title', htmlContainer: 'dece-alert-text', confirmButton: 'dece-alert-confirm', cancelButton: 'dece-alert-cancel' }, buttonsStyling: false, allowOutsideClick: true, allowEscapeKey: true, didOpen: popup => { const button = Swal.getConfirmButton(); if (button) button.disabled = true; interval = window.setInterval(() => { seconds -= 1; if (seconds <= 0) { window.clearInterval(interval); if (button) { button.disabled = false; button.textContent = 'Confirmar' } } else if (button) button.textContent = `Confirmar (${seconds})` }, 1000); popup.querySelector<HTMLElement>('.swal2-cancel')?.focus() }, willClose: () => window.clearInterval(interval), preConfirm: () => seconds > 0 ? false : undefined })
    if (!result.isConfirmed || !service) return
    setBusyId(row.id); setAnnouncement('Abriendo ficha…')
    Swal.fire({ title: 'Abriendo…', text: 'Se está actualizando el estado de la ficha.', allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, customClass: { popup: 'dece-alert-popup', title: 'dece-alert-title', htmlContainer: 'dece-alert-text' }, didOpen: () => Swal.showLoading() })
    try {
      await service.reopenSubmission(row.id)
      setRows(current => current.map(item => item.id === row.id ? { ...item, status: 'draft', updatedAt: new Date().toISOString(), reviewedAt: null } : item))
      setAnnouncement(`La ficha de ${row.student.name} volvió a borrador.`)
      await Swal.close()
    } catch (cause) {
      const issue = cause as { message?: string; code?: string }
      const message = issue.code === '42501' ? 'No tienes permiso para reabrir esta ficha (42501).' : issue.message ?? 'No se pudo reabrir la ficha.'
      setAnnouncement(message); await Swal.fire({ title: 'No se pudo abrir la ficha', text: message, confirmButtonText: 'Aceptar', customClass: { popup: 'dece-alert-popup', title: 'dece-alert-title', htmlContainer: 'dece-alert-text' } })
    } finally { setBusyId('') }
  }

  const renderActions = (row: Row) => <div className={styles.actions}><button type="button" className="btn btn-primary btn-sm" onClick={() => onOpen(row.student, row.form.code, row.id, row.previous)}>Revisar ficha</button>{!row.previous && <span><button type="button" className="btn btn-outline-secondary btn-sm" disabled={row.status === 'draft' || busyId === row.id} onClick={() => void reopen(row)}>Abrir para edición</button>{row.status === 'draft' && <small>Ya está abierta para edición</small>}</span>}</div>

  return <main className={`page-content container-fluid ${styles.page}`}>
    <div className="eyebrow">GESTIÓN DECE</div><div className="welcome-row list-title"><div><h1>Revisión de fichas</h1><p className="subheading">Consulta respuestas, revisa su estado y gestiona la edición.</p></div><div className="record-total"><b>{filtered.length}</b> envíos</div></div>
    <p className="visually-hidden" role="status" aria-live="polite">{announcement || `Mostrando ${from} a ${to} de ${sorted.length}`}</p>
    {loading && <p role="status" aria-live="polite">Cargando…</p>}{error && <div className="notice sensitive" role="alert">{error}</div>}
    {!loading && !error && <>
      <section className={styles.filters} aria-label="Filtros de fichas">
        <label>Tipo de ficha<select className="form-select" value={query.form} onChange={event => updateQuery({ form: event.target.value }, true)}><option value="all">Todas las fichas</option>{forms.map(form => <option key={form.id} value={form.id}>{form.name}</option>)}</select></label>
        <label>Estado<select className="form-select" value={query.state} onChange={event => updateQuery({ state: event.target.value as typeof query.state }, true)}><option value="all">Todos</option><option value="draft">Borrador</option><option value="submitted">Enviada</option><option value="reviewed">Revisada</option></select></label>
        <label className={styles.check}><input type="checkbox" checked={query.includeDisabled} onChange={event => updateQuery({ includeDisabled: event.target.checked }, true)} /> Ver fichas deshabilitadas</label>
        <label className={styles.check}><input type="checkbox" checked={query.includePrevious} onChange={event => updateQuery({ includePrevious: event.target.checked }, true)} /> Ver versiones anteriores</label>
        <span role="status" className={styles.queryStatus}>{query.includePrevious ? 'Se muestran versiones anteriores' : 'Se muestra solo la versión más reciente'}</span>
        <label>Ordenar por<select className="form-select" value={query.order} onChange={event => updateQuery({ order: event.target.value as Order }, true)}><option value="student">Estudiante</option><option value="form">Ficha</option><option value="status">Estado</option><option value="date">Fecha</option></select></label>
        <label>Dirección<select className="form-select" value={query.direction} onChange={event => updateQuery({ direction: event.target.value as 'asc' | 'desc' }, true)}><option value="asc">Ascendente</option><option value="desc">Descendente</option></select></label>
        <label>Agrupar por<select className="form-select" value={query.group} onChange={event => updateQuery({ group: event.target.value as typeof query.group }, true)}><option value="none">Sin agrupar</option><option value="student">Estudiante</option><option value="form">Ficha</option></select></label>
        <div className={styles.segment} role="group" aria-label="Vista de resultados"><button type="button" aria-pressed={query.view === 'table'} onClick={() => updateQuery({ view: 'table' })}>Tabla</button><button type="button" aria-pressed={query.view === 'cards'} onClick={() => updateQuery({ view: 'cards' })}>Tarjetas</button></div>
        <button type="button" className="btn btn-outline-secondary" onClick={() => updateQuery({ form: 'all', state: 'all', includeDisabled: false, includePrevious: false, order: 'date', direction: 'desc', group: 'none', page: 1 }, true)}>Limpiar filtros</button>
      </section>
      {rows.length === 0 ? <div className="empty-state">Todavía no hay envíos de fichas.</div> : sorted.length === 0 ? <div className="empty-state">No hay envíos que coincidan con estos filtros.</div> : <>
        {query.view === 'table' ? <div className={styles.tableWrap}><table className="table"><caption className="visually-hidden">Fichas para revisión</caption><thead><tr>{(['student', 'form', 'status', 'date'] as const).map((column, index) => { const label = ['Estudiante', 'Ficha', 'Estado', 'Fecha'][index]; const active = query.order === column; return <th key={column} aria-sort={active ? (query.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => updateQuery({ order: column, direction: active && query.direction === 'asc' ? 'desc' : 'asc' }, true)}>{label}</button></th> })}<th>Acciones</th></tr></thead><tbody>{grouped.map(group => <Fragment key={group.label}>{group.label && <tr className={styles.group}><th colSpan={5} scope="colgroup">{group.label} · {group.rows.length} envíos</th></tr>}{group.rows.map(row => <tr key={row.id}><td><strong>{row.student.name}</strong><small>{row.student.grade} · {row.student.id}</small></td><td>{row.form.name}{row.previous && <span className={styles.previous}>Versión anterior (v{row.form.version})</span>}{row.disabled && <span className={styles.disabled}>Ficha deshabilitada</span>}</td><td>{statusText[row.status]}</td><td><time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleString('es-EC')}</time></td><td>{renderActions(row)}</td></tr>)}</Fragment>)}</tbody></table></div> : <ul className={styles.cards}>{grouped.flatMap(group => [group.label ? <li className={styles.groupHeading} key={`g-${group.label}`}>{group.label} · {group.rows.length} envíos</li> : null, ...group.rows.map(row => <li key={row.id}><article><div className={styles.cardHead}><span className={styles.initials}>{row.student.initials}</span><div><h2>{row.student.name}</h2><p>{row.student.grade}</p></div></div><p><b>Ficha:</b> {row.form.name}{row.previous && <span className={styles.previous}>Versión anterior (v{row.form.version})</span>}</p>{row.disabled && <p className={styles.disabled}>Ficha deshabilitada</p>}<p><b>Estado:</b> {statusText[row.status]}</p><p><b>Envío:</b> <time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleString('es-EC')}</time></p><p><b>Revisión:</b> {row.reviewedAt ? new Date(row.reviewedAt).toLocaleString('es-EC') : 'Pendiente'}</p>{renderActions(row)}</article></li>)])}</ul>}
        <div className={styles.pagination}><label>Mostrar <select className="form-select" value={query.size} onChange={event => updateQuery({ size: Number(event.target.value), page: 1 })}>{PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select> por página</label><span>Mostrando {from} a {to} de {sorted.length}</span><nav aria-label="Paginación"><button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => updateQuery({ page: page - 1 })}>Anterior</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button key={number} className="btn btn-sm" aria-current={number === page ? 'page' : undefined} onClick={() => updateQuery({ page: number })}>{number}</button>)}<button className="btn btn-outline-secondary btn-sm" disabled={page >= pageCount} onClick={() => updateQuery({ page: page + 1 })}>Siguiente</button></nav></div>
      </>}
    </>}
  </main>
}
