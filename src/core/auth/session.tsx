import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { DeceApp, DeceDataProvider } from '../../modules/dece'
import ConfigurableForm from '../../modules/dece/pages/student-form/configurable-form'
import type { Student } from '../../modules/dece/types/student'
import { createDeceFormService } from '../../modules/dece/services/form-service'
import './student-portal.css'

type Membership = { institution_id: string; role: { name: string } | { name: string }[] | null; institution: { name: string; slug: string } | { name: string; slug: string }[] | null }
type ActiveSession = { userId: string; email: string; institutionId: string; institutionName: string; slug: string; role: string }
type OwnSubmission = Awaited<ReturnType<ReturnType<typeof createDeceFormService>['loadOwnSubmission']>>
type HistoryItem = { id: string; versionId: string; status: 'draft' | 'submitted' | 'reviewed'; updatedAt: string; name: string; versionNumber: number }
type PortalForm = { code: string; name: string }
type SessionContextValue = { session: ActiveSession | null; signOut: () => Promise<void> }
const SessionContext = createContext<SessionContextValue | null>(null)

function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value as T | null }
function routeFor(session: ActiveSession) {
  if (session.role === 'dece_staff') return `/${session.slug}/dece`
  if (session.role === 'student') return `/${session.slug}/mi-ficha`
  if (session.role === 'institution_admin') return `/${session.slug}/admin`
  return `/${session.slug}/sin-modulos`
}

export function useActiveSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useActiveSession requiere SessionProvider')
  return value
}

export function SessionProvider() {
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [choices, setChoices] = useState<ActiveSession[]>([])

  async function memberships(userId: string, email: string) {
    const { data, error: queryError } = await supabase.from('memberships')
      .select('institution_id, role:roles(name), institution:institutions(name, slug)')
      .eq('profile_id', userId)
    if (queryError) throw queryError
    return ((data ?? []) as unknown as Membership[]).flatMap(row => {
      const role = one(row.role)?.name
      const institution = one(row.institution)
      return role && institution ? [{ userId, email, institutionId: row.institution_id, institutionName: institution.name, slug: institution.slug, role }] : []
    })
  }

  useEffect(() => {
    let live = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!live) return
      const user = data.session?.user
      if (user) {
        try {
          const options = await memberships(user.id, user.email ?? '')
          const pathParts = location.pathname.split('/').filter(Boolean)
          const requestedSlug = pathParts[0] ?? ''
          const active = requestedSlug ? options.find(item => item.slug === requestedSlug) : options.length === 1 ? options[0] : null
          if (active && live) { setSession(active); if (!requestedSlug) history.replaceState(null, '', routeFor(active)) }
          else if (!requestedSlug && live && options.length > 1) setChoices(options)
          else if (requestedSlug && live) { await supabase.auth.signOut(); setError('No tienes acceso a esta institución') }
        } catch { if (live) setError('No se pudo verificar tu acceso. Intenta iniciar sesión nuevamente.') }
      }
      if (live) setReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(() => { /* La sesión se sincroniza al iniciar/cerrar sesión. */ })
    return () => { live = false; listener.subscription.unsubscribe() }
  }, [])

  async function signOut() { await supabase.auth.signOut(); setSession(null); setChoices([]); history.replaceState(null, '', '/') }
  const value = useMemo(() => ({ session, signOut }), [session])
  if (!ready) return <main className="container py-5" role="status">Cargando sesión…</main>
  if (choices.length && !session) return <main className="container py-5"><h1>Selecciona tu institución</h1>{choices.map(item => <button className="btn btn-primary me-2" key={item.institutionId} onClick={() => { setSession(item); history.replaceState(null, '', routeFor(item)); setChoices([]) }}>{item.institutionName}</button>)}</main>
  return <SessionContext.Provider value={value}><LoginOrRoute session={session} onAuthenticated={async (userId, email, slug) => {
    try {
      const options = await memberships(userId, email)
      const active = slug ? options.find(item => item.slug === slug) : options.length === 1 ? options[0] : null
      if (slug && !active) { await supabase.auth.signOut(); setError('No tienes acceso a esta institución'); return }
      if (active) { setSession(active); history.replaceState(null, '', routeFor(active)); setError('') }
      else if (options.length > 1) setChoices(options)
      else { await supabase.auth.signOut(); setError('Tu usuario no tiene una institución asignada.') }
    } catch { await supabase.auth.signOut(); setError('No se pudo verificar tu acceso. Intenta nuevamente.') }
  }} error={error} setError={setError} /></SessionContext.Provider>
}

function LoginOrRoute({ session, onAuthenticated, error, setError }: { session: ActiveSession | null; onAuthenticated: (id: string, email: string, slug: string) => Promise<void>; error: string; setError: (value: string) => void }) {
  const path = location.pathname.split('/').filter(Boolean)
  const slug = path[0] && path[1] === 'login' ? path[0] : ''
  if (!session) return <main className="container py-5" style={{ maxWidth: 460 }}><h1>Iniciar sesión</h1>{slug && <p>Institución: {slug}</p>}<LoginForm slug={slug} onAuthenticated={onAuthenticated} error={error} setError={setError} /></main>
  const allowed = path[1] === 'dece' ? ['dece_staff'] : path[1] === 'mi-ficha' ? ['student'] : path[1] === 'admin' ? ['institution_admin'] : []
  if (path[0] && path[0] !== session.slug) return <main className="container py-5"><h1>403 · Sin acceso</h1><p>Tu sesión no tiene acceso a esta institución.</p></main>
  if (allowed.length && !allowed.includes(session.role)) return <main className="container py-5"><h1>403 · Sin acceso</h1><p>Tu rol no tiene permiso para ver este módulo.</p></main>
  if (path[1] === 'sin-modulos') return <main className="container py-5"><h1>Sin módulos disponibles</h1><p>Tu rol aún no tiene módulos habilitados.</p></main>
  if (!allowed.length) { history.replaceState(null, '', routeFor(session)); return <main className="container py-5">Abriendo tu módulo…</main> }
  if (session.role === 'institution_admin') return <main className="container py-5"><h1>Administración</h1><p>Módulo institucional en preparación.</p></main>
  if (session.role === 'student') return <StudentFicha session={session} />
  return <DeceStaffModule session={session} />
}

function StudentFicha({ session }: { session: ActiveSession }) {
  const { signOut } = useActiveSession()
  const formService = useMemo(() => createDeceFormService(supabase), [])
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [section, setSection] = useState(0)
  const [sections, setSections] = useState<string[]>(['Ficha general'])
  const [formCode, setFormCode] = useState('general')
  const [availableForms, setAvailableForms] = useState<PortalForm[]>([])
  const [activeTab, setActiveTab] = useState<'forms' | 'history'>('forms')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [historyError, setHistoryError] = useState('')
  const [selectedHistory, setSelectedHistory] = useState<OwnSubmission | null>(null)
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false)
  const integration = useMemo(() => ({ client: supabase, institutionId: session.institutionId, profileId: session.userId, slug: session.slug, getStudentId: (row: Student) => row.recordId ?? null }), [session.institutionId, session.slug, session.userId])
  const syncSections = useCallback((next: string[]) => setSections(current => current.length === next.length && current.every((item, index) => item === next[index]) ? current : next), [])

  useEffect(() => {
    let live = true
    void formService.listFormTemplates(session.institutionId)
      .then(forms => { if (live) setAvailableForms(forms.map(form => ({ code: form.code, name: form.name }))) })
      .catch(() => { if (live) setAvailableForms([]) })
    return () => { live = false }
  }, [formService, session.institutionId])

  useEffect(() => {
    let live = true
    void supabase.from('students').select('student_id, national_id, first_name, last_name, grade_level')
      .eq('profile_id', session.userId).eq('institution_id', session.institutionId).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!live) return
        if (queryError) setError(queryError.code === '42501' ? 'No tienes permiso para consultar tu ficha.' : 'No se pudo cargar tu ficha.')
        else if (!data) setError('No tienes permiso para consultar una ficha, o no hay una ficha vinculada a tu cuenta.')
        else {
          const firstName = data.first_name as string
          const lastName = (data.last_name as string | null) ?? ''
          const name = `${firstName} ${lastName}`.trim()
          setStudent({ recordId: data.student_id as string, id: (data.national_id as string | null) ?? '', name, firstName, lastName, grade: (data.grade_level as string | null) ?? '', initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(), color: 'lavender' })
        }
        setLoading(false)
      })
    return () => { live = false }
  }, [session.institutionId, session.userId])

  useEffect(() => {
    if (!student?.recordId) return
    let live = true
    async function loadHistory() {
      setHistoryLoading(true)
      setHistoryError('')
      try {
        const { data: submissions, error: submissionsError } = await supabase.from('form_submissions')
          .select('form_submission_id, form_version_id, status, updated_at')
          .eq('student_id', student!.recordId!).order('updated_at', { ascending: false })
        if (submissionsError) throw submissionsError
        const submissionRows = submissions ?? []
        if (submissionRows.length === 0) { if (live) setHistory([]); return }
        const versionIds = [...new Set(submissionRows.map(row => row.form_version_id))]
        const { data: versions, error: versionsError } = await supabase.from('form_versions')
          .select('form_version_id, form_definition_id, version_number').in('form_version_id', versionIds)
        if (versionsError) throw versionsError
        const versionRows = versions ?? []
        if (!versionRows.length) throw new Error('No tienes permiso para consultar las versiones de tus fichas.')
        const definitionIds = [...new Set(versionRows.map(row => row.form_definition_id))]
        const { data: definitions, error: definitionsError } = await supabase.from('form_definitions')
          .select('form_definition_id, name').in('form_definition_id', definitionIds)
        if (definitionsError) throw definitionsError
        if (!definitions?.length) throw new Error('No tienes permiso para consultar tus fichas.')
        const versionById = new Map(versionRows.map(row => [row.form_version_id, row]))
        const definitionById = new Map((definitions ?? []).map(row => [row.form_definition_id, row]))
        const items = submissionRows.map(row => {
          const version = versionById.get(row.form_version_id)
          const definition = version && definitionById.get(version.form_definition_id)
          return {
            id: row.form_submission_id,
            versionId: row.form_version_id,
            status: row.status as HistoryItem['status'],
            updatedAt: row.updated_at,
            name: definition?.name ?? 'Ficha estudiantil',
            versionNumber: version?.version_number ?? 1,
          }
        })
        if (live) setHistory(items)
      } catch (cause) {
        const error = cause as { code?: string; message?: string }
        if (live) setHistoryError(error.code === '42501'
          ? 'No tienes permiso para consultar tu historial.'
          : error.message?.startsWith('No tienes permiso') ? error.message : 'No se pudo cargar el historial de tus fichas.')
      } finally { if (live) setHistoryLoading(false) }
    }
    void loadHistory()
    return () => { live = false }
  }, [historyRefresh, student?.recordId])

  async function openHistory(item: HistoryItem) {
    if (!student?.recordId) return
    setSelectedHistory(null)
    setHistoryDetailLoading(true)
    setHistoryError('')
    try {
      setSelectedHistory(await formService.loadOwnSubmission(item.id, student.recordId))
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : 'No se pudo abrir esta ficha.')
    } finally { setHistoryDetailLoading(false) }
  }

  return <div className="studentPortal"><DeceDataProvider value={integration}><main className="container studentPortal__main py-4">
    <header className="studentPortal__header"><div><span className="studentPortal__eyebrow">ESPACIO DEL ESTUDIANTE</span><h1>Mis fichas</h1><p>Completa tus formularios y consulta tus envíos.</p></div><button className="btn btn-outline-secondary" onClick={() => void signOut()}>Cerrar sesión</button></header>
    {loading ? <p role="status">Cargando ficha…</p> : error ? <p role="alert" className="studentPortal__message">{error}</p> : student && <>
      <nav className="studentPortal__tabs" aria-label="Fichas y envíos"><button type="button" className={activeTab === 'forms' ? 'active' : ''} onClick={() => setActiveTab('forms')}>Completar fichas</button><button type="button" className={activeTab === 'history' ? 'active' : ''} onClick={() => { setActiveTab('history'); setHistoryRefresh(value => value + 1); setSelectedHistory(null) }}>Mi historial</button></nav>
      {activeTab === 'forms' ? <>
        <nav className="studentPortal__formTabs" aria-label="Formularios">{availableForms.map(form => <button type="button" key={form.code} className={formCode === form.code ? 'active' : ''} onClick={() => { setFormCode(form.code); setSection(0) }}>{form.name}</button>)}</nav>
        <nav className="studentPortal__sections" aria-label="Secciones de la ficha">{sections.map((item, index) => <button type="button" className={section === index ? 'active' : ''} key={item} onClick={() => setSection(index)}>{String(index + 1).padStart(2, '0')} · {item}</button>)}</nav>
        <section className="studentPortal__formSurface"><header className="studentPortal__formHeading"><span>FORMULARIO ESTUDIANTIL</span><h2>{availableForms.find(form => form.code === formCode)?.name ?? 'Ficha'}</h2><p>{student.name} · {student.grade}</p></header><ConfigurableForm key={formCode} integration={integration} student={student} code={formCode} section={section} onSectionsChange={syncSections} audience="student" /></section>
      </> : <section aria-labelledby="history-heading"><h2 id="history-heading">Historial de mis fichas</h2>
        {historyLoading && <p role="status">Cargando historial…</p>}{historyError && <p role="alert">{historyError}</p>}
        {!historyLoading && !historyError && history.length === 0 && <p>No hay fichas visibles todavía. Puede deberse a permisos o a que aún no guardaste un borrador.</p>}
        <ul className="studentPortal__historyList">{history.map(item => <li key={item.id}><span><strong>{item.name}</strong><small>Versión {item.versionNumber} · {new Date(item.updatedAt).toLocaleString('es-EC')}</small></span><span className="studentPortal__historyActions"><span className={`studentPortal__badge ${item.status}`}>{item.status === 'draft' ? 'Borrador' : item.status === 'submitted' ? 'Enviada' : 'Revisada'}</span><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void openHistory(item)}>Ver respuestas</button></span></li>)}</ul>
        {historyDetailLoading && <p role="status">Cargando respuestas…</p>}{selectedHistory && <article className="studentPortal__historyDetail"><div className="studentPortal__historyTitle"><h3>{selectedHistory.name} · versión {selectedHistory.versionNumber}</h3><button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedHistory(null)}>Cerrar</button></div>{selectedHistory.questions.map(question => {
          const value = question.is_system ? question.source_field === 'students.first_name' ? student.name : question.source_field === 'students.grade_level' ? student.grade : question.source_field === 'students.national_id' ? student.id : '' : selectedHistory.answers[question.form_question_id]
          const display = Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? value ? 'Sí' : 'No' : value === null || value === undefined || value === '' ? 'Sin respuesta' : String(value)
          return <div className="mb-3" key={question.form_question_id}><strong>{question.label}</strong><div>{display}</div></div>
        })}</article>}
      </section>}
    </>}
  </main></DeceDataProvider></div>
}

function DeceStaffModule({ session }: { session: ActiveSession }) {
  const { signOut } = useActiveSession()
  const integration = useMemo(() => ({ client: supabase, institutionId: session.institutionId, profileId: session.userId, slug: session.slug, getStudentId: (student: { recordId?: string }) => student.recordId ?? null }), [session.institutionId, session.slug, session.userId])
  return <DeceDataProvider value={integration}><main className="container py-3"><div className="d-flex justify-content-between align-items-center"><span>{session.institutionName} · DECE</span><button className="btn btn-outline-secondary" onClick={() => void signOut()}>Cerrar sesión</button></div><DeceApp /></main></DeceDataProvider>
}

function LoginForm({ slug, onAuthenticated, error, setError }: { slug: string; onAuthenticated: (id: string, email: string, slug: string) => Promise<void>; error: string; setError: (value: string) => void }) {
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: String(form.get('password') ?? '') })
    if (authError || !data.user) setError('Correo o contraseña incorrectos.')
    else await onAuthenticated(data.user.id, email, slug)
    setBusy(false)
  }
  return <form onSubmit={event => void submit(event)} className="vstack gap-3"><label htmlFor="login-email">Correo electrónico</label><input id="login-email" className="form-control" type="email" name="email" autoComplete="username" required autoFocus /><label htmlFor="login-password">Contraseña</label><input id="login-password" className="form-control" type="password" name="password" autoComplete="current-password" required /><button className="btn btn-primary" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>{error && <p role="alert" className="text-danger">{error}</p>}</form>
}
