import { useEffect, useMemo, useState } from 'react'
import styles from './dece.module.css'
import { ProvisionalShell } from './components/provisional-shell'
import { dashboardStats } from './data'
import { AuthorizationFormPage } from './pages/authorization-form'
import { DashboardPage } from './pages/dashboard'
import { GeneralFormPage } from './pages/general-form'
import { StudentDirectoryPage } from './pages/student-directory'
import { useDeceData } from './services/dece-data-context'
import { createDeceFormService } from './services/form-service'
import type { DeceScreen, Student } from './types'

export default function DeceApp() {
  const integration = useDeceData()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formSetupError, setFormSetupError] = useState('')
  const [formSetupRetry, setFormSetupRetry] = useState(0)
  const [formSetupLoading, setFormSetupLoading] = useState(true)
  const [screen, setScreen] = useState<DeceScreen>('home')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState('Todos los grados')
  const [section, setSection] = useState(0)

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
    let current = true
    if (!integration) { setLoading(false); setLoadError('No hay una institución activa en la sesión.'); return }
    setLoading(true)
    void integration.client.from('students')
      .select('student_id, national_id, first_name, grade_level')
      .eq('institution_id', integration.institutionId)
      .order('first_name')
      .then(({ data, error }) => {
        if (!current) return
        if (error) setLoadError(error.code === '42501' ? 'No tienes permiso para consultar estudiantes de esta institución.' : 'No se pudo cargar el directorio de estudiantes.')
        else {
          const colors = ['lavender', 'mint', 'peach', 'blue', 'rose']
          const rows = (data ?? []) as Array<{ student_id: string; national_id: string | null; first_name: string; grade_level: string | null }>
          const mapped = rows.map((row, index) => ({
            recordId: row.student_id,
            id: row.national_id ?? 'Sin identificación',
            name: row.first_name,
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

  const filteredStudents = useMemo(() => students.filter(student => {
    const matchesQuery = student.name.toLowerCase().includes(query.toLowerCase()) || student.id.includes(query)
    const matchesGrade = grade === 'Todos los grados' || student.grade === grade
    return matchesQuery && matchesGrade
  }), [query, grade])

  const openForm = (student: Student, target: DeceScreen) => {
    setSelectedStudent(student)
    setSection(0)
    setScreen(target)
  }

  const formProps = selectedStudent ? {
    student: selectedStudent,
    section,
    setSection,
    onBack: () => setScreen('students'),
    onNavigate: (target: DeceScreen) => openForm(selectedStudent, target),
  } : null

  if (loading) return <div className="container py-5" role="status">Cargando estudiantes…</div>
  if (loadError && !students.length) return <div className="container py-5" role="alert">{loadError}</div>
  if (!integration) return <div className="container py-5" role="alert">No hay una institución activa en la sesión.</div>

  const stats = dashboardStats.map((item, index) => index === 0
    ? { ...item, value: String(students.length), hint: 'En esta institución' }
    : { ...item, value: '—', hint: 'Sin datos disponibles' })

  return (
    <div className={styles.appShell}>
      <ProvisionalShell screen={screen} onNavigate={setScreen}>
        {formSetupLoading && <div className="notice" role="status">Preparando las fichas general y de autorización…</div>}
        {formSetupError && <div className="notice sensitive" role="alert">{formSetupError}<button className="button btn secondary ms-2" type="button" onClick={() => setFormSetupRetry(value => value + 1)}>Reintentar</button></div>}
        {screen === 'home' && (
          <DashboardPage
            students={students.slice(0, 3)}
            featuredStudent={students[0]}
            stats={stats}
            onList={() => setScreen('students')}
            onOpen={openForm}
          />
        )}
        {screen === 'students' && (
          <StudentDirectoryPage
            data={filteredStudents}
            query={query}
            setQuery={setQuery}
            grade={grade}
            setGrade={setGrade}
            onOpen={openForm}
          />
        )}
        {screen === 'general' && formProps && <GeneralFormPage {...formProps} />}
        {screen === 'authorization' && formProps && <AuthorizationFormPage {...formProps} />}
      </ProvisionalShell>
    </div>
  )
}
