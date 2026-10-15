import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { useDeceData } from '../services/dece-data-context'
import { createDeceFormService } from '../services/form-service'
import type { Student } from '../types/student'

type StudentRecord = {
  student_id: string
  institution_id: string
  national_id: string
  first_name: string
  last_name: string
  grade_level: string | null
  enrollment_number: string | null
}
type StudentFields = { national_id: string; first_name: string; last_name: string; grade_level: string; enrollment_number: string }
type Template = { code: string; name: string }
const pageSize = 25
const grades = [
  ...Array.from({ length: 10 }, (_, index) => `${index + 1}.º EGB`),
  '1.º BGU', '2.º BGU', '3.º BGU',
]
const fieldNames: Record<keyof StudentFields, string> = {
  national_id: 'national_id', first_name: 'first_name', last_name: 'last_name',
  grade_level: 'grade_level', enrollment_number: 'enrollment_number',
}
const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true })

function clean(value: string) { return value.replace(/\s+/g, ' ').trim() }
function safeSearch(value: string) { return value.normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, ' ') }
function blankFields(): StudentFields { return { national_id: '', first_name: '', last_name: '', grade_level: '', enrollment_number: '' } }
function fieldsFrom(record: StudentRecord): StudentFields {
  return { national_id: record.national_id, first_name: record.first_name, last_name: record.last_name, grade_level: record.grade_level ?? '', enrollment_number: record.enrollment_number ?? '' }
}

function validate(values: StudentFields) {
  if (!/^\d{10}$/.test(values.national_id)) return 'La cédula debe contener exactamente 10 dígitos numéricos.'
  const validName = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u
  if (!validName.test(values.first_name)) return 'Ingresa uno o más nombres usando solo letras.'
  if (!validName.test(values.last_name)) return 'Ingresa uno o más apellidos usando solo letras.'
  if (`${values.first_name} ${values.last_name}`.trim().split(/\s+/).length < 2) return 'Ingresa al menos un nombre y un apellido.'
  if (!grades.includes(values.grade_level)) return 'Selecciona un grado de la lista.'
  return ''
}

function toStudent(record: StudentRecord): Student {
  const name = `${record.first_name} ${record.last_name}`.trim()
  return { recordId: record.student_id, id: record.national_id, name, firstName: record.first_name, lastName: record.last_name, grade: record.grade_level ?? 'Sin grado', initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(), color: 'lavender' }
}

export default function StudentManagementPage({ onOpenForm, onStudentSaved, onOpenCases }: {
  onOpenForm: (student: Student, code: string) => void
  onStudentSaved: (student: Student) => void
  onOpenCases?: (studentId: string) => void
}) {
  const integration = useDeceData()
  const formService = useMemo(() => integration ? createDeceFormService(integration.client) : null, [integration?.client])
  const [routeStudentId, setRouteStudentId] = useState(() => location.pathname.split('/').filter(Boolean)[3] ?? '')
  const [records, setRecords] = useState<StudentRecord[]>([])
  const [record, setRecord] = useState<StudentRecord | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [values, setValues] = useState<StudentFields>(blankFields())
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [highlightId, setHighlightId] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [createdOutsideFilter, setCreatedOutsideFilter] = useState(false)
  const rowRef = useRef<HTMLTableRowElement | null>(null)
  const listRequestId = useRef(0)
  const detailRequestId = useRef(0)
  const basePath = `/${integration?.slug ?? ''}/dece/estudiantes`.replace('//dece', '/dece')

  const followRoute = useCallback(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    setRouteStudentId(parts[2] === 'estudiantes' ? parts[3] ?? '' : '')
  }, [])

  useEffect(() => {
    window.addEventListener('popstate', followRoute)
    return () => window.removeEventListener('popstate', followRoute)
  }, [followRoute])

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(safeSearch(search)); setPage(0) }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!integration || !formService) return
    let live = true
    void formService.listFormTemplates(integration.institutionId)
      .then(rows => { if (live) setTemplates(rows.map(({ code, name }) => ({ code, name }))) })
      .catch(() => { if (live) setTemplates([]) })
    return () => { live = false }
  }, [formService, integration?.institutionId])

  const reloadList = useCallback(async () => {
    if (!integration) return
    const requestId = ++listRequestId.current
    if (routeStudentId) return
    setLoading(true); setError('')
    try {
      let query = integration.client.from('students')
        .select('student_id, institution_id, national_id, first_name, last_name, grade_level, enrollment_number', { count: 'exact' })
        .eq('institution_id', integration.institutionId)
      if (debouncedSearch) {
        const pattern = `%${debouncedSearch}%`
        query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},national_id.ilike.${pattern},grade_level.ilike.${pattern}`)
      }
      const start = page * pageSize
      const { data, error: queryError, count } = await query.order('last_name').order('first_name').range(start, start + pageSize - 1)
      if (requestId !== listRequestId.current) return
      if (queryError) throw queryError
      setRecords((data ?? []) as StudentRecord[])
      setTotal(count ?? 0)
      if (data?.length === 0 && !debouncedSearch && page === 0) setError('No hay estudiantes visibles en esta institución. Verifica que tengas permiso DECE o registra el primer estudiante.')
    } catch (cause) {
      if (requestId !== listRequestId.current) return
      const issue = cause as { message?: string; code?: string }
      setError(issue.code === '42501' ? 'No tienes permiso para consultar estudiantes de esta institución.' : issue.message ? `${issue.message}${issue.code ? ` (${issue.code})` : ''}` : 'No se pudo cargar el listado de estudiantes.')
    } finally { if (requestId === listRequestId.current) setLoading(false) }
  }, [debouncedSearch, integration, page, routeStudentId])

  useEffect(() => { void reloadList() }, [reloadList, refreshVersion])

  useEffect(() => {
    if (!routeStudentId || !integration) { setRecord(null); setValues(blankFields()); return }
    let live = true
    const requestId = ++detailRequestId.current
    setRecord(null)
    setLoading(true); setError('')
    void integration.client.from('students')
      .select('student_id, institution_id, national_id, first_name, last_name, grade_level, enrollment_number')
      .eq('student_id', routeStudentId).eq('institution_id', integration.institutionId).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!live || requestId !== detailRequestId.current) return
        if (queryError) setError(queryError.code === '42501' ? 'No tienes permiso para consultar este estudiante.' : queryError.message)
        else if (!data) setError('No tienes permiso para consultar este estudiante o el registro no existe en esta institución.')
        else { setRecord(data as StudentRecord); setValues(fieldsFrom(data as StudentRecord)) }
        setLoading(false)
      })
    return () => { live = false; detailRequestId.current += 1 }
  }, [integration, routeStudentId])

  useEffect(() => { if (highlightId && records.some(item => item.student_id === highlightId)) rowRef.current?.focus() }, [highlightId, records])

  async function logAudit(action: 'student.create' | 'student.update', entityId: string, changedFields: string[]) {
    if (!integration?.profileId) return false
    try {
      const { error: auditError } = await integration.client.from('audit_events').insert({
        institution_id: integration.institutionId,
        profile_id: integration.profileId,
        action,
        entity_type: 'student',
        entity_id: entityId,
        payload: { changed_fields: changedFields },
      })
      return !auditError
    } catch { return false }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!integration) return
    const normalized: StudentFields = {
      national_id: clean(values.national_id), first_name: clean(values.first_name), last_name: clean(values.last_name),
      grade_level: clean(values.grade_level), enrollment_number: clean(values.enrollment_number),
    }
    const issue = validate(normalized)
    if (issue) { setValidationError(issue); return }
    setValidationError(''); setSaving(true); setError(''); setAnnouncement('')
    let auditFailed = false
    try {
      if (record) {
        const changed = (Object.keys(fieldNames) as Array<keyof StudentFields>).filter(key => clean(String(fieldsFrom(record)[key] ?? '')) !== normalized[key])
        const updatePayload = { ...normalized, enrollment_number: normalized.enrollment_number || null }
        const { data, error: updateError } = await integration.client.from('students').update(updatePayload)
          .eq('student_id', record.student_id).eq('institution_id', integration.institutionId)
          .select('student_id, institution_id, national_id, first_name, last_name, grade_level, enrollment_number').maybeSingle()
        if (updateError) throw updateError
        if (!data) throw Object.assign(new Error('No tienes permiso para editar este estudiante.'), { code: '42501' })
        const saved = data as StudentRecord
        listRequestId.current += 1
        setRecord(saved); setValues(fieldsFrom(saved)); onStudentSaved(toStudent(saved))
        setAnnouncement('Cambios guardados')
        const audited = changed.length ? await logAudit('student.update', record.student_id, changed) : true
        auditFailed = !audited
        setCreatedOutsideFilter(false)
        await toast.fire({ icon: 'success', title: 'Cambios guardados' })
      } else {
        const insertPayload = { ...normalized, enrollment_number: normalized.enrollment_number || null }
        const { data, error: insertError } = await integration.client.from('students').insert({ institution_id: integration.institutionId, ...insertPayload })
          .select('student_id, institution_id, national_id, first_name, last_name, grade_level, enrollment_number').single()
        if (insertError) throw insertError
        const created = data as StudentRecord
        listRequestId.current += 1
        onStudentSaved(toStudent(created))
        setCreating(false); setValues(blankFields())
        const activeFilter = safeSearch(search).toLocaleLowerCase()
        const matchesFilter = !activeFilter || [created.first_name, created.last_name, created.national_id, created.grade_level ?? '']
          .some(value => value.toLocaleLowerCase().includes(activeFilter))
        if (matchesFilter) {
          setAnnouncement('Estudiante registrado')
          setCreatedOutsideFilter(false)
          setHighlightId(created.student_id)
          setRefreshVersion(value => value + 1)
        } else {
          setAnnouncement('Estudiante registrado. No coincide con la búsqueda actual.')
          setCreatedOutsideFilter(true)
        }
        const audited = await logAudit('student.create', created.student_id, Object.keys(fieldNames))
        auditFailed = !audited
        await toast.fire({ icon: 'success', title: 'Estudiante registrado' })
      }
      if (auditFailed) setError('Se guardó el estudiante, pero no se pudo registrar la auditoría. Revisa docs/solicitudes-bd.md.')
    } catch (cause) {
      const issue = cause as { message?: string; code?: string }
      if (issue.code === '23505') setError('Ya existe un estudiante con esa cédula en esta institución.')
      else if (issue.code === '42501') setError('No tienes permiso para guardar estudiantes en esta institución.')
      else setError(issue.message ? `${issue.message}${issue.code ? ` (${issue.code})` : ''}` : 'No se pudo guardar el estudiante.')
    } finally { setSaving(false) }
  }

  function clearFilterAndShowCreated() {
    setCreatedOutsideFilter(false)
    setSearch('')
    setDebouncedSearch('')
    setPage(0)
    setHighlightId('')
    setRefreshVersion(value => value + 1)
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const displayedName = record ? `${record.first_name} ${record.last_name}` : ''

  return <div className="page-content container-fluid">
    <div className="eyebrow">GESTIÓN DECE</div>
    <div className="welcome-row list-title"><div><h1>{record ? 'Detalle del estudiante' : 'Estudiantes'}</h1><p className="subheading">Registra y actualiza estudiantes de tu institución.</p></div>
      {record ? <button className="button btn secondary" type="button" onClick={() => { history.pushState(null, '', basePath); setRouteStudentId(''); setError('') }}>Volver al listado</button> : !creating && <button className="button btn primary" type="button" onClick={() => { setValues(blankFields()); setValidationError(''); setCreating(true) }}>+ Registrar estudiante</button>}
    </div>
    {error && <div className="notice sensitive" role="alert">{error}</div>}
    <div className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</div>
    {createdOutsideFilter && <div className="notice d-flex flex-wrap align-items-center gap-2" role="status"><span>Estudiante registrado. La búsqueda actual no lo incluye.</span><button type="button" className="button btn secondary" onClick={clearFilterAndShowCreated}>Limpiar búsqueda y ver estudiante</button></div>}
    {creating && <section className="table-card p-3 mb-4" aria-labelledby="create-student-heading"><h2 id="create-student-heading">Nuevo estudiante</h2><StudentFieldsForm values={values} setValues={setValues} onSubmit={submit} saving={saving} error={validationError} onCancel={() => { setCreating(false); setValidationError('') }} /></section>}
    {record && !loading && <>
      <section className="table-card p-3 mb-4" aria-labelledby="student-details-heading"><h2 id="student-details-heading">{displayedName}</h2><p>Cédula: {record.national_id} · Grado: {record.grade_level ?? 'Sin grado'}</p>
        <StudentFieldsForm values={values} setValues={setValues} onSubmit={submit} saving={saving} error={validationError} />
      </section>
      <section className="table-card p-3"><h2>Fichas del estudiante</h2><p>Abre una ficha para consultar o completar sus respuestas.</p><div className="d-flex flex-wrap gap-2">
        {templates.map(template => <button type="button" key={template.code} className="button btn secondary" onClick={() => onOpenForm(toStudent(record), template.code)}>{template.name}</button>)}
      </div></section>
      <StudentCases studentId={record.student_id} institutionId={integration?.institutionId ?? ''} slug={integration?.slug ?? ''} onNew={() => onOpenCases?.(record.student_id)} />
    </>}
    {!record && !creating && <>
      <label className="search-box mb-3"><span className="visually-hidden">Buscar por nombres, apellidos, cédula o grado</span><input className="form-control" aria-label="Buscar estudiantes por nombres, apellidos, cédula o grado" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nombres, apellidos, cédula o grado…" /></label>
      <p className="visually-hidden" aria-live="polite">{loading ? 'Buscando estudiantes…' : `${total} estudiantes encontrados.`}</p>
      {loading && records.length > 0 && <small className="text-secondary d-block mb-2" role="status">Actualizando listado…</small>}
      <section className="table-card table-responsive"><table className="table"><caption className="visually-hidden">Estudiantes de esta institución</caption><thead><tr><th>Apellidos</th><th>Nombres</th><th>Cédula</th><th>Grado</th><th>Matrícula</th><th></th></tr></thead><tbody>
        {records.map(item => <tr key={item.student_id} ref={item.student_id === highlightId ? rowRef : undefined} tabIndex={item.student_id === highlightId ? -1 : undefined} onFocus={() => setHighlightId('')} className={item.student_id === highlightId ? 'table-primary' : undefined}><td>{item.last_name}</td><td>{item.first_name}</td><td>{item.national_id}</td><td>{item.grade_level}</td><td>{item.enrollment_number ?? '—'}</td><td><button type="button" className="table-link" aria-label={`Editar estudiante con cédula terminada en ${item.national_id.slice(-3)}`} onClick={() => { history.pushState(null, '', `${basePath}/${item.student_id}`); setRouteStudentId(item.student_id) }}>Ver y editar</button></td></tr>)}
        {!loading && !records.length && !error && <tr><td colSpan={6}>No se encontraron estudiantes con esa búsqueda.</td></tr>}
      </tbody></table>
        <div className="d-flex justify-content-between align-items-center p-3"><span>{total} registros · Página {page + 1} de {pageCount}</span><div className="d-flex gap-2"><button className="btn btn-outline-secondary" type="button" disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))}>Anterior</button><button className="btn btn-outline-secondary" type="button" disabled={page + 1 >= pageCount || loading} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></div>
      </section>
    </>}
    {loading && <p role="status">Cargando estudiantes…</p>}
  </div>
}

function StudentCases({ studentId, institutionId, slug, onNew }: { studentId: string; institutionId: string; slug: string; onNew: () => void }) {
  const integration = useDeceData()
  const [rows, setRows] = useState<Array<{ dece_case_id: string; case_number: string; status: string }>>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    if (!integration) return
    void integration.client.from('dece_cases').select('dece_case_id,case_number,status').eq('institution_id', institutionId).eq('student_id', studentId).order('updated_at', { ascending: false }).then(({ data, error: queryError }) => {
      if (!live) return
      if (queryError) setError(queryError.code === '42501' ? 'No tienes permiso para consultar los casos de este estudiante.' : 'No se pudieron cargar los casos.')
      else setRows(data ?? [])
    })
    return () => { live = false }
  }, [integration, institutionId, studentId])
  const statusLabel: Record<string, string> = { registered: 'Registrado', in_progress: 'En atención', under_monitoring: 'En seguimiento', closed: 'Cerrado' }
  return <section className="table-card p-3 mt-3" aria-labelledby="student-cases-heading"><div className="d-flex justify-content-between align-items-center"><h2 id="student-cases-heading">Casos de acompañamiento</h2><button type="button" className="btn btn-primary btn-sm" onClick={onNew}>Nuevo caso</button></div>{error && <p role="alert">{error}</p>}{rows.length ? <ul>{rows.map(row => <li key={row.dece_case_id}><a href={`/${slug}/dece/casos/${row.dece_case_id}`}>{row.case_number} · {statusLabel[row.status] ?? row.status}</a></li>)}</ul> : !error && <p>No hay casos visibles para este estudiante.</p>}</section>
}

function StudentFieldsForm({ values, setValues, onSubmit, saving, error, onCancel }: {
  values: StudentFields
  setValues: (value: StudentFields | ((current: StudentFields) => StudentFields)) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
  error: string
  onCancel?: () => void
}) {
  function update(field: keyof StudentFields, value: string) { setValues(current => ({ ...current, [field]: value })) }
  return <form className="row g-3" onSubmit={onSubmit} noValidate>
    <div className="col-md-6"><label className="form-label" htmlFor="student-national-id">Cédula</label><input id="student-national-id" className="form-control" inputMode="numeric" autoComplete="off" maxLength={10} pattern="[0-9]{10}" required value={values.national_id} onChange={event => update('national_id', event.target.value)} /></div>
    <div className="col-md-6"><label className="form-label" htmlFor="student-first-name">Nombres</label><input id="student-first-name" className="form-control" autoComplete="given-name" required value={values.first_name} onChange={event => update('first_name', event.target.value)} /></div>
    <div className="col-md-6"><label className="form-label" htmlFor="student-last-name">Apellidos</label><input id="student-last-name" className="form-control" autoComplete="family-name" required value={values.last_name} onChange={event => update('last_name', event.target.value)} /></div>
    <div className="col-md-6"><label className="form-label" htmlFor="student-grade">Grado</label><select id="student-grade" className="form-select" required value={values.grade_level} onChange={event => update('grade_level', event.target.value)}><option value="">Selecciona un grado</option>{grades.map(grade => <option key={grade} value={grade}>{grade}</option>)}</select></div>
    <div className="col-md-6"><label className="form-label" htmlFor="student-enrollment">Número de matrícula <span className="text-secondary">(opcional)</span></label><input id="student-enrollment" className="form-control" value={values.enrollment_number} onChange={event => update('enrollment_number', event.target.value)} /></div>
    {error && <div className="col-12" role="alert"><p className="text-danger mb-0">{error}</p></div>}
    <div className="col-12 d-flex gap-2"><button className="button btn primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar estudiante'}</button>{onCancel && <button className="button btn secondary" type="button" onClick={onCancel}>Cancelar</button>}</div>
  </form>
}
