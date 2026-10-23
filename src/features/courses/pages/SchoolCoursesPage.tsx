import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Atom, BookOpen, ChartNoAxesCombined, ChevronRight, ClipboardCheck, Dumbbell, FlaskConical, GraduationCap, Landmark, Languages, Laptop, Lightbulb, Palette, Ruler, Sigma } from 'lucide-react'
import { useCourseCategories } from '../hooks/useCourseCategories'
import { useSchoolCourses } from '../hooks/useSchoolCourses'
import { QuestionBank } from '../components/QuestionBank'
import { CourseTemario } from '../components/CourseTemario'
import { useInstitution } from '../../../modules/site/context/InstitutionContext'
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
const categoryIcons: Record<string, typeof Sigma> = {
  sigma: Sigma,
  laptop: Laptop,
  languages: Languages,
  flask: FlaskConical,
  palette: Palette,
  atom: Atom,
  book: BookOpen,
  chart: ChartNoAxesCombined,
  landmark: Landmark,
  dumbbell: Dumbbell,
  lightbulb: Lightbulb,
  ruler: Ruler,
}
const noop = () => undefined
interface Props { selectedModuleId?: string | null; selectedCourseId?: string | null; evaluationActive?: boolean; onSelectModule?: (moduleId: string) => void; onSelectCourse?: (courseId: string) => void; courseHrefFor?: (courseId: string) => string; onBackToModules?: () => void; onBackToModule?: () => void; onTopicChange?: (topicTitle: string) => void; onEvaluationChange?: (active: boolean) => void }

function CourseBreadcrumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return <nav className="course-breadcrumbs" aria-label="Migas de pan"><ol>{items.map((item, index) => <li key={`${item.label}-${index}`}>{item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>
}

export function SchoolCoursesPage({ selectedModuleId = null, selectedCourseId = null, evaluationActive = false, onSelectModule = noop, onSelectCourse = noop, courseHrefFor, onBackToModules = noop, onBackToModule = noop, onTopicChange = noop, onEvaluationChange = noop }: Props) {
  const { institutionId } = useInstitution()
  const { categories: schoolModules, loading: categoriesLoading, error: categoriesError } = useCourseCategories(institutionId)
  const { courses: schoolCourses, loading: coursesLoading, error: coursesError } = useSchoolCourses(institutionId)
  const [selectedTopic, setSelectedTopic] = useState(0)
  const [isSectionLoading, setIsSectionLoading] = useState(false)
  const sectionLoadingTimer = useRef<number | null>(null)
  const showSectionSkeleton = () => {
    setIsSectionLoading(true)
    if (sectionLoadingTimer.current !== null) window.clearTimeout(sectionLoadingTimer.current)
    sectionLoadingTimer.current = window.setTimeout(() => {
      setIsSectionLoading(false)
      sectionLoadingTimer.current = null
    }, 280)
  }
  useEffect(() => {
    setSelectedTopic(0)
    const firstTopic = schoolCourses.find(course => course.id === selectedCourseId)?.units[0]?.title
    if (firstTopic) onTopicChange(firstTopic)
    onEvaluationChange(false)
    showSectionSkeleton()
  }, [selectedCourseId, onTopicChange, onEvaluationChange])
  useEffect(() => () => {
    if (sectionLoadingTimer.current !== null) window.clearTimeout(sectionLoadingTimer.current)
  }, [])

  const selectedCourse = schoolCourses.find(course => course.id === selectedCourseId)
  const selectedModule = schoolModules.find(module => module.id === selectedModuleId)
  if (categoriesLoading || coursesLoading) return <section className="page-content school-courses-page" role="status" aria-label="Cargando cursos" aria-busy="true"><div className="school-course-loading-grid">{Array.from({ length: 6 }, (_, index) => <span className="school-course-loading-card" key={index}><i /><b /><small /></span>)}</div></section>
  if (categoriesError || coursesError) return <section className="page-content school-courses-page" role="alert"><p>No se pudieron cargar los cursos. {categoriesError ?? coursesError}</p></section>
  if (selectedCourse) {
    const topic = selectedCourse.units[selectedTopic]
    const topicLesson = topic?.lesson
    const topicIcons = [BookOpen, Ruler, ChartNoAxesCombined, Sigma]
    return <section className={`page-content school-courses-page course-detail-page${evaluationActive ? ' course-evaluation-page' : ''}`}>
      <section className="course-topics-section" aria-label="Resumen del tema">
        <div className="course-topic-layout">
          <aside id="course-topic-sidebar" className="course-topic-sidebar" aria-label={`Navegación de ${selectedCourse.name}`}>
            <div className="course-sidebar-header">
              <button type="button" className="course-sidebar-courses-link" onClick={onBackToModule} aria-label="Volver a Cursos" title="Cursos"><span className="course-sidebar-courses-icon"><GraduationCap size={20} aria-hidden="true" /></span><span>Cursos</span></button>
            </div>
            <p className="course-sidebar-sections-heading">Temario</p>
            <nav id="course-topic-navigation" className="course-topic-nav" aria-label={`Temario de ${selectedCourse.name}`}>
            {selectedCourse.units.map((item, index) => {
            const TopicIcon = topicIcons[index % topicIcons.length]
            const isActiveTopic = selectedTopic === index && !evaluationActive
            return <button type="button" key={item.title} className={`course-topic-tab course-topic-tab-${index % topicIcons.length}${isActiveTopic ? ' active' : ''}`} aria-label={item.title} aria-current={isActiveTopic ? 'page' : undefined} onClick={() => { showSectionSkeleton(); setSelectedTopic(index); onTopicChange(item.title); onEvaluationChange(false) }}><span className="course-topic-tab-icon"><TopicIcon size={17} aria-hidden="true" /></span><span>{item.title}</span></button>
          })}
            </nav>
            <span className="course-topic-nav-separator" aria-hidden="true" />
            <button type="button" className={`course-topic-tab course-evaluation-topic${evaluationActive ? ' active' : ''}`} aria-label="Evaluaciones" aria-current={evaluationActive ? 'page' : undefined} onClick={() => { showSectionSkeleton(); onEvaluationChange(!evaluationActive) }}><span className="course-topic-tab-icon"><ClipboardCheck size={17} aria-hidden="true" /></span><span>Evaluaciones</span></button>
          </aside>
          <article className={`course-topic-content${evaluationActive ? ' course-topic-evaluation-content' : ''}`} aria-busy={isSectionLoading}>
            {isSectionLoading
              ? <div className="course-section-skeleton" role="status" aria-label="Cargando sección">
                {Array.from({ length: 6 }, (_, index) => <article className="course-section-skeleton-card" key={index} aria-hidden="true">
                  <span className="course-section-skeleton-art" />
                  <span className="course-section-skeleton-copy"><i /><i /><i /></span>
                </article>)}
              </div>
              : !evaluationActive
              ? topicLesson
                ? <CourseTemario key={`${selectedCourse.id}-${selectedTopic}`} lesson={topicLesson} courseId={selectedCourse.id} topicIndex={selectedTopic} />
                : <><h2 className="course-topic-summary-title">{topic.title}</h2><p>{topic.description}</p></>
              : <QuestionBank key={`${selectedCourse.id}-${topic.title}-assessment`} courseId={selectedCourse.id} courseName={selectedCourse.name} topicTitle={topic.title} mode="entry" />}
          </article>
        </div>
      </section>
    </section>
  }

  if (selectedModule) {
    const moduleCourses = selectedModule.courseIds
      .map(id => schoolCourses.find(course => course.id === id))
      .filter((course): course is (typeof schoolCourses)[number] => course !== undefined)
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
    <div className="school-module-grid" aria-label="Categorías de cursos">{schoolModules.map(module => {
      const Icon = categoryIcons[module.icon] ?? Sigma
      const cover = module.coverImage || schoolCourses.find(course => course.id === module.courseIds[0])?.coverImage
      return <button type="button" className="school-module-card" key={module.id} onClick={() => onSelectModule(module.id)}><span className="school-module-cover-wrap">{cover ? <img className="school-module-cover" src={cover} alt="" loading="lazy" /> : <span className="school-module-cover-placeholder" aria-hidden="true" />}<span className="school-module-cover-title"><span className="school-module-icon"><Icon size={22} /></span><strong>{module.name}</strong></span></span><span className="school-module-info"><span>{module.description}</span></span><span className="school-module-footer"><span className="school-module-count">{module.courseIds.length} {module.courseIds.length === 1 ? 'curso' : 'cursos'}</span><ChevronRight size={18} /></span></button>
    })}</div>
  </section>
}
