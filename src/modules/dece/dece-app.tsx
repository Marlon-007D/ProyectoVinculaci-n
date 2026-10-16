import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './dece.module.css'
import { ProvisionalShell } from './components/provisional-shell'
import { dashboardStats } from './data'
import { AuthorizationFormPage } from './pages/authorization-form'
import { DashboardPage } from './pages/dashboard'
import { GeneralFormPage } from './pages/general-form'
import StudentManagementPage from './pages/student-management-page'
import FormManagementPage from './pages/form-management-page'
import ConfigurableForm from './pages/student-form/configurable-form'
import FormSubmissionsPage from './pages/form-submissions-page'
import CasesPage from './pages/cases-page'
import { useDeceData } from './services/dece-data-context'
import { createDeceFormService } from './services/form-service'
import type { DeceScreen, Student } from './types'
type FormTemplate = { code: string; name: string }

export default function DeceApp() {
  const appShellRef = useRef<HTMLDivElement>(null)
  const integration = useDeceData()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formSetupError, setFormSetupError] = useState('')
  const [formSetupRetry, setFormSetupRetry] = useState(0)
  const [formSetupLoading, setFormSetupLoading] = useState(true)
  const [screen, setScreen] = useState<DeceScreen>(() => location.pathname.split('/').filter(Boolean)[2] === 'estudiantes' ? 'students' : location.pathname.split('/').filter(Boolean)[2] === 'casos' ? 'cases' : 'home')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [caseStudentId, setCaseStudentId] = useState('')
  const [openCases, setOpenCases] = useState('—')
  const [section, setSection] = useState(0)
  const [selectedFormCode, setSelectedFormCode] = useState('')
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([])
  const [customSections, setCustomSections] = useState<string[]>([])
  const syncCustomSections = useCallback((names: string[]) => {
    setCustomSections(current => current.length === names.length && current.every((name, index) => name === names[index]) ? current : names)
    setSection(current => current >= names.length ? 0 : current)
  }, [])
  const clearCaseStudent = useCallback(() => setCaseStudentId(''), [])

  useEffect(() => {
    const shell = appShellRef.current
    const layout = shell?.closest('.min-h-screen')
    const header = layout?.querySelector(':scope > header')
    if (!shell || !(header instanceof HTMLElement)) return

    const updateHeaderHeight = () => {
      shell.style.setProperty('--dece-header-height', `${header.getBoundingClientRect().height}px`)
    }
    updateHeaderHeight()
    const observer = new ResizeObserver(updateHeaderHeight)
    observer.observe(header)
    window.addEventListener('resize', updateHeaderHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateHeaderHeight)
    }
  }, [])

  useEffect(() => {
    if (!integration) return
    let current = true
    setFormSetupLoading(true)
    void createDeceFormService(integration.client).ensureStandardForms(integration.institutionId)
      .then(() => { if (current) setFormSetupError('') })
      .catch(error => {
        if (!current) return
        setFormSetupError(error?.code === '42501'
          ? 'No tienes permiso para preparar las fichas de esta institución (42501).'
          : `No se pudieron preparar las fichas${error?.code ? ` (${error.code})` : ''}: ${error?.message ?? 'revisa la función create_dece_default_forms y sus permisos'}`)
      })
      .finally(() => { if (current) setFormSetupLoading(false) })
    return () => { current = false }
  }, [integration, formSetupRetry])

  useEffect(() => {
    const syncRoute = () => { const section = location.pathname.split('/').filter(Boolean)[2]; setScreen(section === 'estudiantes' ? 'students' : section === 'casos' ? 'cases' : 'home') }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    if (!integration || (screen !== 'home' && screen !== 'students' && screen !== 'cases')) return
    let current = true
    void createDeceFormService(integration.client).listFormTemplates(integration.institutionId)
      .then(templates => { if (current) setFormTemplates(templates.map(({ code, name }) => ({ code, name }))) })
      .catch(() => { if (current) setFormTemplates([]) })
    return () => { current = false }
  }, [integration, screen])

  useEffect(() => {
    let current = true
    if (!integration) { setLoading(false); setLoadError('No hay una institución activa en la sesión.'); return }
    setLoading(true)
    void integration.client.from('students')
      .select('student_id, national_id, first_name, last_name, grade_level')
      .eq('institution_id', integration.institutionId)
      .order('first_name')
      .then(({ data, error }) => {
        if (!current) return
        if (error) setLoadError(error.code === '42501' ? 'No tienes permiso para consultar estudiantes de esta institución.' : 'No se pudo cargar el directorio de estudiantes.')
        else {
          const colors = ['lavender', 'mint', 'peach', 'blue', 'rose']
          const rows = (data ?? []) as Array<{ student_id: string; national_id: string | null; first_name: string; last_name: string; grade_level: string | null }>
          const mapped = rows.map((row, index) => ({
            recordId: row.student_id,
            id: row.national_id ?? 'Sin identificación',
            name: `${row.first_name} ${row.last_name}`.trim(),
            firstName: row.first_name,
            lastName: row.last_name,
            grade: row.grade_level ?? 'Sin grado',
            initials: row.first_name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
            color: colors[index % colors.length],
          }))
          setStudents(mapped)
          setSelectedStudent(mapped[0] ?? null)
          setLoadError(mapped.length ? '' : 'No tienes permiso para consultar estudiantes de esta institución, o no hay registros visibles.')
        }
        setLoading(false)
      })
    return () => { current = false }
  }, [integration])

  useEffect(() => {
    if (!integration) return
    let live = true
    void integration.client.from('dece_cases').select('dece_case_id', { count: 'exact', head: true }).eq('institution_id', integration.institutionId).neq('status', 'closed').then(({ count, error }) => {
      if (!live) return
      setOpenCases(error ? '—' : String(count ?? 0))
    })
    return () => { live = false }
  }, [integration])

  const syncSavedStudent = useCallback((saved: Student) => {
    setStudents(current => {
      const exists = current.some(student => student.recordId === saved.recordId)
      const next = exists
        ? current.map(student => student.recordId === saved.recordId ? { ...student, ...saved } : student)
        : [...current, saved]
      return next.sort((left, right) => left.firstName?.localeCompare(right.firstName ?? '', 'es') ?? left.name.localeCompare(right.name, 'es'))
    })
    setSelectedStudent(current => current?.recordId === saved.recordId ? { ...current, ...saved } : current)
    setLoadError('')
  }, [])

  const routeTo = (target: DeceScreen) => {
    if (integration?.slug) history.pushState(null, '', target === 'students' ? `/${integration.slug}/dece/estudiantes` : target === 'cases' ? `/${integration.slug}/dece/casos` : `/${integration.slug}/dece`)
    setScreen(target)
  }

  const openForm = (student: Student, target: DeceScreen) => {
    setSelectedStudent(student)
    setSection(0)
    routeTo(target)
  }

  const openCustomForm = (student: Student, code: string) => {
    setSelectedStudent(student)
    setSelectedFormCode(code)
    setSection(0)
    routeTo('custom-form')
  }

  const openSubmissionForm = (student: Student, code: string) => {
    if (code === 'general' || code === 'authorization') openForm(student, code)
    else openCustomForm(student, code)
  }

  const formProps = selectedStudent ? {
    student: selectedStudent,
    section,
    setSection,
    onBack: () => routeTo('students'),
    onNavigate: (target: DeceScreen) => openForm(selectedStudent, target),
  } : null

  if (loading) return <div className="container py-5" role="status">Cargando estudiantes…</div>
  if (loadError && !students.length && screen !== 'students') return <div className="container py-5" role="alert">{loadError}</div>
  if (!integration) return <div className="container py-5" role="alert">No hay una institución activa en la sesión.</div>

  const stats = dashboardStats.map(item => item.label === 'Estudiantes registrados'
    ? { ...item, value: String(students.length), hint: 'En esta institución' }
    : item.label === 'Casos abiertos' ? { ...item, value: openCases, hint: 'En esta institución' }
    : { ...item, value: '—', hint: 'Sin datos disponibles' })

  return (
    <div ref={appShellRef} className={styles.appShell}>
      <ProvisionalShell screen={screen} onNavigate={routeTo}>
        {formSetupLoading && <div className="notice" role="status">Preparando las fichas general y de autorización…</div>}
        {formSetupError && <div className="notice sensitive" role="alert">{formSetupError}<button className="button btn secondary ms-2" type="button" onClick={() => setFormSetupRetry(value => value + 1)}>Reintentar</button></div>}
        {screen === 'home' && (
          <DashboardPage
            students={students.slice(0, 3)}
            featuredStudent={students[0]}
            stats={stats}
            onList={() => routeTo('students')}
            onOpen={openForm}
          />
        )}
        {screen === 'students' && <StudentManagementPage onOpenForm={openSubmissionForm} onStudentSaved={syncSavedStudent} onOpenCases={studentId => { setCaseStudentId(studentId); routeTo('cases') }} />}
        {screen === 'cases' && <CasesPage initialStudentId={caseStudentId} onInitialStudentUsed={clearCaseStudent} />}
        {screen === 'forms' && <FormManagementPage />}
        {screen === 'submissions' && <FormSubmissionsPage onOpen={openSubmissionForm} />}
        {screen === 'custom-form' && selectedStudent && <div className="page-content container-fluid">
          <div className="welcome-row"><div><h1>{formTemplates.find(form => form.code === selectedFormCode)?.name ?? 'Ficha personalizada'}</h1><p>{selectedStudent.name} · {selectedStudent.grade}</p></div><button className="button btn secondary" onClick={() => routeTo('students')}>Volver al directorio</button></div>
          <nav className="studentPortal__sections mb-3" aria-label="Secciones de la ficha">{customSections.map((name, index) => <button type="button" key={name} className={section === index ? 'active' : ''} onClick={() => setSection(index)}>{String(index + 1).padStart(2, '0')} · {name}</button>)}</nav>
          <ConfigurableForm key={`${selectedStudent.recordId}-${selectedFormCode}`} integration={integration} student={selectedStudent} code={selectedFormCode} section={section} onSectionsChange={syncCustomSections} audience="staff" />
        </div>}
        {screen === 'general' && formProps && <GeneralFormPage {...formProps} />}
        {screen === 'authorization' && formProps && <AuthorizationFormPage {...formProps} />}
      </ProvisionalShell>
    </div>
  )
}
