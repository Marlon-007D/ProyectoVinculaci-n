import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { useDeceData } from '../services/dece-data-context'
import PdfActionButton from '../components/pdf-action-button'
import CaseDocuments from '../components/case-documents'

const categories = { physical: 'Física', psychological: 'Psicológica', social: 'Social', family: 'Familiar', academic: 'Académica', behavioral: 'Conductual', other: 'Otra' } as const
const risks = { low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Crítico' } as const
const statuses = { registered: 'Registrado', in_progress: 'En atención', under_monitoring: 'En seguimiento', closed: 'Cerrado' } as const
const confidentiality = { restricted: 'Restringido', highly_restricted: 'Altamente restringido' } as const
type CaseRow = { dece_case_id: string; institution_id: string; student_id: string; case_number: string; reason: string; primary_category: keyof typeof categories; risk_level: keyof typeof risks; confidentiality_level: keyof typeof confidentiality; status: keyof typeof statuses; updated_at: string }
type StudentRow = { student_id: string; first_name: string; last_name: string; national_id: string | null }
type Fields = Pick<CaseRow, 'reason' | 'primary_category' | 'risk_level' | 'confidentiality_level' | 'status'>
const empty: Fields = { reason: '', primary_category: 'other', risk_level: 'low', confidentiality_level: 'restricted', status: 'registered' }
const label = (value: string, map: Record<string, string>) => map[value] ?? value
const safeSearch = (value: string) => value.normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, ' ')
function dayAfterGuayaquilDate(isoDate: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(isoDate))
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return new Date(Date.UTC(Number(date.year), Number(date.month) - 1, Number(date.day) + 1)).toISOString().slice(0, 10)
}
const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3200, timerProgressBar: true })
function getCaseRouteId() {
  const segments = location.pathname.split('/').filter(Boolean)
  const casesIndex = segments.indexOf('casos')
  return casesIndex >= 0 ? segments[casesIndex + 1] ?? '' : ''
}
async function bestEffortAudit(client: SupabaseClient, institutionId: string, profileId: string | undefined, action: string, entityType: string, entityId: string, fields: string[], status?: { old: string; new: string }) {
  if (!profileId) return false
  try {
    const { error } = await client.from('audit_events').insert({ institution_id: institutionId, profile_id: profileId, action, entity_type: entityType, entity_id: entityId, payload: { changed_fields: fields, ...(status ? { status } : {}) } })
    return !error
  } catch { return false }
}

export default function CasesPage({ initialStudentId = '', onInitialStudentUsed }: { initialStudentId?: string; onInitialStudentUsed?: () => void }) {
  const integration = useDeceData()
  const [rows, setRows] = useState<CaseRow[]>([])
  const [students, setStudents] = useState<Record<string, StudentRow>>({})
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentRow[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null)
  const [studentSelectionError, setStudentSelectionError] = useState('')
  const [form, setForm] = useState<Fields>(empty)
  const [selected, setSelected] = useState<CaseRow | null>(null)
  const [detailStudent, setDetailStudent] = useState<StudentRow | null>(null)
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState<keyof typeof categories>('other')
  const [risk, setRisk] = useState<keyof typeof risks>('low')
  const [conf, setConf] = useState<keyof typeof confidentiality>('restricted')
  const [status, setStatus] = useState<keyof typeof statuses>('registered')
  const [creating, setCreating] = useState(() => new URLSearchParams(location.search).get('crear') === '1')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(0)
  const requestId = useRef(0)
  const slug = integration?.slug ?? ''
  const base = `${slug ? `/${slug}/dece` : '/panel/dece'}/casos`
  const [caseId, setCaseId] = useState(getCaseRouteId)

  useEffect(() => {
    const syncCaseRoute = () => setCaseId(getCaseRouteId())
    window.addEventListener('popstate', syncCaseRoute)
    return () => window.removeEventListener('popstate', syncCaseRoute)
  }, [])

  useEffect(() => {
    if (!initialStudentId || !integration) return
    let live = true
    void integration.client.from('students').select('student_id,first_name,last_name,national_id').eq('institution_id', integration.institutionId).eq('student_id', initialStudentId).maybeSingle().then(({ data, error: queryError }) => {
      if (!live) return
      if (queryError || !data) { setError(queryError?.code === '42501' ? 'No tienes permiso para consultar este estudiante.' : 'No se pudo seleccionar el estudiante.'); onInitialStudentUsed?.(); return }
      const person = data as StudentRow
      setSelectedStudent(person); setStudentSelectionError(''); setStudents(current => ({ ...current, [person.student_id]: person })); setStudentSearch(`${person.first_name} ${person.last_name}`); setCreating(true); onInitialStudentUsed?.()
    })
    return () => { live = false }
  }, [initialStudentId, integration, onInitialStudentUsed])

  const load = useCallback(async () => {
    if (!integration) return
    const id = ++requestId.current
    const start = page * 25
    let q = integration.client.from('dece_cases').select('dece_case_id,institution_id,student_id,case_number,reason,primary_category,risk_level,confidentiality_level,status,updated_at').eq('institution_id', integration.institutionId).order('updated_at', { ascending: false }).range(start, start + 24)
    if (statusFilter) q = q.eq('status', statusFilter)
    if (riskFilter) q = q.eq('risk_level', riskFilter)
    if (query) {
      const term = safeSearch(query)
      const { data: matchingStudents } = await integration.client.from('students').select('student_id').eq('institution_id', integration.institutionId).or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
      const ids = (matchingStudents ?? []).map(row => row.student_id)
      q = q.or(ids.length ? `case_number.ilike.%${term}%,student_id.in.(${ids.join(',')})` : `case_number.ilike.%${term}%`)
    }
    const { data, error: queryError } = await q
    if (id !== requestId.current) return
    if (queryError) { setError(queryError.code === '42501' ? 'No tienes permiso para consultar casos de esta institución.' : 'No se pudo cargar el listado de casos.'); return }
    const cases = (data ?? []) as CaseRow[]
    setRows(cases)
    if (!cases.length && page === 0 && !query && !statusFilter && !riskFilter) { setError('No hay casos visibles en esta institución. Verifica tu permiso DECE o registra el primer caso.'); return }
    setError('')
    const ids = [...new Set(cases.map(row => row.student_id))]
    if (ids.length) {
      const { data: people } = await integration.client.from('students').select('student_id,first_name,last_name,national_id').eq('institution_id', integration.institutionId).in('student_id', ids)
      if (id === requestId.current) setStudents(Object.fromEntries(((people ?? []) as StudentRow[]).map(student => [student.student_id, student])))
    }
  }, [integration, page, query, riskFilter, statusFilter])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!integration || !caseId) { setSelected(null); return }
    let live = true
    void integration.client.from('dece_cases').select('dece_case_id,institution_id,student_id,case_number,reason,primary_category,risk_level,confidentiality_level,status,updated_at').eq('institution_id', integration.institutionId).eq('dece_case_id', caseId).maybeSingle().then(async ({ data, error: queryError }) => {
      if (!live) return
      if (queryError || !data) { setSelected(null); setError(queryError?.code === '42501' || !data ? 'No tienes permiso para consultar este caso o no existe en esta institución.' : 'No se pudo cargar el caso.'); return }
      const row = data as CaseRow
      setSelected(row); setReason(row.reason); setCategory(row.primary_category); setRisk(row.risk_level); setConf(row.confidentiality_level); setStatus(row.status); setError('')
      const { data: person } = await integration.client.from('students').select('student_id,first_name,last_name,national_id').eq('institution_id', integration.institutionId).eq('student_id', row.student_id).maybeSingle()
      if (live && person) setDetailStudent(person as StudentRow)
    })
    return () => { live = false }
  }, [integration, caseId])

  useEffect(() => {
    if (!integration || !studentSearch.trim()) { setStudentResults([]); return }
    let live = true
    const timer = window.setTimeout(async () => {
      const term = safeSearch(studentSearch)
      if (!term) return
      const { data, error: e } = await integration.client.from('students').select('student_id,first_name,last_name,national_id').eq('institution_id', integration.institutionId).or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,national_id.ilike.%${term}%`).order('last_name').limit(10)
      if (live) { setStudentResults((data ?? []) as StudentRow[]); if (e) setError(e.code === '42501' ? 'No tienes permiso para consultar estudiantes.' : 'No se pudo buscar estudiantes.') }
    }, 300)
    return () => { live = false; clearTimeout(timer) }
  }, [integration, studentSearch])

  async function audit(action: string, entityType: string, entityId: string, fields: string[], stateChange?: { old: string; new: string }) {
    if (!integration?.profileId) return false
    return bestEffortAudit(integration.client, integration.institutionId, integration.profileId, action, entityType, entityId, fields, stateChange)
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    if (!selectedStudent) { setStudentSelectionError('Selecciona el estudiante; este campo es obligatorio.'); setError('Selecciona el estudiante; este campo es obligatorio.'); void toast.fire({ icon: 'warning', title: 'Campo obligatorio', text: 'Selecciona el estudiante antes de guardar el caso.' }); return }
    if (!form.reason.trim()) { const message = 'Completa el motivo; este campo es obligatorio.'; setError(message); void toast.fire({ icon: 'warning', title: message }); return }
    if (!integration) return
    setBusy(true); setError(''); setNotice('')
    try {
      const year = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric' }).slice(0, 4)
      const prefix = `DECE-${year}-`
      const { data: existing, error: lookupError } = await integration.client.from('dece_cases').select('case_number').eq('institution_id', integration.institutionId).like('case_number', `${prefix}%`).order('case_number', { ascending: false }).limit(1)
      if (lookupError) throw lookupError
      const highest = Number((existing?.[0]?.case_number as string | undefined)?.slice(prefix.length) ?? 0)
      // La BD no tiene restricción de unicidad para case_number; se genera el siguiente número sin reintentos.
      const caseNumber = `${prefix}${String(highest + 1).padStart(4, '0')}`
      const { data, error: insertError } = await integration.client.from('dece_cases').insert({ institution_id: integration.institutionId, student_id: selectedStudent.student_id, case_number: caseNumber, reason: form.reason.trim(), primary_category: form.primary_category, risk_level: form.risk_level, confidentiality_level: form.confidentiality_level, status: form.status, opened_by: integration.profileId }).select('dece_case_id,institution_id,student_id,case_number,reason,primary_category,risk_level,confidentiality_level,status,updated_at').single()
      if (insertError) throw insertError
      window.dispatchEvent(new Event('dece:dashboard-refresh'))
      const created = data as CaseRow
      const audited = await audit('case.create', 'dece_case', created.dece_case_id, ['student_id', 'case_number', 'reason', 'primary_category', 'risk_level', 'confidentiality_level', 'status'])
      setRows(current => [created, ...current].slice(0, 25)); setStudents(current => ({ ...current, [selectedStudent.student_id]: selectedStudent })); setCreating(false); setSelectedStudent(null); setStudentSearch(''); setForm(empty)
      setNotice(audited ? 'Caso creado.' : 'Caso creado, pero no se pudo registrar la auditoría. Revisa docs/solicitudes-bd.md.')
      void toast.fire({ icon: audited ? 'success' : 'warning', title: audited ? 'Caso guardado' : 'Caso guardado; auditoría pendiente' })
    } catch (cause) { const issue = cause as { code?: string }; const message = issue.code === '42501' ? 'No tienes permiso para crear casos en esta institución.' : 'No se pudo crear el caso. Revisa los datos e inténtalo nuevamente.'; setError(message); void toast.fire({ icon: 'error', title: message }) }
    finally { setBusy(false) }
  }

  async function updateCase(event: FormEvent) {
    event.preventDefault()
    if (!integration || !selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (selected.status !== 'closed' && status === 'closed') {
        const { count, error: countError } = await integration.client.from('dece_actions').select('dece_action_id', { count: 'exact', head: true }).eq('dece_case_id', selected.dece_case_id).eq('is_completed', false)
        if (countError) throw countError
        if (count) { const warning = `No se puede cerrar: hay ${count} acción${count === 1 ? '' : 'es'} pendiente${count === 1 ? '' : 's'}.`; setError(warning); void toast.fire({ icon: 'warning', title: warning }); return }
      }
      const changed = (['reason', 'primary_category', 'risk_level', 'confidentiality_level', 'status'] as const).filter(field => selected[field] !== ({ reason: reason.trim(), primary_category: category, risk_level: risk, confidentiality_level: conf, status } as Fields)[field])
      const { data, error: updateError } = await integration.client.from('dece_cases').update({ reason: reason.trim(), primary_category: category, risk_level: risk, confidentiality_level: conf, status }).eq('institution_id', integration.institutionId).eq('dece_case_id', selected.dece_case_id).select('dece_case_id,institution_id,student_id,case_number,reason,primary_category,risk_level,confidentiality_level,status,updated_at').maybeSingle()
      if (updateError) throw updateError
      window.dispatchEvent(new Event('dece:dashboard-refresh'))
      if (!data) throw Object.assign(new Error(), { code: '42501' })
      const saved = data as CaseRow
      const audited = changed.length ? await audit('case.update', 'dece_case', saved.dece_case_id, changed) : true
      const stateAudited = selected.status === saved.status || await audit('case.status_change', 'dece_case', saved.dece_case_id, ['status'], { old: selected.status, new: saved.status })
      setSelected(saved); setRows(current => current.map(row => row.dece_case_id === saved.dece_case_id ? saved : row)); setNotice(audited && stateAudited ? 'Cambios guardados.' : 'Cambios guardados, pero no se pudo registrar la auditoría. Revisa docs/solicitudes-bd.md.')
      void toast.fire({ icon: audited && stateAudited ? 'success' : 'warning', title: audited && stateAudited ? 'Cambios guardados' : 'Cambios guardados; auditoría pendiente' })
    } catch (cause) { const message = (cause as { code?: string }).code === '42501' ? 'No tienes permiso para editar este caso.' : 'No se pudieron guardar los cambios.'; setError(message); void toast.fire({ icon: 'error', title: message }) }
    finally { setBusy(false) }
  }

  function openCase(row: CaseRow) {
    history.pushState(null, '', `${base}/${row.dece_case_id}`)
    setCaseId(row.dece_case_id)
    setSelected(row)
    setDetailStudent(students[row.student_id] ?? null)
    setReason(row.reason)
    setCategory(row.primary_category)
    setRisk(row.risk_level)
    setConf(row.confidentiality_level)
    setStatus(row.status)
    setError('')
  }
  function back() {
    history.pushState(null, '', base)
    setCaseId('')
    setSelected(null)
    setError('')
  }
  async function quickStatusChange(row: CaseRow, nextStatus: keyof typeof statuses) {
    if (!integration || row.status === nextStatus) return
    if (nextStatus === 'closed') {
      const { count, error: countError } = await integration.client.from('dece_actions').select('dece_action_id', { count: 'exact', head: true }).eq('dece_case_id', row.dece_case_id).eq('is_completed', false)
      if (countError) { const message = countError.code === '42501' ? 'No tienes permiso para verificar las acciones pendientes.' : 'No se pudo verificar si hay acciones pendientes.'; setError(message); void toast.fire({ icon: 'error', title: message }); return }
      if (count) { const message = `No se puede cerrar: hay ${count} acción${count === 1 ? '' : 'es'} pendiente${count === 1 ? '' : 's'}.`; setError(message); void toast.fire({ icon: 'warning', title: message }); return }
    }
    const { data, error: updateError } = await integration.client.from('dece_cases').update({ status: nextStatus }).eq('institution_id', integration.institutionId).eq('dece_case_id', row.dece_case_id).select('dece_case_id,institution_id,student_id,case_number,reason,primary_category,risk_level,confidentiality_level,status,updated_at').maybeSingle()
    if (updateError || !data) { const message = updateError?.code === '42501' || !data ? 'No tienes permiso para cambiar el estado de este caso.' : 'No se pudo cambiar el estado.'; setError(message); void toast.fire({ icon: 'error', title: message }); return }
    window.dispatchEvent(new Event('dece:dashboard-refresh'))
    const saved = data as CaseRow
    const audited = await audit('case.status_change', 'dece_case', saved.dece_case_id, ['status'], { old: row.status, new: nextStatus })
    setRows(current => current.map(item => item.dece_case_id === saved.dece_case_id ? saved : item))
    setSelected(current => current?.dece_case_id === saved.dece_case_id ? saved : current)
    setError(''); setNotice(audited ? 'Estado actualizado.' : 'Estado actualizado; no se pudo registrar la auditoría. Revisa docs/solicitudes-bd.md.')
    void toast.fire({ icon: audited ? 'success' : 'warning', title: audited ? 'Estado actualizado' : 'Estado actualizado; auditoría pendiente' })
  }
  const filtered = useMemo(() => rows.filter(row => !query || row.case_number.toLocaleLowerCase().includes(safeSearch(query).toLocaleLowerCase()) || `${students[row.student_id]?.first_name ?? ''} ${students[row.student_id]?.last_name ?? ''}`.toLocaleLowerCase().includes(safeSearch(query).toLocaleLowerCase())), [query, rows, students])

  return <div className="page-content container-fluid"><div className="eyebrow">GESTIÓN DECE</div><div className="welcome-row list-title"><div><h1>{selected ? `Caso ${selected.case_number}` : 'Casos de acompañamiento'}</h1><p className="subheading">Registro y seguimiento de casos de esta institución.</p></div>{selected ? <div className="d-flex gap-2"><PdfActionButton label={`Descargar PDF del caso ${selected.case_number}`} generate={async () => { const { createDecePdfService } = await import('../services/pdf-service'); await createDecePdfService(integration!.client).casePdf(integration!.institutionId, selected!.dece_case_id, integration!.profileId) }} /><button className="button btn secondary" type="button" onClick={back}>Volver a casos</button></div> : !creating && <button className="button btn primary" type="button" onClick={() => { setCreating(true); setError(''); setNotice('') }}>+ Nuevo caso</button>}</div>
    {error && <div className="notice sensitive" role="alert">{error}</div>}<div aria-live="polite" className="visually-hidden">{notice}</div>{notice && <div className="notice" role="status">{notice}</div>}
    {creating && <section className="table-card p-3 mb-4"><h2>Nuevo caso</h2><form noValidate onSubmit={event => void create(event)} className="row g-3"><div className="col-12"><label className="form-label" htmlFor="case-student">Estudiante (obligatorio): buscar por nombre o cédula</label><input id="case-student" className="form-control" aria-required="true" aria-invalid={Boolean(studentSelectionError)} aria-describedby={studentSelectionError ? 'case-student-error' : undefined} value={studentSearch} onChange={event => { setStudentSearch(event.target.value); setSelectedStudent(null); setStudentSelectionError(''); setError('') }} autoComplete="off" />{studentResults.length > 0 && <ul className="list-group mt-2">{studentResults.map(student => <li className="list-group-item" key={student.student_id}><button type="button" className="table-link" onClick={() => { setSelectedStudent(student); setStudentSelectionError(''); setError(''); setStudentSearch(`${student.first_name} ${student.last_name}`); setStudentResults([]) }}>{student.first_name} {student.last_name} · {student.national_id ?? 'Sin cédula'}</button></li>)}</ul>}{selectedStudent && <p role="status">Seleccionado: {selectedStudent.first_name} {selectedStudent.last_name}</p>}{studentSelectionError && <p id="case-student-error" className="text-danger" role="alert">{studentSelectionError}</p>}</div><CaseFields value={form} onChange={setForm} prefix="new" /><div className="col-12"><label className="form-label" htmlFor="new-reason">Motivo (obligatorio)</label><textarea id="new-reason" className="form-control" aria-required="true" required value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /></div><div className="col-12 d-flex gap-2"><button className="btn btn-primary" disabled={busy}>Guardar caso</button><button className="btn btn-outline-secondary" type="button" onClick={() => setCreating(false)}>Cancelar</button></div></form></section>}
    {selected && <><section className="table-card p-3 mb-4"><h2>Datos del caso y del estudiante</h2><p>{detailStudent ? `${detailStudent.first_name} ${detailStudent.last_name}` : 'Estudiante'} · {selected.case_number}</p><form className="row g-3" onSubmit={event => void updateCase(event)}><CaseFields value={{ reason, primary_category: category, risk_level: risk, confidentiality_level: conf, status }} onChange={value => { setReason(value.reason); setCategory(value.primary_category); setRisk(value.risk_level); setConf(value.confidentiality_level); setStatus(value.status) }} prefix="edit" /><div className="col-12"><label className="form-label" htmlFor="edit-reason">Motivo</label><textarea id="edit-reason" className="form-control" required value={reason} onChange={event => setReason(event.target.value)} /></div><div className="col-12"><button className="btn btn-primary" disabled={busy}>Guardar cambios</button></div></form><p className="mt-3">Categoría: {label(selected.primary_category, categories)} · Riesgo: {label(selected.risk_level, risks)} · Estado: {label(selected.status, statuses)} · Confidencialidad: {label(selected.confidentiality_level, confidentiality)}</p></section><CaseTimeline caseRow={selected} /><CaseDocuments caseId={selected.dece_case_id} caseInstitutionId={selected.institution_id} /></>}
    {!selected && !creating && <><div className="toolbar d-flex flex-wrap"><label className="search-box"><span className="visually-hidden">Buscar casos</span><input className="form-control" aria-label="Buscar por número de caso o estudiante" placeholder="Número de caso o estudiante" value={query} onChange={event => setQuery(event.target.value)} /></label><label>Estado <select className="form-select" value={statusFilter} onChange={event => { setPage(0); setStatusFilter(event.target.value) }}><option value="">Todos</option>{Object.entries(statuses).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label>Riesgo <select className="form-select" value={riskFilter} onChange={event => { setPage(0); setRiskFilter(event.target.value) }}><option value="">Todos</option>{Object.entries(risks).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label></div><div className="table-card table-responsive"><table className="table"><caption className="visually-hidden">Casos de acompañamiento de la institución</caption><thead><tr><th scope="col">Número</th><th scope="col">Estudiante</th><th scope="col">Categoría</th><th scope="col">Riesgo</th><th scope="col">Estado</th><th scope="col">Última actualización</th><th scope="col">Acceso</th></tr></thead><tbody>{filtered.map(row => <tr key={row.dece_case_id}><td>{row.case_number}</td><td>{students[row.student_id] ? `${students[row.student_id].first_name} ${students[row.student_id].last_name}` : 'Estudiante'}</td><td>{label(row.primary_category, categories)}</td><td>{label(row.risk_level, risks)}</td><td><label className="visually-hidden" htmlFor={`case-status-${row.dece_case_id}`}>Cambiar estado de {row.case_number}</label><select id={`case-status-${row.dece_case_id}`} className="form-select form-select-sm" aria-label={`Estado: ${label(row.status, statuses)}`} value={row.status} onChange={event => void quickStatusChange(row, event.target.value as keyof typeof statuses)}>{Object.entries(statuses).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></td><td>{new Date(row.updated_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</td><td><button type="button" className="table-link" onClick={() => openCase(row)}>Abrir</button></td></tr>)}</tbody></table>{!filtered.length && !error && <div className="empty-state">No se encontraron casos.</div>}<div className="d-flex justify-content-between p-3"><span>Página {page + 1}</span><span className="d-flex gap-2"><button className="btn btn-outline-secondary" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Anterior</button><button className="btn btn-outline-secondary" disabled={rows.length < 25} onClick={() => setPage(value => value + 1)}>Siguiente</button></span></div></div></>}
  </div>
}

function CaseFields({ value, onChange, prefix }: { value: Fields; onChange: (value: Fields) => void; prefix: string }) {
  return <><div className="col-md-6"><label className="form-label" htmlFor={`${prefix}-category`}>Categoría principal</label><select id={`${prefix}-category`} className="form-select" value={value.primary_category} onChange={event => onChange({ ...value, primary_category: event.target.value as Fields['primary_category'] })}>{Object.entries(categories).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div><div className="col-md-6"><label className="form-label" htmlFor={`${prefix}-risk`}>Riesgo</label><select id={`${prefix}-risk`} className="form-select" value={value.risk_level} onChange={event => onChange({ ...value, risk_level: event.target.value as Fields['risk_level'] })}>{Object.entries(risks).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div><div className="col-md-6"><label className="form-label" htmlFor={`${prefix}-conf`}>Confidencialidad</label><select id={`${prefix}-conf`} className="form-select" value={value.confidentiality_level} onChange={event => onChange({ ...value, confidentiality_level: event.target.value as Fields['confidentiality_level'] })}>{Object.entries(confidentiality).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div><div className="col-md-6"><label className="form-label" htmlFor={`${prefix}-status`}>Estado</label><select id={`${prefix}-status`} className="form-select" value={value.status} onChange={event => onChange({ ...value, status: event.target.value as Fields['status'] })}>{Object.entries(statuses).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div></>
}

function CaseTimeline({ caseRow }: { caseRow: CaseRow }) {
  const integration = useDeceData()
  const [visits, setVisits] = useState<Array<{ dece_visit_id: string; visit_date: string; summary: string; attention_notes: string | null; attended_by: string | null }>>([])
  const [actions, setActions] = useState<Array<{ dece_action_id: string; description: string; due_date: string | null; is_completed: boolean; responsible_profile_id: string | null }>>([])
  const [profileNames, setProfileNames] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState('')
  const [notes, setNotes] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [actionDescription, setActionDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([])
  const [responsible, setResponsible] = useState('')
  const [observationDraft, setObservationDraft] = useState({ category: 'other' as keyof typeof categories, description: '', severity: 'low' as keyof typeof risks, requires_follow_up: false })
  const [pendingObservations, setPendingObservations] = useState<Array<typeof observationDraft & { localId: string }>>([])
  const [failedVisitId, setFailedVisitId] = useState('')
  const [message, setMessage] = useState('')
  const firstVisit = visits.reduce<typeof visits[number] | null>((earliest, visit) => !earliest || visit.visit_date < earliest.visit_date ? visit : earliest, null)
  const minimumActionDate = firstVisit ? dayAfterGuayaquilDate(firstVisit.visit_date) : ''
  const reload = useCallback(async () => {
    if (!integration) return
    const [v, a] = await Promise.all([integration.client.from('dece_visits').select('dece_visit_id,visit_date,summary,attention_notes,attended_by').eq('dece_case_id', caseRow.dece_case_id).order('visit_date', { ascending: false }), integration.client.from('dece_actions').select('dece_action_id,description,due_date,is_completed,responsible_profile_id').eq('dece_case_id', caseRow.dece_case_id).order('due_date')])
    if (!v.error) setVisits(v.data ?? [])
    if (!a.error) setActions(a.data ?? [])
    const profileIds = [...new Set([...(v.data ?? []).map(item => item.attended_by), ...(a.data ?? []).map(item => item.responsible_profile_id)].filter((id): id is string => Boolean(id)))]
    if (profileIds.length) {
      const { data: profiles } = await integration.client.from('profiles').select('profile_id,first_name,last_name').in('profile_id', profileIds)
      if (profiles) setProfileNames(Object.fromEntries(profiles.map(profile => [profile.profile_id, `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()])))
    }
  }, [caseRow.dece_case_id, integration])
  useEffect(() => { void reload() }, [reload])
  useEffect(() => {
    if (!integration) return
    let live = true
    void integration.client.from('memberships').select('profile_id, role:roles!inner(name), profile:profiles(first_name,last_name)').eq('institution_id', integration.institutionId).eq('role.name', 'dece_staff').then(({ data }) => {
      if (!live) return
      const rows = (data ?? []) as Array<{ profile_id: string; profile: { first_name?: string; last_name?: string } | Array<{ first_name?: string; last_name?: string }> | null }>
      setStaff(rows.map(row => { const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile; return { id: row.profile_id, name: `${profile?.first_name ?? 'Equipo DECE'} ${profile?.last_name ?? ''}`.trim() } }))
    })
    return () => { live = false }
  }, [integration])
  async function saveVisit(event: FormEvent) {
    event.preventDefault(); if (!integration) return
    const date = new Date(`${visitDate}:00-05:00`)
    const { data, error } = await integration.client.from('dece_visits').insert({ dece_case_id: caseRow.dece_case_id, visit_date: date.toISOString(), summary: summary.trim(), attention_notes: notes.trim() || null, attended_by: integration.profileId }).select('dece_visit_id').single()
    if (error || !data) { const warning = error?.code === '42501' ? 'No tienes permiso para registrar visitas.' : 'No se pudo guardar la visita.'; setMessage(warning); void toast.fire({ icon: 'error', title: warning }); return }
    const audited = await bestEffortAudit(integration.client, integration.institutionId, integration.profileId, 'visit.create', 'dece_visit', data.dece_visit_id, ['visit_date', 'summary', 'attention_notes', 'attended_by'])
    setSummary(''); setNotes(''); setVisitDate('')
    const failures: typeof pendingObservations = []
    const failedNumbers: number[] = []
    for (const [index, observation] of pendingObservations.entries()) {
      const { error: observationError } = await integration.client.from('dece_observations').insert({ dece_visit_id: data.dece_visit_id, category: observation.category, description: observation.description, severity: observation.severity, requires_follow_up: observation.requires_follow_up })
      if (observationError) { failures.push(observation); failedNumbers.push(index + 1) }
      if (observationError && observationError.code === '42501') setMessage(`La visita se guardó. Falló la observación ${index + 1} por falta de permiso; puedes reintentar solo esa observación.`)
    }
    setPendingObservations(failures); setFailedVisitId(failures.length ? data.dece_visit_id : ''); setObservationDraft({ category: 'other', description: '', severity: 'low', requires_follow_up: false }); await reload(); window.dispatchEvent(new Event('dece:dashboard-refresh'))
    if (failures.length) { const warning = `La visita se guardó. Fallaron las observaciones ${failedNumbers.join(', ')}; puedes reintentar solo esas.`; setMessage(warning); void toast.fire({ icon: 'warning', title: 'Visita guardada; observaciones por reintentar' }) }
    else { setMessage(!audited ? 'Visita guardada con sus observaciones, pero falló la auditoría; revisa docs/solicitudes-bd.md.' : 'Visita y observaciones guardadas.'); void toast.fire({ icon: audited ? 'success' : 'warning', title: audited ? 'Visita guardada' : 'Visita guardada; auditoría pendiente' }) }
  }
  async function retryFailedObservations() {
    if (!integration || !failedVisitId) return
    const failures: typeof pendingObservations = []
    for (const observation of pendingObservations) {
      const { error } = await integration.client.from('dece_observations').insert({ dece_visit_id: failedVisitId, category: observation.category, description: observation.description, severity: observation.severity, requires_follow_up: observation.requires_follow_up })
      if (error) failures.push(observation)
    }
    setPendingObservations(failures); if (!failures.length) setFailedVisitId(''); await reload(); window.dispatchEvent(new Event('dece:dashboard-refresh'))
    setMessage(failures.length ? `Siguen pendientes ${failures.length} observaciones. Puedes reintentar solo estas.` : 'Observaciones pendientes guardadas.')
  }
  async function saveAction(event: FormEvent) {
    event.preventDefault(); if (!integration) return
    if (dueDate && (!minimumActionDate || dueDate < minimumActionDate)) {
      const warning = minimumActionDate ? `La fecha debe ser desde ${minimumActionDate}, al menos un día después de la primera visita.` : 'Registra primero la visita inicial para asignar una fecha a la acción.'
      setMessage(warning); void toast.fire({ icon: 'warning', title: warning }); return
    }
    const { data, error } = await integration.client.from('dece_actions').insert({ dece_case_id: caseRow.dece_case_id, description: actionDescription.trim(), due_date: dueDate || null, responsible_profile_id: responsible || null, is_completed: false }).select('dece_action_id').single()
    if (error || !data) { const warning = error?.code === '42501' ? 'No tienes permiso para registrar acciones.' : 'No se pudo guardar la acción.'; setMessage(warning); void toast.fire({ icon: 'error', title: warning }); return }
    const audited = await bestEffortAudit(integration.client, integration.institutionId, integration.profileId, 'action.create', 'dece_action', data.dece_action_id, ['description', 'due_date', 'responsible_profile_id', 'is_completed'])
    setActionDescription(''); setDueDate(''); setResponsible(''); await reload(); window.dispatchEvent(new Event('dece:dashboard-refresh')); setMessage(!audited ? 'Acción guardada, pero falló la auditoría; revisa docs/solicitudes-bd.md.' : 'Acción guardada.'); void toast.fire({ icon: audited ? 'success' : 'warning', title: audited ? 'Acción guardada' : 'Acción guardada; auditoría pendiente' })
  }
  async function toggleAction(action: typeof actions[number]) {
    if (!integration) return
    const completed = !action.is_completed
    const { error } = await integration.client.from('dece_actions').update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null }).eq('dece_case_id', caseRow.dece_case_id).eq('dece_action_id', action.dece_action_id)
    if (error) { setMessage(error.code === '42501' ? 'No tienes permiso para actualizar acciones.' : 'No se pudo actualizar la acción.'); return }
    const audited = await bestEffortAudit(integration.client, integration.institutionId, integration.profileId, 'action.update', 'dece_action', action.dece_action_id, ['is_completed', 'completed_at'])
    await reload(); window.dispatchEvent(new Event('dece:dashboard-refresh')); setMessage(!audited ? 'Acción actualizada, pero falló la auditoría; revisa docs/solicitudes-bd.md.' : 'Acción actualizada.')
  }
  async function editAction(action: typeof actions[number]) {
    if (!integration) return
    const description = window.prompt('Descripción de la acción', action.description)
    if (description === null) return
    const dueDate = window.prompt('Fecha límite (AAAA-MM-DD), vacío para quitarla', action.due_date ?? '')
    if (dueDate === null) return
    if (dueDate && (!minimumActionDate || dueDate < minimumActionDate)) { const warning = minimumActionDate ? `La fecha debe ser desde ${minimumActionDate}, al menos un día después de la primera visita.` : 'Registra primero la visita inicial para asignar una fecha a la acción.'; setMessage(warning); void toast.fire({ icon: 'warning', title: warning }); return }
    const { error } = await integration.client.from('dece_actions').update({ description: description.trim(), due_date: dueDate || null }).eq('dece_case_id', caseRow.dece_case_id).eq('dece_action_id', action.dece_action_id)
    if (error) { setMessage(error.code === '42501' ? 'No tienes permiso para editar acciones.' : 'No se pudo editar la acción.'); return }
    const audited = await bestEffortAudit(integration.client, integration.institutionId, integration.profileId, 'action.update', 'dece_action', action.dece_action_id, ['description', 'due_date'])
    await reload(); window.dispatchEvent(new Event('dece:dashboard-refresh')); setMessage(!audited ? 'Acción actualizada, pero falló la auditoría; revisa docs/solicitudes-bd.md.' : 'Acción actualizada.'); void toast.fire({ icon: audited ? 'success' : 'warning', title: audited ? 'Acción actualizada' : 'Acción actualizada; auditoría pendiente' })
  }
  async function editVisit(visit: typeof visits[number]) {
    if (!integration) return
    const nextSummary = window.prompt('Resumen de la visita', visit.summary)
    if (nextSummary === null) return
    const nextNotes = window.prompt('Notas de atención', visit.attention_notes ?? '')
    if (nextNotes === null) return
    const { error } = await integration.client.from('dece_visits').update({ summary: nextSummary.trim(), attention_notes: nextNotes.trim() || null }).eq('dece_case_id', caseRow.dece_case_id).eq('dece_visit_id', visit.dece_visit_id)
    if (error) { setMessage(error.code === '42501' ? 'No tienes permiso para editar visitas.' : 'No se pudo editar la visita.'); return }
    const audited = await bestEffortAudit(integration.client, integration.institutionId, integration.profileId, 'visit.update', 'dece_visit', visit.dece_visit_id, ['summary', 'attention_notes'])
    await reload(); window.dispatchEvent(new Event('dece:dashboard-refresh')); setMessage(!audited ? 'Visita actualizada, pero falló la auditoría; revisa docs/solicitudes-bd.md.' : 'Visita actualizada.'); void toast.fire({ icon: audited ? 'success' : 'warning', title: audited ? 'Visita actualizada' : 'Visita actualizada; auditoría pendiente' })
  }
  return <section className="table-card p-3"><h2>Visitas</h2><form onSubmit={event => void saveVisit(event)} className="row g-2 mb-4"><div className="col-md-4"><label htmlFor="visit-date" className="form-label">Fecha y hora (Ecuador)</label><input id="visit-date" className="form-control" type="datetime-local" required value={visitDate} onChange={event => setVisitDate(event.target.value)} /></div><div className="col-md-4"><label htmlFor="visit-summary" className="form-label">Resumen</label><input id="visit-summary" className="form-control" required value={summary} onChange={event => setSummary(event.target.value)} /></div><div className="col-md-4"><label htmlFor="visit-notes" className="form-label">Notas de atención</label><input id="visit-notes" className="form-control" value={notes} onChange={event => setNotes(event.target.value)} /></div><div className="col-12"><button className="btn btn-primary">Registrar visita</button></div></form><form className="row g-2 mb-3" onSubmit={event => { event.preventDefault(); if (!observationDraft.description.trim()) return; setPendingObservations(current => [...current, { ...observationDraft, description: observationDraft.description.trim(), localId: crypto.randomUUID() }]); setObservationDraft({ category: 'other', description: '', severity: 'low', requires_follow_up: false }) }}><div className="col-md-3"><label htmlFor="draft-category" className="form-label">Categoría de observación</label><select id="draft-category" className="form-select" value={observationDraft.category} onChange={event => setObservationDraft(current => ({ ...current, category: event.target.value as keyof typeof categories }))}>{Object.entries(categories).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div><div className="col-md-4"><label htmlFor="draft-description" className="form-label">Descripción de observación</label><input id="draft-description" className="form-control" required value={observationDraft.description} onChange={event => setObservationDraft(current => ({ ...current, description: event.target.value }))} /></div><div className="col-md-2"><label htmlFor="draft-severity" className="form-label">Severidad</label><select id="draft-severity" className="form-select" value={observationDraft.severity} onChange={event => setObservationDraft(current => ({ ...current, severity: event.target.value as keyof typeof risks }))}>{Object.entries(risks).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div><div className="col-md-2 align-self-center"><label><input type="checkbox" checked={observationDraft.requires_follow_up} onChange={event => setObservationDraft(current => ({ ...current, requires_follow_up: event.target.checked }))} /> Requiere seguimiento</label></div><div className="col-md-1 d-flex align-items-end"><button className="btn btn-outline-primary">Añadir</button></div></form>{pendingObservations.map((observation, index) => <p key={observation.localId}>Observación {index + 1}: {label(observation.category, categories)} · {label(observation.severity, risks)} {observation.requires_follow_up && '· Requiere seguimiento'} · {observation.description}{failedVisitId && <strong className="text-danger"> · Pendiente de reintento</strong>}</p>)}{failedVisitId && <button type="button" className="btn btn-outline-primary btn-sm mb-3" onClick={() => void retryFailedObservations()}>Reintentar solo las observaciones fallidas</button>}<div aria-live="polite" role="status">{message}</div>{visits.map(visit => <article className="border rounded p-3 mb-3" key={visit.dece_visit_id}><h3>{new Date(visit.visit_date).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</h3><p>{visit.summary}</p><p>{visit.attention_notes ?? 'Sin notas'}</p><p>Atendió: {visit.attended_by ? profileNames[visit.attended_by] || 'Personal DECE' : 'Sin responsable registrado'}</p><button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void editVisit(visit)}>Editar visita</button><ObservationPanel visitId={visit.dece_visit_id} /></article>)}<h2 className="mt-4">Acuerdos y próximas acciones</h2><form onSubmit={event => void saveAction(event)} className="row g-2 mb-3"><div className="col-md-5"><label htmlFor="action-description" className="form-label">Descripción</label><input id="action-description" required className="form-control" value={actionDescription} onChange={event => setActionDescription(event.target.value)} /></div><div className="col-md-3"><label htmlFor="action-due" className="form-label">Fecha límite (opcional)</label><input id="action-due" type="date" min={minimumActionDate || undefined} className="form-control" value={dueDate} onChange={event => setDueDate(event.target.value)} /></div><div className="col-md-3"><label htmlFor="action-responsible" className="form-label">Responsable (opcional)</label><select id="action-responsible" className="form-select" value={responsible} onChange={event => setResponsible(event.target.value)}><option value="">Sin responsable</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div><div className="col-md-1 d-flex align-items-end"><button className="btn btn-primary">Añadir</button></div></form><ul>{actions.map(action => <li key={action.dece_action_id} className="mb-2"><label><input type="checkbox" checked={action.is_completed} onChange={() => void toggleAction(action)} /> {action.description}</label>{action.responsible_profile_id && <span> · Responsable: {profileNames[action.responsible_profile_id] || 'Personal DECE'}</span>}{action.due_date && <span> · Límite: {action.due_date}</span>}{!action.is_completed && action.due_date && action.due_date < new Date().toISOString().slice(0, 10) && <strong className="text-danger"> · Vencida</strong>}{action.is_completed && <span> · Completada</span>} <button type="button" className="btn btn-link btn-sm" onClick={() => void editAction(action)}>Editar</button></li>)}</ul></section>
}

function ObservationPanel({ visitId }: { visitId: string }) {
  const integration = useDeceData()
  const [items, setItems] = useState<Array<{ dece_observation_id: string; category: keyof typeof categories; description: string; severity: keyof typeof risks; requires_follow_up: boolean }>>([])
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<keyof typeof categories>('other')
  const [severity, setSeverity] = useState<keyof typeof risks>('low')
  const [followUp, setFollowUp] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => { if (!integration) return; const { data, error: queryError } = await integration.client.from('dece_observations').select('dece_observation_id,category,description,severity,requires_follow_up').eq('dece_visit_id', visitId); if (!queryError) setItems(data ?? []); else setError(queryError.code === '42501' ? 'Sin permiso para consultar observaciones.' : 'No se pudieron consultar observaciones.') }, [integration, visitId])
  useEffect(() => { void load() }, [load])
  async function add(event: FormEvent) { event.preventDefault(); if (!integration) return; const { error: insertError } = await integration.client.from('dece_observations').insert({ dece_visit_id: visitId, category, description: description.trim(), severity, requires_follow_up: followUp }); if (insertError) { setError(insertError.code === '42501' ? 'No tienes permiso para registrar observaciones.' : 'No se pudo guardar la observación.'); return } setDescription(''); setFollowUp(false); await load() }
  async function update(item: typeof items[number], change: Partial<typeof item>) { if (!integration) return; const { error: updateError } = await integration.client.from('dece_observations').update(change).eq('dece_visit_id', visitId).eq('dece_observation_id', item.dece_observation_id); if (updateError) { setError(updateError.code === '42501' ? 'No tienes permiso para editar observaciones.' : 'No se pudo editar la observación.'); return } await load() }
  return <div className="mt-3"><h4>Observaciones</h4><form onSubmit={event => void add(event)} className="d-flex flex-wrap gap-2"><label>Categoría<select aria-label="Categoría de observación" className="form-select" value={category} onChange={event => setCategory(event.target.value as keyof typeof categories)}>{Object.entries(categories).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><label>Severidad<select aria-label="Severidad" className="form-select" value={severity} onChange={event => setSeverity(event.target.value as keyof typeof risks)}>{Object.entries(risks).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><label className="flex-grow-1">Descripción<input className="form-control" required value={description} onChange={event => setDescription(event.target.value)} /></label><label className="align-self-center"><input type="checkbox" checked={followUp} onChange={event => setFollowUp(event.target.checked)} /> Requiere seguimiento</label><button className="btn btn-outline-primary align-self-end">Agregar</button></form>{error && <p role="alert">{error}</p>}<ul>{items.map(item => <li key={item.dece_observation_id} className="mb-3"><label className="me-2">Categoría<select aria-label="Editar categoría de observación" className="form-select form-select-sm" value={item.category} onChange={event => void update(item, { category: event.target.value as typeof item.category })}>{Object.entries(categories).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><label className="me-2">Descripción<input aria-label="Editar descripción de observación" className="form-control form-control-sm" defaultValue={item.description} key={`${item.dece_observation_id}-${item.description}`} onBlur={event => { if (event.target.value.trim() !== item.description) void update(item, { description: event.target.value.trim() }) }} /></label><label className="me-2">Severidad<select aria-label="Editar severidad de observación" className="form-select form-select-sm" value={item.severity} onChange={event => void update(item, { severity: event.target.value as typeof item.severity })}>{Object.entries(risks).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label><label><input type="checkbox" checked={item.requires_follow_up} onChange={event => void update(item, { requires_follow_up: event.target.checked })} /> Requiere seguimiento</label>{item.requires_follow_up && <strong className="text-warning-emphasis d-block">REQUIERE SEGUIMIENTO</strong>}</li>)}</ul></div>
}
