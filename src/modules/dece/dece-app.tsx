import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './dece.module.css'
import { ProvisionalShell } from './components/provisional-shell'
import { AuthorizationFormPage } from './pages/authorization-form'
import { DashboardPage } from './pages/dashboard'
import { GeneralFormPage } from './pages/general-form'
import StudentManagementPage from './pages/student-management-page'
import FormManagementPage from './pages/form-management-page'
import ConfigurableForm from './pages/student-form/configurable-form'
import FormSubmissionsPage from './pages/form-submissions-page'
import CasesPage from './pages/cases-page'
import PdfActionButton from './components/pdf-action-button'
import { createDecePdfService } from './services/pdf-service'
import { useDeceData } from './services/dece-data-context'
import { createDeceFormService } from './services/form-service'
import type { DeceScreen, Student } from './types'
type FormTemplate = { code: string; name: string }

function getDeceRouteSection() {
  const segments = location.pathname.split('/').filter(Boolean)
  const deceIndex = segments.indexOf('dece')
  return deceIndex >= 0 ? segments[deceIndex + 1] ?? '' : ''
}

function screenForRoute(section: string): DeceScreen {
  if (section === 'estudiantes') return 'students'
  if (section === 'casos') return 'cases'
  if (section === 'plantillas') return 'forms'
  if (section === 'envios') return 'submissions'
  return 'home'
}

export default function DeceApp() {
  const appShellRef = useRef<HTMLDivElement>(null)
  const integration = useDeceData()
  const [firstName, setFirstName] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [formSetupError, setFormSetupError] = useState('')
  const [formSetupRetry, setFormSetupRetry] = useState(0)
  const [formSetupLoading, setFormSetupLoading] = useState(true)
  const [screen, setScreen] = useState<DeceScreen>(() => screenForRoute(getDeceRouteSection()))
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [caseStudentId, setCaseStudentId] = useState('')
  const [section, setSection] = useState(0)
  const [selectedFormCode, setSelectedFormCode] = useState('')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('')
  const [selectedSubmissionReadOnly, setSelectedSubmissionReadOnly] = useState(false)
  const submissionReturnUrl = useRef('')
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
    const syncRoute = () => { setScreen(screenForRoute(getDeceRouteSection())) }
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
    if (!integration?.profileId) { setFirstName(''); return }
    let active = true
    void integration.client.from('profiles').select('first_name').eq('profile_id', integration.profileId).maybeSingle()
      .then(({ data, error }) => { if (active) setFirstName(error ? '' : data?.first_name?.trim() ?? '') })
    return () => { active = false }
  }, [integration?.client, integration?.profileId])

  useEffect(() => {
    if (!integration) { setAccountEmail(''); return }
    let active = true
    void integration.client.auth.getUser().then(({ data, error }) => {
      if (active) setAccountEmail(error ? '' : data.user?.email ?? '')
    })
    return () => { active = false }
  }, [integration?.client])

  const syncSavedStudent = useCallback((saved: Student) => {
    setSelectedStudent(current => current?.recordId === saved.recordId ? { ...current, ...saved } : current)
    window.dispatchEvent(new Event('dece:dashboard-refresh'))
  }, [])

  const getBasePath = () => location.pathname.startsWith('/panel/dece')
    ? '/panel/dece'
    : integration?.slug ? `/${integration.slug}/dece` : '/panel/dece'

  const routeTo = (target: DeceScreen, intent?: 'create') => {
    const basePath = getBasePath()
    const targetPath = target === 'students' || target === 'custom-form' ? `${basePath}/estudiantes`
      : target === 'cases' ? `${basePath}/casos`
      : target === 'forms' ? `${basePath}/plantillas`
      : target === 'submissions' ? `${basePath}/envios`
      : basePath
    history.pushState(null, '', `${targetPath}${intent === 'create' ? '?crear=1' : ''}`)
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

  const openSubmissionForm = (student: Student, code: string, submissionId?: string, readOnly = false) => {
    if (submissionId) {
      submissionReturnUrl.current = `${location.pathname}${location.search}`
      setSelectedSubmissionId(submissionId)
      setSelectedSubmissionReadOnly(readOnly)
    } else { setSelectedSubmissionId(''); setSelectedSubmissionReadOnly(false) }
    if (!submissionId && (code === 'general' || code === 'authorization')) openForm(student, code)
    else openCustomForm(student, code)
  }

  const signOut = async () => {
    const { error } = await integration?.client.auth.signOut() ?? { error: null }
    if (error) return
    window.location.assign(integration?.slug ? `/${integration.slug}/login` : '/login')
  }

  const formProps = selectedStudent ? {
    student: selectedStudent,
    section,
    setSection,
    onBack: () => {
      if (selectedSubmissionId) {
        history.pushState(null, '', submissionReturnUrl.current || `${getBasePath()}/envios`)
        setScreen('submissions')
        window.scrollTo(0, 0)
      } else routeTo('students')
    },
    onNavigate: (target: DeceScreen) => openForm(selectedStudent, target),
    allowQuestionManagement: !selectedSubmissionId,
    detailReview: Boolean(selectedSubmissionId),
    onDownloadPdf: selectedSubmissionId && integration ? async () => createDecePdfService(integration.client).filledForm(integration.institutionId, selectedSubmissionId, integration.profileId) : undefined,
  } : null

  if (!integration) return <div className="container py-5" role="alert">No hay una institución activa en la sesión.</div>

  return (
    <div ref={appShellRef} className={styles.appShell}>
      <ProvisionalShell screen={screen} onNavigate={routeTo} accountEmail={accountEmail} onSignOut={() => void signOut()}>
        {formSetupLoading && <div className="notice" role="status">Preparando las fichas general y de autorización…</div>}
        {formSetupError && <div className="notice sensitive" role="alert">{formSetupError}<button className="button btn secondary ms-2" type="button" onClick={() => setFormSetupRetry(value => value + 1)}>Reintentar</button></div>}
        {screen === 'home' && (
          <DashboardPage onNavigate={routeTo} firstName={firstName}
            onStudent={studentId => { history.pushState(null, '', `${getBasePath()}/estudiantes/${studentId}`); setScreen('students') }}
            onCase={caseId => { history.pushState(null, '', `${getBasePath()}/casos/${caseId}`); setScreen('cases') }}
            onForm={(studentId, code) => { void integration.client.from('students').select('student_id,national_id,first_name,last_name,grade_level').eq('institution_id', integration.institutionId).eq('student_id', studentId).maybeSingle().then(({ data }) => { if (data) openSubmissionForm({ recordId: data.student_id, id: data.national_id ?? '', firstName: data.first_name, lastName: data.last_name, name: `${data.first_name} ${data.last_name}`.trim(), grade: data.grade_level ?? 'Sin grado', initials: `${data.first_name} ${data.last_name}`.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase(), color: 'lavender' }, code) }) }} />
        )}
        {screen === 'students' && <StudentManagementPage onOpenForm={openSubmissionForm} onStudentSaved={syncSavedStudent} onOpenCases={studentId => { setCaseStudentId(studentId); routeTo('cases') }} onOpenCase={caseId => { history.pushState(null, '', `${getBasePath()}/casos/${caseId}`); setScreen('cases') }} />}
        {screen === 'cases' && <CasesPage initialStudentId={caseStudentId} onInitialStudentUsed={clearCaseStudent} />}
        {screen === 'forms' && <FormManagementPage />}
        {screen === 'submissions' && <FormSubmissionsPage onOpen={openSubmissionForm} />}
        {screen === 'custom-form' && selectedStudent && <div className="page-content container-fluid">
          {selectedSubmissionId && <nav aria-label="Migas de pan" className="mb-3"><ol className="breadcrumb"><li className="breadcrumb-item"><button type="button" className="btn btn-link p-0" onClick={() => formProps?.onBack()}>Revisión de fichas</button></li><li className="breadcrumb-item active" aria-current="page">{formTemplates.find(form => form.code === selectedFormCode)?.name ?? 'Ficha personalizada'}</li></ol></nav>}
          <div className="welcome-row"><div><h1>{formTemplates.find(form => form.code === selectedFormCode)?.name ?? 'Ficha personalizada'}</h1><p>{selectedStudent.name} · {selectedStudent.grade}</p></div><div className="d-flex flex-wrap gap-2">{selectedSubmissionId && <PdfActionButton label="Descargar ficha llena" generate={async () => createDecePdfService(integration.client).filledForm(integration.institutionId, selectedSubmissionId, integration.profileId)} />}<button className="button btn secondary" onClick={() => formProps?.onBack()}>{selectedSubmissionId ? 'Volver a revisión de fichas' : 'Volver al directorio'}</button></div></div>
          <nav className="studentPortal__sections mb-3" aria-label="Secciones de la ficha">{customSections.map((name, index) => <button type="button" key={name} className={section === index ? 'active' : ''} onClick={() => setSection(index)}>{String(index + 1).padStart(2, '0')} · {name}</button>)}</nav>
          <ConfigurableForm key={`${selectedStudent.recordId}-${selectedFormCode}-${selectedSubmissionId}`} integration={integration} student={selectedStudent} code={selectedFormCode} section={section} onSectionsChange={syncCustomSections} audience="staff" allowQuestionManagement={!selectedSubmissionId} submissionId={selectedSubmissionId || undefined} readOnly={selectedSubmissionReadOnly} />
        </div>}
        {screen === 'general' && formProps && <GeneralFormPage {...formProps} />}
        {screen === 'authorization' && formProps && <AuthorizationFormPage {...formProps} />}
      </ProvisionalShell>
    </div>
  )
}
