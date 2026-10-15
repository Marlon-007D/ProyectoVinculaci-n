import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight, Dumbbell, FlaskConical, GraduationCap, Landmark, Languages, Laptop, Lightbulb, Palette, Sigma } from 'lucide-react'
import { schoolCoursesMock } from '../mocks/schoolCoursesMock'
import { schoolModulesMock } from '../mocks/schoolModulesMock'
import { QuestionBank } from '../components/QuestionBank'
import './SchoolCoursesPage.css'

const subjectIcons = {
  matematica: Sigma,
  lengua: BookOpen,
  ciencias: FlaskConical,
  'estudios-sociales': Landmark,
  ingles: Languages,
  'educacion-fisica': Dumbbell,
  'educacion-cultural': Palette,
  emprendimiento: Lightbulb,
  ciudadania: GraduationCap,
  informatica: Laptop,
}
const noop = () => undefined
interface Props { selectedModuleId?: string | null; selectedCourseId?: string | null; evaluationActive?: boolean; onSelectCourse?: (courseId: string) => void; onTopicChange?: (topicTitle: string) => void; onEvaluationChange?: (active: boolean) => void }

export function SchoolCoursesPage({ selectedModuleId = null, selectedCourseId = null, evaluationActive = false, onSelectCourse = noop, onTopicChange = noop, onEvaluationChange = noop }: Props) {
  const [selectedTopic, setSelectedTopic] = useState(0)
  useEffect(() => { setSelectedTopic(0); const firstTopic = schoolCoursesMock.find(course => course.id === selectedCourseId)?.units[0]?.title; if (firstTopic) onTopicChange(firstTopic); onEvaluationChange(false) }, [selectedCourseId, onTopicChange, onEvaluationChange])

  const selectedCourse = schoolCoursesMock.find(course => course.id === selectedCourseId)
  const selectedModule = schoolModulesMock.find(module => module.id === selectedModuleId)
  if (selectedCourse) {
    const topic = selectedCourse.units[selectedTopic]
    if (evaluationActive) return <section className="page-content school-courses-page course-evaluation-page">
      <QuestionBank key={`${selectedCourse.id}-${topic.title}-assessment`} courseId={selectedCourse.id} courseName={selectedCourse.name} topicTitle={topic.title} mode="assessment" onExit={() => onEvaluationChange(false)} />
    </section>
    return <section className="page-content school-courses-page course-detail-page">
      <section className="course-topics-section" aria-label="Resumen del tema">
        <div className="course-topic-layout">
          <nav className="course-topic-nav" aria-label={`Temas de ${selectedCourse.name}`}><div className="course-topic-course-info"><h1>{selectedCourse.name}</h1><p>{selectedCourse.description}</p></div>{selectedCourse.units.map((item, index) => <button type="button" key={item.title} className={selectedTopic === index ? 'active' : ''} aria-current={selectedTopic === index ? 'step' : undefined} onClick={() => { setSelectedTopic(index); onTopicChange(item.title); if (evaluationActive) onEvaluationChange(false) }}><span>{String(index + 1).padStart(2, '0')}</span><span>{item.title}</span></button>)}<button type="button" className="course-evaluation-topic" onClick={() => onEvaluationChange(true)}><span>{String(selectedCourse.units.length + 1).padStart(2, '0')}</span><span>Evaluaciones</span></button></nav>
          <article className="course-topic-content"><h2 className="course-topic-summary-title">Resumen del tema</h2><span className="course-topic-label">Tema {selectedTopic + 1} de {selectedCourse.units.length}</span><h3>{topic.title}</h3><p>{topic.description}</p><div className="course-topic-resource"><BookOpen size={18} /><span>Revisa el contenido y luego practica con las preguntas.</span></div></article>
        </div>
      </section>
    </section>
  }

  if (selectedModule) {
    const moduleCourses = selectedModule.courseIds
      .map(id => schoolCoursesMock.find(course => course.id === id))
      .filter((course): course is (typeof schoolCoursesMock)[number] => course !== undefined)
      .slice(0, 5)
    return <section className="page-content school-courses-page">
      <header className="school-courses-header module-courses-header">
        <div><span className="school-courses-kicker"><GraduationCap size={17} /> Módulo</span><h1>{selectedModule.name}</h1><p>{selectedModule.description}</p></div>
        <span className="module-course-total">{moduleCourses.length} {moduleCourses.length === 1 ? 'curso' : 'cursos'}</span>
      </header>
      <div className="school-subject-grid" aria-label={`Cursos del módulo ${selectedModule.name}`}>
        {moduleCourses.map(subject => {
          const Icon = subjectIcons[subject.id as keyof typeof subjectIcons]
          return <article className="school-subject-card" key={subject.id}>
            <div className="school-subject-heading"><span className="school-subject-icon"><Icon size={21} /></span><span className="school-unit-count">{subject.units.length} temas</span></div>
            <h2>{subject.name}</h2><p>{subject.description}</p>
            <button type="button" className="school-units-toggle" onClick={() => onSelectCourse(subject.id)}>Entrar al curso<ChevronRight size={17} /></button>
          </article>
        })}
      </div>
    </section>
  }

  return <section className="page-content school-courses-page">
    <header className="school-courses-header">
      <div><span className="school-courses-kicker"><GraduationCap size={17} /> Módulos de estudio</span><h1>Selecciona un módulo</h1><p>Elige un módulo desde el aside para ver sus cursos.</p><span className="school-course-total-label">Total de cursos <strong>{schoolCoursesMock.length}</strong></span></div>
    </header>
    <div className="school-course-prompt"><BookOpen size={21} /><span>Abre <strong>Cursos → Módulos</strong> en el aside y selecciona un módulo.</span></div>
  </section>
}
