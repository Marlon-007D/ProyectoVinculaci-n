import { useMemo, useState } from 'react'
import styles from './dece.module.css'
import { ProvisionalShell } from './components/provisional-shell'
import { dashboardStats, students } from './data'
import { AuthorizationFormPage } from './pages/authorization-form'
import { DashboardPage } from './pages/dashboard'
import { GeneralFormPage } from './pages/general-form'
import { StudentDirectoryPage } from './pages/student-directory'
import type { DeceScreen, Student } from './types'

export default function DeceApp() {
  const [screen, setScreen] = useState<DeceScreen>('home')
  const [selectedStudent, setSelectedStudent] = useState<Student>(students[0])
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState('Todos los grados')
  const [section, setSection] = useState(0)

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

  const formProps = {
    student: selectedStudent,
    section,
    setSection,
    onBack: () => setScreen('students'),
    onNavigate: (target: DeceScreen) => openForm(selectedStudent, target),
  }

  return (
    <div className={styles.appShell}>
      <ProvisionalShell screen={screen} onNavigate={setScreen}>
        {screen === 'home' && (
          <DashboardPage
            students={students.slice(0, 3)}
            featuredStudent={students[0]}
            stats={dashboardStats}
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
        {screen === 'general' && <GeneralFormPage {...formProps} />}
        {screen === 'authorization' && <AuthorizationFormPage {...formProps} />}
      </ProvisionalShell>
    </div>
  )
}
