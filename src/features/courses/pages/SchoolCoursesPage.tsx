import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChartNoAxesCombined, ChevronRight, ClipboardCheck, Dumbbell, FlaskConical, GraduationCap, Landmark, Languages, Laptop, Lightbulb, Palette, Ruler, Sigma } from 'lucide-react'
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
interface Props { selectedModuleId?: string | null; selectedCourseId?: string | null; evaluationActive?: boolean; onSelectModule?: (moduleId: string) => void; onSelectCourse?: (courseId: string) => void; courseHrefFor?: (courseId: string) => string; onBackToModules?: () => void; onBackToModule?: () => void; onTopicChange?: (topicTitle: string) => void; onEvaluationChange?: (active: boolean) => void }

function CourseBreadcrumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return <nav className="course-breadcrumbs" aria-label="Migas de pan"><ol>{items.map((item, index) => <li key={`${item.label}-${index}`}>{item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>
}

export function SchoolCoursesPage({ selectedModuleId = null, selectedCourseId = null, evaluationActive = false, onSelectModule = noop, onSelectCourse = noop, courseHrefFor, onBackToModules = noop, onBackToModule = noop, onTopicChange = noop, onEvaluationChange = noop }: Props) {
  const [selectedTopic, setSelectedTopic] = useState(0)
  useEffect(() => { setSelectedTopic(0); const firstTopic = schoolCoursesMock.find(course => course.id === selectedCourseId)?.units[0]?.title; if (firstTopic) onTopicChange(firstTopic); onEvaluationChange(false) }, [selectedCourseId, onTopicChange, onEvaluationChange])

  const selectedCourse = schoolCoursesMock.find(course => course.id === selectedCourseId)
  const selectedModule = schoolModulesMock.find(module => module.id === selectedModuleId)
  const moduleIcons = [Sigma, Laptop, Languages, FlaskConical, Palette]
  if (selectedCourse) {
    const topic = selectedCourse.units[selectedTopic]
    const hasDistinctModule = selectedModule?.name.trim().toLocaleLowerCase('es') !== selectedCourse.name.trim().toLocaleLowerCase('es')
    const topicIcons = [BookOpen, Ruler, ChartNoAxesCombined, Sigma]
    return <section className="page-content school-courses-page course-detail-page">
      <CourseBreadcrumbs items={[{ label: 'Cursos', onClick: onBackToModules }, ...(selectedModule && hasDistinctModule ? [{ label: selectedModule.name, onClick: onBackToModule }] : []), { label: selectedCourse.name }]} />
      <section className="course-topics-section" aria-label="Resumen del tema">
        <div className="course-topic-layout">
          <nav className="course-topic-nav" aria-label={`Secciones de ${selectedCourse.name}`}>
            {selectedCourse.units.map((item, index) => {
            const TopicIcon = topicIcons[index % topicIcons.length]
            const isActiveTopic = selectedTopic === index && !evaluationActive
            return <button type="button" key={item.title} className={`course-topic-tab course-topic-tab-${index % topicIcons.length}${isActiveTopic ? ' active' : ''}`} aria-current={isActiveTopic ? 'page' : undefined} onClick={() => { setSelectedTopic(index); onTopicChange(item.title); onEvaluationChange(false) }}><span className="course-topic-tab-icon"><TopicIcon size={17} aria-hidden="true" /></span><span>{item.title}</span></button>
          })}
            <button type="button" className={`course-topic-tab course-evaluation-topic${evaluationActive ? ' active' : ''}`} aria-current={evaluationActive ? 'page' : undefined} onClick={() => onEvaluationChange(!evaluationActive)}><span className="course-topic-tab-icon"><ClipboardCheck size={17} aria-hidden="true" /></span><span>Evaluaciones</span></button>
          </nav>
          {!evaluationActive && <article className="course-topic-content"><h2 className="course-topic-summary-title">Resumen de la subsección</h2><h3>{topic.title}</h3><p>{topic.description}</p><div className="course-topic-resource"><BookOpen size={18} /><span>Revisa el contenido y luego practica con las preguntas.</span></div></article>}
        </div>
      </section>
      {evaluationActive && <QuestionBank key={`${selectedCourse.id}-${topic.title}-assessment`} courseId={selectedCourse.id} courseName={selectedCourse.name} topicTitle={topic.title} mode="entry" onExit={() => onEvaluationChange(false)} />}
    </section>
  }

  if (selectedModule) {
    const moduleCourses = selectedModule.courseIds
      .map(id => schoolCoursesMock.find(course => course.id === id))
      .filter((course): course is (typeof schoolCoursesMock)[number] => course !== undefined)
      .slice(0, 5)
    return <section className="page-content school-courses-page school-module-courses">
      <CourseBreadcrumbs items={[{ label: 'Cursos', onClick: onBackToModules }, { label: selectedModule.name }]} />
      <div className="school-subject-grid" aria-label={`Cursos del módulo ${selectedModule.name}`}>
        {moduleCourses.map(subject => {
          const Icon = subjectIcons[subject.id as keyof typeof subjectIcons]
          return <Link className="school-module-card school-subject-card" key={subject.id} to={courseHrefFor?.(subject.id) ?? '#'} aria-label={`Entrar al curso ${subject.name}`} onClick={event => { onSelectCourse(subject.id); if (!courseHrefFor) event.preventDefault() }}>
            <span className="school-module-cover-wrap"><img className="school-module-cover" src={subject.coverImage} alt="" loading="lazy" /><span className="school-module-cover-title"><span className="school-module-icon"><Icon size={22} /></span><strong>{subject.name}</strong></span></span>
            <span className="school-module-info"><span>{subject.description}</span></span>
            <span className="school-module-footer"><span className="school-module-count">{subject.units.length} temas</span><ChevronRight size={18} /></span>
          </Link>
        })}
      </div>
    </section>
  }

  return <section className="page-content school-courses-page school-modules-home">
    <div className="school-module-grid" aria-label="Módulos de estudio">{schoolModulesMock.map((module, index) => {
      const Icon = moduleIcons[index % moduleIcons.length]
      const cover = schoolCoursesMock.find(course => course.id === module.courseIds[0])?.coverImage
      return <button type="button" className="school-module-card" key={module.id} onClick={() => onSelectModule(module.id)}><span className="school-module-cover-wrap"><img className="school-module-cover" src={cover} alt="" loading="lazy" /><span className="school-module-cover-title"><span className="school-module-icon"><Icon size={22} /></span><strong>{module.name}</strong></span></span><span className="school-module-info"><span>{module.description}</span></span><span className="school-module-footer"><span className="school-module-count">{module.courseIds.length} {module.courseIds.length === 1 ? 'curso' : 'cursos'}</span><ChevronRight size={18} /></span></button>
    })}</div>
  </section>
}
