import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useDeceData } from '../../services/dece-data-context'
import './dashboard-page.css'

export const ATTENTION_STALE_DAYS = 7
export const ATTENTION_MAX_ROWS = 6
export const DRAFT_MAX_ROWS = 5
export const RECENT_STUDENT_DAYS = 14
const DAY = 86400000
type Row = any
type Person = { student_id: string; first_name: string; last_name: string; grade_level: string | null }
type Alert = { key: string; student: string; name: string; reason: string; kind: string; caseId?: string; formCode?: string; caseNumber?: string }
type Draft = { id: string; student: string; name: string; initials: string; title: string; code: string; total: number; answered: number }
type Recent = { id: string; name: string; initials: string; grade: string; event: string; at: number }
type Props = { onNavigate: (target: 'students' | 'cases' | 'forms' | 'submissions', intent?: 'create') => void; onStudent: (id: string) => void; onCase: (id: string) => void; onForm: (id: string, code: string) => void; firstName?: string | null }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toLocaleUpperCase('es-EC') }
function hasAnswer(a: Row) { return (a.value_text != null && a.value_text !== '') || a.value_number != null || a.value_boolean != null || (a.value_date != null && a.value_date !== '') || Boolean(a.selected_option_id) || (a.form_answer_options?.length ?? 0) > 0 }
function todayEC() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date()) }
function daysBeforeTodayEC(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  return Math.floor((Date.parse(`${todayEC()}T00:00:00Z`) - Date.parse(`${localDate}T00:00:00Z`)) / DAY)
}
export default function DashboardPage({ onNavigate, onStudent, onCase, onForm, firstName }: Props) {
  const integration = useDeceData()
  const [refresh, setRefresh] = useState(0)
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, number | null>>({ students: null, cases: null, submitted: null, drafts: null })
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [recent, setRecent] = useState<Recent[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const hour = Number(new Intl.DateTimeFormat('en', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Guayaquil' }).format(now))
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const dateLabel = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guayaquil' }).format(now)
  const refreshDashboard = useCallback(() => setRefresh(v => v + 1), [])
  useEffect(() => {
    window.addEventListener('dece:dashboard-refresh', refreshDashboard)
    return () => window.removeEventListener('dece:dashboard-refresh', refreshDashboard)
  }, [refreshDashboard])
  useEffect(() => {
    if (!integration) return
    let active = true
    const db: any = integration.client
    const institution = integration.institutionId
    const fail = (section: string) => { if (active) setErrors(v => ({ ...v, [section]: true })) }
    let versionsPromise: Promise<string[]> | null = null
    const getVersionIds = () => {
      if (!versionsPromise) versionsPromise = (async () => {
        const defs = await db.from('form_definitions').select('form_definition_id').eq('institution_id', institution)
        if (defs.error) throw defs.error
        const ids = (defs.data ?? []).map((row: Row) => row.form_definition_id)
        if (!ids.length) return []
        const versions = await db.from('form_versions').select('form_version_id').in('form_definition_id', ids)
        if (versions.error) throw versions.error
        return (versions.data ?? []).map((row: Row) => row.form_version_id)
      })()
      return versionsPromise
    }
    const loadCount = async (key: string, table: string, status?: string) => {
      try {
        let q: any
        if (table === 'form_submissions') {
          const versionIds = await getVersionIds()
          if (!versionIds.length) { if (active) setCounts(v => ({ ...v, [key]: 0 })); return }
          q = db.from(table).select('form_submission_id', { count: 'exact', head: true }).in('form_version_id', versionIds)
        } else q = db.from(table).select('*', { count: 'exact', head: true }).eq('institution_id', institution)
        if (key === 'cases') q = q.neq('status', 'closed')
        if (status) q = q.eq('status', status)
        const result = await q
        if (!active) return
        if (result.error) fail('counts'); else setCounts(v => ({ ...v, [key]: result.count ?? 0 }))
      } catch { fail('counts') }
    }
    const loadActions = async (caseIds: string[]) => {
      const fields = 'dece_action_id,dece_case_id,due_date,is_completed,created_at,updated_at'
      const first = await db.from('dece_actions').select(fields).in('dece_case_id', caseIds)
      if (!first.error) return first
      if (first.error.code !== '42703' && first.error.code !== 'PGRST204') return first
      const timestamp = String(first.error.message ?? '').includes('updated_at') ? 'created_at' : 'updated_at'
      return db.from('dece_actions').select(`dece_action_id,dece_case_id,due_date,is_completed,${timestamp}`).in('dece_case_id', caseIds)
    }
    setLoading(true); setErrors({})
    void Promise.all([loadCount('students', 'students'), loadCount('cases', 'dece_cases'), loadCount('submitted', 'form_submissions', 'submitted'), loadCount('drafts', 'form_submissions', 'draft')]).finally(() => { if (active) setLoading(false) })
    void (async () => {
      let versions: string[] = []
      try { versions = await getVersionIds() } catch { fail('attention'); fail('drafts'); fail('recent') }
      const [cResult, sResult] = await Promise.all([
        db.from('dece_cases').select('dece_case_id,student_id,case_number,risk_level,status,created_at,updated_at').eq('institution_id', institution).neq('status', 'closed').order('updated_at', { ascending: false }).limit(1000),
        versions.length ? db.from('form_submissions').select('form_submission_id,student_id,form_version_id,status,updated_at,form_versions!inner(form_definitions!inner(code,name))').in('form_version_id', versions).in('status', ['submitted','reviewed','draft']).order('updated_at', { ascending: false }).limit(40) : Promise.resolve({ data: [], error: null }),
      ])
      if (!active) return
      if (cResult.error) fail('attention')
      if (sResult.error) { fail('attention'); fail('drafts'); fail('recent') }
      const cases: Row[] = cResult.data ?? [], submissions: Row[] = sResult.data ?? []
      const caseIds = cases.map(c => c.dece_case_id)
      const [aResult, vResult] = caseIds.length ? await Promise.all([
        loadActions(caseIds),
        db.from('dece_visits').select('dece_visit_id,dece_case_id,visit_date').in('dece_case_id', caseIds),
      ]) : [{ data: [], error: null }, { data: [], error: null }]
      const visits: Row[] = vResult.data ?? []
      const visitIds = visits.map(v => v.dece_visit_id)
      const oResult = visitIds.length ? await db.from('dece_observations').select('dece_visit_id,requires_follow_up').in('dece_visit_id', visitIds).eq('requires_follow_up', true) : { data: [], error: null }
      if (!active) return
      if (aResult.error || vResult.error || oResult.error) fail('attention')
      const actions: Row[] = aResult.data ?? []
      const ids = [...new Set([...cases.map(c => c.student_id), ...submissions.map(s => s.student_id)])]
      const pResult = ids.length ? await db.from('students').select('student_id,first_name,last_name,grade_level').eq('institution_id', institution).in('student_id', ids) : { data: [], error: null }
      if (!active) return
      if (pResult.error) { fail('attention'); fail('drafts'); fail('recent') }
      const people = new Map<string, Person>((pResult.data ?? []).map((p: Person) => [p.student_id, p]))
      const name = (id: string) => { const p = people.get(id); return p ? `${p.first_name} ${p.last_name}`.trim() : 'Estudiante' }
      const lastActivity = new Map<string, number>()
      for (const c of cases) lastActivity.set(c.dece_case_id, new Date(c.updated_at ?? c.created_at).getTime())
      for (const x of [...visits.map(v => ({ id: v.dece_case_id, at: v.visit_date })), ...actions.map(a => ({ id: a.dece_case_id, at: a.updated_at ?? a.created_at }))]) lastActivity.set(x.id, Math.max(lastActivity.get(x.id) ?? 0, new Date(x.at ?? 0).getTime()))
      const alertMap = new Map<string, Alert>()
      const rank: Record<string, number> = { Urgente: 3, Revisar: 2, Pendiente: 1 }
      const add = (a: Alert) => { const old = alertMap.get(a.key); if (!old || rank[a.kind] > rank[old.kind]) alertMap.set(a.key, a) }
      for (const c of cases) {
        const base = { key: c.dece_case_id, student: c.student_id, name: name(c.student_id), caseId: c.dece_case_id, caseNumber: c.case_number }
        if (c.risk_level === 'critical' || c.risk_level === 'high') add({ ...base, reason: c.risk_level === 'critical' ? 'Riesgo crítico' : 'Riesgo alto', kind: 'Urgente' })
        const idle = daysBeforeTodayEC(new Date(lastActivity.get(c.dece_case_id) ?? Date.now()))
        if (idle >= ATTENTION_STALE_DAYS) add({ ...base, reason: `Sin actualizar hace ${idle} días`, kind: 'Revisar' })
        const follows = (oResult.data ?? []).some((o: Row) => visits.some(v => v.dece_visit_id === o.dece_visit_id && v.dece_case_id === c.dece_case_id))
        if (follows) add({ ...base, reason: 'Observación requiere seguimiento', kind: 'Revisar' })
      }
      for (const a of actions) {
        if (a.is_completed || !a.due_date) continue
      const delta = Math.floor((Date.parse(a.due_date + 'T00:00:00Z') - Date.parse(todayEC() + 'T00:00:00Z')) / DAY)
        if (delta > 0) continue
        const c = cases.find(x => x.dece_case_id === a.dece_case_id)
        if (c) add({ key: c.dece_case_id, student: c.student_id, name: name(c.student_id), caseId: c.dece_case_id, caseNumber: c.case_number, reason: delta === 0 ? 'Acción vence hoy' : `Acción vencida hace ${Math.abs(delta)} días`, kind: 'Urgente' })
      }
      for (const s of submissions.filter(s => s.status === 'submitted')) add({ key: s.form_submission_id, student: s.student_id, name: name(s.student_id), formCode: s.form_versions?.form_definitions?.code ?? 'general', reason: 'Ficha enviada sin revisar', kind: 'Pendiente' })
      const priority: Record<string, number> = { Urgente: 0, Revisar: 1, Pendiente: 2 }
      setAlerts([...alertMap.values()].sort((a,b) => priority[a.kind] - priority[b.kind]).slice(0, ATTENTION_MAX_ROWS))
      const draftSet = submissions.filter(s => s.status === 'draft').slice(0, DRAFT_MAX_ROWS)
      if (draftSet.length) {
        const versions = [...new Set(draftSet.map(s => s.form_version_id))]
        const submissionIds = draftSet.map(s => s.form_submission_id)
        const [qResult, ansResult] = await Promise.all([
          db.from('form_questions').select('form_question_id,form_version_id,is_system,source_field,is_active').in('form_version_id', versions).eq('is_active', true),
          db.from('form_answers').select('form_submission_id,form_question_id,value_text,value_number,value_boolean,value_date,selected_option_id,form_answer_options(question_option_id)').in('form_submission_id', submissionIds),
        ])
        if (!active) return
        if (qResult.error || ansResult.error) fail('drafts')
        const qByVersion = new Map<string, Row[]>(), aBySubmission = new Map<string, Row[]>()
        for (const q of qResult.data ?? []) if (!q.is_system && !q.source_field) qByVersion.set(q.form_version_id, [...(qByVersion.get(q.form_version_id) ?? []), q])
        for (const a of ansResult.data ?? []) aBySubmission.set(a.form_submission_id, [...(aBySubmission.get(a.form_submission_id) ?? []), a])
        setDrafts(draftSet.map(s => {
          const form = s.form_versions?.form_definitions, qs = qByVersion.get(s.form_version_id) ?? [], answers = aBySubmission.get(s.form_submission_id) ?? []
          const eligible = new Set(qs.map(q => q.form_question_id))
          const done = new Set(answers.filter(a => eligible.has(a.form_question_id) && hasAnswer(a)).map(a => a.form_question_id)).size
          return { id: s.form_submission_id, student: s.student_id, name: name(s.student_id), initials: initials(name(s.student_id)), title: form?.name ?? 'Ficha', code: form?.code ?? 'general', total: qs.length, answered: done }
        }))
      } else setDrafts([])
      const activity = new Map<string, Recent>()
      const putRecent = (id: string, atValue: string, event: string) => {
        const at = new Date(atValue).getTime(), p = people.get(id)
        if (!p || !Number.isFinite(at) || at < Date.now() - RECENT_STUDENT_DAYS * DAY) return
        const old = activity.get(id)
        if (!old || old.at < at) activity.set(id, { id, name: name(id), initials: initials(name(id)), grade: p.grade_level ?? 'Sin grado', event, at })
      }
      for (const c of cases) putRecent(c.student_id, c.created_at, 'Caso abierto')
      for (const v of visits) { const c = cases.find(x => x.dece_case_id === v.dece_case_id); if (c) putRecent(c.student_id, v.visit_date, 'Visita') }
      for (const s of submissions) if (s.status === 'submitted' || s.status === 'reviewed') putRecent(s.student_id, s.updated_at, s.status === 'reviewed' ? 'Ficha revisada' : 'Ficha enviada')
      const since = new Date(Date.now() - RECENT_STUDENT_DAYS * DAY).toISOString()
      const [sr, rc, rv] = await Promise.all([
        db.from('students').select('student_id,first_name,last_name,grade_level,created_at').eq('institution_id', institution).gte('created_at', since).order('created_at', { ascending: false }).limit(20),
        db.from('dece_cases').select('student_id,created_at').eq('institution_id', institution).gte('created_at', since).order('created_at', { ascending: false }).limit(100),
        db.from('dece_visits').select('visit_date,dece_cases!inner(student_id,institution_id)').eq('dece_cases.institution_id', institution).gte('visit_date', since).order('visit_date', { ascending: false }).limit(100),
      ])
      if (!active) return
      if (sr.error || rc.error || rv.error) fail('recent')
      const visitStudentIds = (rv.data ?? []).map((row: Row) => {
        const related = row.dece_cases as { student_id?: string } | Array<{ student_id?: string }> | null
        return Array.isArray(related) ? related[0]?.student_id : related?.student_id
      }).filter((id: string | undefined): id is string => Boolean(id))
      const extraIds = [...new Set([...(rc.data ?? []).map((row: Row) => row.student_id), ...visitStudentIds])].filter(id => !people.has(id))
      if (extraIds.length) {
        const extra = await db.from('students').select('student_id,first_name,last_name,grade_level').eq('institution_id', institution).in('student_id', extraIds)
        if (!active) return
        if (extra.error) fail('recent')
        for (const p of extra.data ?? []) people.set(p.student_id, p)
      }
      for (const p of sr.data ?? []) { people.set(p.student_id, p); putRecent(p.student_id, p.created_at, 'Registrado') }
      for (const c of rc.data ?? []) putRecent(c.student_id, c.created_at, 'Caso abierto')
      for (const v of rv.data ?? []) {
        const relation = v.dece_cases as Person | Person[] | null
        const person = Array.isArray(relation) ? relation[0] : relation
        if (person) putRecent(person.student_id, v.visit_date, 'Visita')
      }
      setRecent([...activity.values()].sort((a,b) => b.at-a.at).slice(0,6))
    })().catch(() => { if (active) { fail('attention'); fail('drafts'); fail('recent') } })
    return () => { active = false }
  }, [integration, refresh])

  const attentionSummary = alerts.length ? `${alerts.length} ${alerts.length === 1 ? 'caso o ficha requiere' : 'casos o fichas requieren'} tu atención hoy` : 'No tienes pendientes urgentes hoy'
  const searchStudents = (e: FormEvent) => {
    e.preventDefault()
    onNavigate('students')
    const base = location.pathname.replace(/\/(estudiantes|casos|plantillas|envios).*$/, '')
    history.replaceState(null, '', `${base}/estudiantes?q=${encodeURIComponent(search.trim())}`)
  }
  const countCards = useMemo(() => [['Estudiantes',counts.students,'students','students'],['Casos abiertos',counts.cases,'cases','cases'],['Fichas por revisar',counts.submitted,'submissions','submitted'],['Fichas en proceso',counts.drafts,'submissions','drafts']] as const, [counts])
  const openAlert = (a: Alert) => a.caseId ? onCase(a.caseId) : onForm(a.student, a.formCode ?? 'general')
  const relative = (at: number, event: string) => { const n = daysBeforeTodayEC(new Date(at)); return `${event} ${n === 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`}` }

  return <main className="page-content container-fluid dece-dashboard">
    <nav className="dash-crumb" aria-label="Ruta de navegación"><span>Inicio</span><span aria-hidden="true">/</span><span>DECE</span></nav>
    <header className="dash-welcome"><div><p className="dash-kicker">DEPARTAMENTO DE CONSEJERÍA ESTUDIANTIL</p><h1>{greeting}{firstName?.trim() ? `, ${firstName.trim()}` : ''}</h1><p className="dash-date">{dateLabel[0]?.toLocaleUpperCase('es-EC')}{dateLabel.slice(1)} · <span>Información confidencial</span></p><p className="dash-summary" aria-live="polite">{attentionSummary}</p></div><span className="dash-mark" aria-hidden="true">DECE</span></header>
    <section aria-labelledby="dash-actions"><h2 id="dash-actions">Acciones rápidas</h2><form className="dash-search input-group mb-3" role="search" onSubmit={searchStudents}><label className="visually-hidden" htmlFor="dash-search">Buscar estudiante por nombre o cédula</label><input id="dash-search" className="form-control" placeholder="Buscar estudiante por nombre o cédula" value={search} onChange={e=>setSearch(e.target.value)}/><button type="submit" className="btn btn-outline-primary">Buscar</button></form><div className="dash-actions"><button className="btn btn-primary" type="button" onClick={()=>onNavigate('students','create')}>Registrar estudiante</button><button className="btn btn-outline-primary" type="button" onClick={()=>onNavigate('cases','create')}>Nuevo caso</button><button className="btn btn-outline-primary" type="button" onClick={()=>onNavigate('forms','create')}>Nueva ficha</button></div></section>
    <section aria-labelledby="dash-counts"><h2 id="dash-counts">Indicadores</h2><div className="dash-counts">{countCards.map(([label,value,target,key])=><button type="button" key={key} className="dash-count" aria-label={`${label}: ${value ?? 'No disponible'}, ver lista`} onClick={()=>onNavigate(target)}><span>{label}</span><strong aria-live="polite">{value ?? (loading?'Cargando…':'—')}</strong>{errors.counts&&<small role="alert">No se pudo cargar esta sección</small>}</button>)}</div></section>
    <div className="dash-columns">
      <section className="dash-panel" aria-labelledby="dash-attention"><header><div><h2 id="dash-attention">Requiere atención hoy</h2><p>Casos y fichas que necesitan seguimiento.</p></div><button className="btn btn-link" type="button" onClick={()=>onNavigate('cases')}>Ver todos</button></header>{errors.attention?<p role="alert">No se pudo cargar esta sección</p>:alerts.length?<ul className="dash-list">{alerts.map(a=><li key={a.key}><button type="button" className="dash-alert" onClick={()=>openAlert(a)}><span className="dash-person">{a.name}{a.caseNumber&&<small>Caso {a.caseNumber}</small>}</span><span className={`dash-level level-${a.kind.toLowerCase()}`}>{a.kind}</span><span className="dash-reason">{a.reason}</span></button></li>)}</ul>:<div className="dash-empty"><b>Todo al día</b><p>No hay casos o fichas que requieran seguimiento ahora.</p></div>}</section>
      <section className="dash-panel" aria-labelledby="dash-drafts"><header><div><h2 id="dash-drafts">Fichas en proceso</h2><p>Borradores recientes de estudiantes.</p></div><button className="btn btn-link" type="button" onClick={()=>onNavigate('submissions')}>Ver todas</button></header>{errors.drafts?<p role="alert">No se pudo cargar esta sección</p>:drafts.length?<ul className="dash-list">{drafts.map(d=><li key={d.id}><button className="dash-draft" type="button" onClick={()=>onForm(d.student,d.code)}><span className="dash-initials">{d.initials}</span><span className="dash-draft-info"><b>{d.name}</b><small>{d.title}</small>{d.total>0&&<span className="dash-progress"><span role="progressbar" aria-label={`Progreso de ${d.title} de ${d.name}: ${d.answered} de ${d.total} respondidas`} aria-valuenow={Math.round(d.answered/d.total*100)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${Math.min(100,d.answered/d.total*100)}%`}}/></span><small>{d.answered} de {d.total} respondidas</small></span>}</span></button></li>)}</ul>:<p className="dash-empty">{loading?'Cargando…':'No hay fichas en proceso.'}</p>}</section>
    </div>
    <section className="dash-panel dash-recent" aria-labelledby="dash-recent"><header><div><h2 id="dash-recent">Estudiantes recientes</h2><p>Actividad de los últimos 14 días.</p></div><button className="btn btn-link" type="button" onClick={()=>onNavigate('students')}>Ver directorio</button></header>{errors.recent?<p role="alert">No se pudo cargar esta sección</p>:recent.length?<ul className="dash-recent-list">{recent.map(r=><li key={r.id}><button type="button" onClick={()=>onStudent(r.id)}><span className="dash-initials">{r.initials}</span><b>{r.name}</b><small>{r.grade}</small><span>{relative(r.at,r.event)}</span></button></li>)}</ul>:<p className="dash-empty">No hay actividad reciente.</p>}</section>
  </main>
}
