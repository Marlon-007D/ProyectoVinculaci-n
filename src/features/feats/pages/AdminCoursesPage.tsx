import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, BookOpenText, ChevronLeft, ChevronRight, ClipboardList, Clock3, FileText, FolderKanban, Layers3, Plus, Save, Search, Trash2 } from 'lucide-react'
import type { AssessmentQuestionSet } from '../../courses/mocks/schoolQuestionMock'
import { getSchoolQuestionSet } from '../../courses/mocks/schoolQuestionMock'
import type { SchoolSubject } from '../../courses/mocks/schoolCoursesMock'
import { useCourseCategories } from '../../courses/hooks/useCourseCategories'
import { useSchoolCourses } from '../../courses/hooks/useSchoolCourses'
import { createBlankLesson, deleteSchoolCourse, getSchoolCourseLesson, saveSchoolCourse, saveSchoolCourseLesson } from '../../courses/services/schoolCourseStore'
import { getAssessmentSettings, saveAssessmentOverride, saveAssessmentSettings, type AssessmentSettings } from '../../courses/services/schoolAssessmentStore'
import { saveCourseCategories } from '../../courses/services/courseCategoriesStore'
import type { TemarioLesson } from '../../courses/types/schoolTemario.types'
import styles from './AdminCoursesPage.module.css'

const pageSize = 5
const conceptCount = 6
type CoursePage = 'list' | 'editor'
type EditorTab = 'course' | 'curriculum' | 'assessment'

function normalize(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function makeEmptyCourse(): SchoolSubject {
  const id = `curso-${crypto.randomUUID()}`
  return { id, name: '', description: '', coverImage: '', units: [{ title: 'Tema 1', description: '' }] }
}

function fitLesson(lesson: TemarioLesson): TemarioLesson {
  const concepts = lesson.concepts.slice(0, conceptCount)
  while (concepts.length < conceptCount) concepts.push({ title: `Concepto ${concepts.length + 1}`, detail: '' })
  return { ...lesson, concepts }
}

function cleanQuestionSet(questions: AssessmentQuestionSet, seed: string): AssessmentQuestionSet {
  return {
    ...questions,
    wordSearchVersions: questions.wordSearchVersions.map((question, index) => ({
      ...question,
      words: question.words.map(normalizeSearchWord).filter(Boolean),
      grid: generateGrid(question.words.map(normalizeSearchWord).filter(Boolean), `${seed}-${index}`),
    })),
  }
}

function normalizeSearchWord(word: string) {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('es').replace(/[^A-ZÑ]/g, '').slice(0, 8)
}

function generateGrid(words: string[], seed: string): string[] {
  const size = 8
  const alphabet = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'
  let value = [...seed].reduce((total, char) => total + char.charCodeAt(0), 37)
  const random = (limit: number) => {
    value = (value * 9301 + 49297) % 233280
    return Math.floor((value / 233280) * limit)
  }
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => alphabet[random(alphabet.length)]))
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  for (const rawWord of words) {
    const word = [...rawWord].filter(char => alphabet.includes(char)).slice(0, size)
    if (!word.length) continue
    for (let attempt = 0; attempt < 400; attempt++) {
      const [rowStep, colStep] = directions[random(directions.length)]
      const row = random(size)
      const col = random(size)
      const endRow = row + rowStep * (word.length - 1)
      const endCol = col + colStep * (word.length - 1)
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue
      word.forEach((letter, index) => { grid[row + rowStep * index][col + colStep * index] = letter })
      break
    }
  }
  return grid.map(row => row.join(' '))
}

function makeQuestionSet(courseId: string, title: string): AssessmentQuestionSet {
  return structuredClone(getSchoolQuestionSet(courseId, title))
}

function filledLesson(courseId: string, topicIndex: number): TemarioLesson {
  return fitLesson(getSchoolCourseLesson(courseId, topicIndex))
}

function assignedCategories(categories: ReturnType<typeof useCourseCategories>, courseId: string) {
  return categories.filter(category => category.courseIds.includes(courseId)).map(category => category.id)
}

export function AdminCoursesPage() {
  const courses = useSchoolCourses()
  const categories = useCourseCategories()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [coursePage, setCoursePage] = useState<CoursePage>('list')
  const [activeTab, setActiveTab] = useState<EditorTab>('course')
  const [draft, setDraft] = useState<SchoolSubject | null>(null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [activeTopic, setActiveTopic] = useState(0)
  const [lessons, setLessons] = useState<Record<number, TemarioLesson>>({})
  const [questionSets, setQuestionSets] = useState<Record<number, AssessmentQuestionSet>>({})
  const [settings, setSettings] = useState<AssessmentSettings>({ durationMinutes: 10, totalPoints: 20 })
  const [editorError, setEditorError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const filteredCourses = useMemo(() => {
    const query = normalize(search)
    return courses.filter(course => {
      if (categoryFilter !== 'all' && !categories.find(category => category.id === categoryFilter)?.courseIds.includes(course.id)) return false
      if (!query) return true
      const categoryNames = categories.filter(category => category.courseIds.includes(course.id)).map(category => category.name).join(' ')
      return normalize(`${course.name} ${course.description} ${categoryNames}`).includes(query)
    })
  }, [courses, categories, categoryFilter, search])

  const pageCount = Math.max(1, Math.ceil(filteredCourses.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleCourses = filteredCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const currentLesson = draft ? lessons[activeTopic] ?? filledLesson(draft.id, activeTopic) : null
  const currentQuestions = draft && currentLesson ? questionSets[activeTopic] ?? makeQuestionSet(draft.id, draft.units[activeTopic]?.title ?? '') : null

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const openEditor = (course: SchoolSubject, isNew = false) => {
    const nextCourse = structuredClone(course)
    const nextLessons = Object.fromEntries(nextCourse.units.map((_, index) => [index, isNew ? createBlankLesson() : filledLesson(nextCourse.id, index)]))
    const nextQuestions = Object.fromEntries(nextCourse.units.map((unit, index) => [index, makeQuestionSet(nextCourse.id, unit.title)]))
    setDraft(nextCourse)
    setLessons(nextLessons)
    setQuestionSets(nextQuestions)
    setSelectedCategoryIds(isNew ? [] : assignedCategories(categories, course.id))
    setSettings(getAssessmentSettings(course.id))
    setActiveTopic(0)
    setActiveTab('course')
    setEditorError('')
    setCoursePage('editor')
  }

  const updateLesson = <K extends keyof TemarioLesson>(key: K, value: TemarioLesson[K]) => {
    setLessons(current => ({ ...current, [activeTopic]: { ...(currentLesson ?? createBlankLesson()), [key]: value } }))
  }

  const updateQuestionSet = (transform: (value: AssessmentQuestionSet) => AssessmentQuestionSet) => {
    if (!currentQuestions) return
    setQuestionSets(current => ({ ...current, [activeTopic]: transform(currentQuestions) }))
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    const name = draft.name.trim()
    const description = draft.description.trim()
    if (!name || !description || draft.units.length === 0) {
      setEditorError('Completa el nombre, la descripción y al menos un tema.')
      return
    }
    if (draft.units.some(unit => !unit.title.trim())) {
      setEditorError('Cada tema necesita un título.')
      setActiveTab('curriculum')
      return
    }
    const invalidQuestions = Object.entries(questionSets).some(([, questionSet]) =>
      questionSet.multipleChoiceVersions.some(question => !question.prompt.trim() || question.options.some(option => !option.trim()) || question.answer < 0 || question.answer >= question.options.length)
      || questionSet.multipleSelectVersions.some(question => !question.prompt.trim() || question.options.some(option => !option.trim()) || question.answers.length === 0)
      || !questionSet.matching.prompt.trim()
      || questionSet.matching.pairs.some(pair => !pair.imageAlt.trim() || !pair.match.trim())
      || questionSet.wordSearchVersions.some(question => !question.prompt.trim() || question.words.length === 0 || question.words.some(word => normalizeSearchWord(word).length < 2)),
    )
    if (invalidQuestions) {
      setEditorError('Completa las preguntas y define al menos una respuesta correcta en cada una.')
      setActiveTab('assessment')
      return
    }
    const savedCourse = { ...draft, name, description, coverImage: draft.coverImage.trim(), units: draft.units.map(unit => ({ title: unit.title.trim(), description: unit.description.trim() })) }
    try {
      saveSchoolCourse(savedCourse)
      Object.entries(lessons).forEach(([index, lesson]) => saveSchoolCourseLesson(savedCourse.id, Number(index), fitLesson(lesson)))
      Object.entries(questionSets).forEach(([index, questions]) => {
        const topicTitle = savedCourse.units[Number(index)]?.title
        if (topicTitle) saveAssessmentOverride(savedCourse.id, topicTitle, cleanQuestionSet(questions, `${savedCourse.id}-${topicTitle}`))
      })
      saveAssessmentSettings(savedCourse.id, settings)
      const updatedCategories = categories.map(category => ({
        ...category,
        courseIds: selectedCategoryIds.includes(category.id)
          ? [...new Set([...category.courseIds, savedCourse.id])]
          : category.courseIds.filter(id => id !== savedCourse.id),
      }))
      saveCourseCategories(updatedCategories)
      setDraft(savedCourse)
      setEditorError('')
      setCoursePage('list')
      setPage(1)
    } catch {
      setEditorError('No se pudieron guardar los cambios en este navegador.')
    }
  }

  const deleteCourse = (course: SchoolSubject) => {
    if (pendingDelete !== course.id) {
      setPendingDelete(course.id)
      return
    }
    try {
      deleteSchoolCourse(course.id)
      setPendingDelete(null)
    } catch {
      setPendingDelete(null)
    }
  }

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds(current => current.includes(categoryId) ? current.filter(id => id !== categoryId) : [...current, categoryId])
  }

  if (coursePage === 'editor' && draft && currentLesson && currentQuestions) {
    return <main className={styles.page}>
      <header className={styles.editorHeader}>
        <button className={styles.backButton} type="button" onClick={() => { setCoursePage('list'); setEditorError('') }}><ArrowLeft size={18} />Volver a cursos</button>
        <div className={styles.editorTitle}><p className={styles.eyebrow}>Editor de curso</p><h1>{draft.name || 'Nuevo curso'}</h1></div>
        <button className={styles.primaryButton} type="submit" form="course-editor-form"><Save size={17} />Guardar cambios</button>
      </header>
      <nav className={styles.editorTabs} aria-label="Secciones del editor">
        <button type="button" className={activeTab === 'course' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('course')}><BookOpenText size={17} />Curso</button>
        <button type="button" className={activeTab === 'curriculum' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('curriculum')}><Layers3 size={17} />Temario</button>
        <button type="button" className={activeTab === 'assessment' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('assessment')}><ClipboardList size={17} />Evaluación</button>
      </nav>

      <form id="course-editor-form" className={styles.editorCard} onSubmit={handleSave} noValidate>
        {activeTab === 'course' && <section className={styles.editorSection}>
          <div className={styles.sectionHeading}><span className={`${styles.sectionIcon} ${styles.courseSectionIcon}`}><BookOpenText size={20} /></span><div className={styles.sectionCopy}><h2>Datos del curso</h2><p>Estos datos aparecen en la tarjeta del portal.</p></div></div>
          <div className={styles.fieldsGrid}>
            <label className={styles.field}>Nombre del curso<input value={draft.name} onChange={event => setDraft(current => current ? { ...current, name: event.target.value } : current)} maxLength={90} required /></label>
            <label className={styles.field}>Imagen de portada (URL)<input type="url" value={draft.coverImage} onChange={event => setDraft(current => current ? { ...current, coverImage: event.target.value } : current)} placeholder="https://…" /></label>
            <label className={`${styles.field} ${styles.fullField}`}>Descripción<textarea value={draft.description} onChange={event => setDraft(current => current ? { ...current, description: event.target.value } : current)} maxLength={260} rows={3} required /></label>
          </div>
          <fieldset className={styles.categoryPicker}><legend><FolderKanban size={15} />Categorías relacionadas</legend><div className={styles.categoryOptions}>
            {categories.map(category => <label key={category.id}><input type="checkbox" checked={selectedCategoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />{category.name}</label>)}
            {categories.length === 0 && <p>Crea una categoría para relacionarla con este curso.</p>}
          </div></fieldset>
        </section>}

        {activeTab === 'curriculum' && <section className={styles.editorSection}>
          <div className={styles.sectionHeading}><span className={`${styles.sectionIcon} ${styles.curriculumSectionIcon}`}><Layers3 size={20} /></span><div className={styles.sectionCopy}><h2>Temario</h2><p>Cada tema conserva una grilla fija de seis conceptos como en el portal.</p></div><button className={styles.secondaryButton} type="button" onClick={() => {
            const topicIndex = draft.units.length
            const title = `Tema ${topicIndex + 1}`
            setDraft(current => current ? { ...current, units: [...current.units, { title, description: '' }] } : current)
            setLessons(current => ({ ...current, [topicIndex]: createBlankLesson() }))
            setQuestionSets(current => ({ ...current, [topicIndex]: makeQuestionSet(draft.id, title) }))
            setActiveTopic(topicIndex)
          }}><Plus size={16} />Añadir tema</button></div>
          <div className={styles.topicTabs} role="tablist" aria-label="Temas del curso">
            {draft.units.map((unit, index) => <button key={`${index}-${unit.title}`} type="button" role="tab" aria-selected={activeTopic === index} className={activeTopic === index ? styles.topicActive : styles.topicTab} onClick={() => setActiveTopic(index)}>Tema {index + 1}</button>)}
          </div>
          <div className={styles.topicEditor}>
            <div className={styles.topicHeader}><h3>Datos del tema</h3>{draft.units.length > 1 && <button className={styles.inlineDanger} type="button" onClick={() => {
              const nextUnits = draft.units.filter((_, index) => index !== activeTopic)
              const nextLessons = Object.fromEntries(Object.entries(lessons).filter(([index]) => Number(index) !== activeTopic).map(([index, lesson]) => [Number(index) > activeTopic ? Number(index) - 1 : Number(index), lesson]))
              const nextQuestions = Object.fromEntries(Object.entries(questionSets).filter(([index]) => Number(index) !== activeTopic).map(([index, questions]) => [Number(index) > activeTopic ? Number(index) - 1 : Number(index), questions]))
              setDraft(current => current ? { ...current, units: nextUnits } : current)
              setLessons(nextLessons)
              setQuestionSets(nextQuestions)
              setActiveTopic(Math.max(0, activeTopic - 1))
            }}><Trash2 size={15} />Eliminar tema</button>}</div>
            <div className={styles.fieldsGrid}>
              <label className={styles.field}>Título del tema<input value={draft.units[activeTopic]?.title ?? ''} onChange={event => setDraft(current => current ? { ...current, units: current.units.map((unit, index) => index === activeTopic ? { ...unit, title: event.target.value } : unit) } : current)} required /></label>
              <label className={`${styles.field} ${styles.fullField}`}>Descripción del tema<textarea value={draft.units[activeTopic]?.description ?? ''} onChange={event => setDraft(current => current ? { ...current, units: current.units.map((unit, index) => index === activeTopic ? { ...unit, description: event.target.value } : unit) } : current)} rows={2} /></label>
              <label className={`${styles.field} ${styles.fullField}`}>Introducción<textarea value={currentLesson.introduction} onChange={event => updateLesson('introduction', event.target.value)} rows={3} /></label>
            </div>
            <div className={styles.conceptHeading}><h3>Grilla del temario</h3><span>6 tarjetas</span></div>
            <div className={styles.conceptGrid}>
              {currentLesson.concepts.slice(0, conceptCount).map((concept, index) => <article className={styles.conceptCard} key={index}>
                <span className={styles.conceptNumber}>{String(index + 1).padStart(2, '0')}</span>
                <label className={styles.field}>Título<input value={concept.title} maxLength={70} onChange={event => updateLesson('concepts', currentLesson.concepts.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                <label className={styles.field}>Contenido<textarea value={concept.detail} rows={4} onChange={event => updateLesson('concepts', currentLesson.concepts.map((item, itemIndex) => itemIndex === index ? { ...item, detail: event.target.value } : item))} /></label>
              </article>)}
            </div>
            <div className={styles.fieldsGrid}>
              <label className={styles.field}>Título del ejemplo<input value={currentLesson.exampleTitle} onChange={event => updateLesson('exampleTitle', event.target.value)} /></label>
              <label className={`${styles.field} ${styles.fullField}`}>Ejemplo<textarea value={currentLesson.example} onChange={event => updateLesson('example', event.target.value)} rows={3} /></label>
              <label className={`${styles.field} ${styles.fullField}`}>Actividad<textarea value={currentLesson.activity} onChange={event => updateLesson('activity', event.target.value)} rows={3} /></label>
            </div>
          </div>
        </section>}

        {activeTab === 'assessment' && <section className={styles.editorSection}>
          <div className={styles.sectionHeading}><span className={`${styles.sectionIcon} ${styles.assessmentSectionIcon}`}><ClipboardList size={20} /></span><div className={styles.sectionCopy}><h2>Evaluación</h2><p>Edita enunciados y respuestas para el tema seleccionado.</p></div></div>
          <div className={styles.assessmentSettings}>
            <label className={styles.field}><span className={styles.fieldLabel}><Clock3 size={15} />Tiempo límite (minutos)</span><input type="number" min={1} max={180} value={settings.durationMinutes} onChange={event => setSettings(current => ({ ...current, durationMinutes: Math.max(1, Math.min(180, Number(event.target.value) || 1)) }))} /></label>
            <label className={styles.field}><span className={styles.fieldLabel}><FileText size={15} />Calificación máxima</span><input type="number" min={1} max={100} value={settings.totalPoints} onChange={event => setSettings(current => ({ ...current, totalPoints: Math.max(1, Math.min(100, Number(event.target.value) || 1)) }))} /></label>
          </div>
          <p className={styles.questionCountNote}>La evaluación contiene 10 preguntas distribuidas entre opción múltiple, selección, relación y sopa de letras. Cada pregunta usa una parte proporcional de la calificación máxima.</p>

          <section className={styles.questionSection}>
            <h3>Opción múltiple <span>3 preguntas</span></h3>
            {currentQuestions.multipleChoiceVersions.map((question, questionIndex) => <article className={styles.questionCard} key={`choice-${questionIndex}`}>
              <h4>Pregunta {[1, 5, 8][questionIndex]}</h4>
              <label className={styles.field}>Enunciado<textarea value={question.prompt} rows={2} onChange={event => updateQuestionSet(current => ({ ...current, multipleChoiceVersions: current.multipleChoiceVersions.map((item, index) => index === questionIndex ? { ...item, prompt: event.target.value } : item) }))} /></label>
              <div className={styles.answerGrid}>{question.options.map((option, optionIndex) => <label className={styles.answerOption} key={optionIndex}><input type="radio" name={`choice-${questionIndex}`} checked={question.answer === optionIndex} onChange={() => updateQuestionSet(current => ({ ...current, multipleChoiceVersions: current.multipleChoiceVersions.map((item, index) => index === questionIndex ? { ...item, answer: optionIndex } : item) }))} aria-label={`Marcar opción ${optionIndex + 1} como correcta`} /><input aria-label={`Texto de opción ${optionIndex + 1}`} value={option} onChange={event => updateQuestionSet(current => ({ ...current, multipleChoiceVersions: current.multipleChoiceVersions.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((value, choiceIndex) => choiceIndex === optionIndex ? event.target.value : value) } : item) }))} /></label>)}</div>
            </article>)}
          </section>

          <section className={styles.questionSection}>
            <h3>Selección múltiple <span>4 preguntas</span></h3>
            {currentQuestions.multipleSelectVersions.map((question, questionIndex) => <article className={styles.questionCard} key={`select-${questionIndex}`}>
              <h4>Pregunta {[4, 7, 9, 10][questionIndex]}</h4>
              <label className={styles.field}>Enunciado<textarea value={question.prompt} rows={2} onChange={event => updateQuestionSet(current => ({ ...current, multipleSelectVersions: current.multipleSelectVersions.map((item, index) => index === questionIndex ? { ...item, prompt: event.target.value } : item) }))} /></label>
              <div className={styles.answerGrid}>{question.options.map((option, optionIndex) => <label className={styles.answerOption} key={optionIndex}><input type="checkbox" checked={question.answers.includes(optionIndex)} onChange={event => updateQuestionSet(current => ({ ...current, multipleSelectVersions: current.multipleSelectVersions.map((item, index) => index === questionIndex ? { ...item, answers: event.target.checked ? [...item.answers, optionIndex] : item.answers.filter(answer => answer !== optionIndex) } : item) }))} aria-label={`Marcar opción ${optionIndex + 1} como correcta`} /><input aria-label={`Texto de opción ${optionIndex + 1}`} value={option} onChange={event => updateQuestionSet(current => ({ ...current, multipleSelectVersions: current.multipleSelectVersions.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((value, choiceIndex) => choiceIndex === optionIndex ? event.target.value : value) } : item) }))} /></label>)}</div>
            </article>)}
          </section>

          <section className={styles.questionSection}>
            <h3>Relacionar <span>1 pregunta</span></h3>
            <article className={styles.questionCard}>
              <h4>Pregunta 2</h4>
              <label className={styles.field}>Enunciado<textarea value={currentQuestions.matching.prompt} rows={2} onChange={event => updateQuestionSet(current => ({ ...current, matching: { ...current.matching, prompt: event.target.value } }))} /></label>
              <div className={styles.matchingGrid}>{currentQuestions.matching.pairs.map((pair, index) => <div className={styles.matchingRow} key={index}>
                <label className={styles.field}>Texto o descripción de imagen<input value={pair.imageAlt} onChange={event => updateQuestionSet(current => ({ ...current, matching: { ...current.matching, pairs: current.matching.pairs.map((item, itemIndex) => itemIndex === index ? { ...item, imageAlt: event.target.value } : item) } }))} /></label>
                <label className={styles.field}>Respuesta correcta<input value={pair.match} onChange={event => updateQuestionSet(current => ({ ...current, matching: { ...current.matching, pairs: current.matching.pairs.map((item, itemIndex) => itemIndex === index ? { ...item, match: event.target.value } : item), options: current.matching.options.map((option, optionIndex) => optionIndex === index ? event.target.value : option) } }))} /></label>
                <label className={`${styles.field} ${styles.fullField}`}>Imagen (URL)<input type="url" value={pair.imageUrl} onChange={event => updateQuestionSet(current => ({ ...current, matching: { ...current.matching, pairs: current.matching.pairs.map((item, itemIndex) => itemIndex === index ? { ...item, imageUrl: event.target.value } : item) } }))} /></label>
              </div>)}</div>
            </article>
          </section>

          <section className={styles.questionSection}>
            <h3>Sopa de letras <span>2 preguntas</span></h3>
            {currentQuestions.wordSearchVersions.map((question, questionIndex) => <article className={styles.questionCard} key={`words-${questionIndex}`}>
              <h4>Pregunta {questionIndex === 0 ? 3 : 6}</h4>
              <label className={styles.field}>Enunciado<textarea value={question.prompt} rows={2} onChange={event => updateQuestionSet(current => ({ ...current, wordSearchVersions: current.wordSearchVersions.map((item, index) => index === questionIndex ? { ...item, prompt: event.target.value } : item) }))} /></label>
              <label className={styles.field}>Palabras que deben encontrarse (separadas por coma)<textarea value={question.words.join(', ')} rows={2} onChange={event => updateQuestionSet(current => ({ ...current, wordSearchVersions: current.wordSearchVersions.map((item, index) => index === questionIndex ? { ...item, words: event.target.value.split(',').map(word => word.trim().toLocaleUpperCase('es')).filter(Boolean) } : item) }))} /></label>
            </article>)}
          </section>
        </section>}
        {editorError && <p className={styles.editorError} role="alert">{editorError}</p>}
        <footer className={styles.editorFooter}><button className={styles.primaryButton} type="submit"><Save size={17} />Guardar cambios</button></footer>
      </form>
    </main>
  }

  return <main className={styles.page}>
    {pendingDelete && <div className={styles.confirmBar} role="alert"><span>¿Eliminar este curso del catálogo?</span><button className={styles.secondaryButton} type="button" onClick={() => setPendingDelete(null)}>Cancelar</button><button className={styles.dangerConfirm} type="button" onClick={() => { const course = courses.find(item => item.id === pendingDelete); if (course) deleteCourse(course) }}>Eliminar curso</button></div>}
    <section className={styles.listCard} aria-labelledby="courses-list-title">
      <div className={styles.listHeading}><div><h2 id="courses-list-title">Cursos del catálogo</h2><p>{courses.length} {courses.length === 1 ? 'curso' : 'cursos'}</p></div><button className={styles.primaryButton} type="button" onClick={() => openEditor(makeEmptyCourse(), true)}><Plus size={18} />Nuevo curso</button></div>
      <div className={styles.filters}>
        <label className={styles.searchBox}><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Buscar curso" aria-label="Buscar curso" /></label>
        <label className={styles.filterSelect}>Categoría<select value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setPage(1) }}><option value="all">Todas las categorías</option>{categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      </div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th scope="col">Curso</th><th scope="col">Categoría</th><th scope="col">Temas</th><th scope="col"><span className={styles.srOnly}>Acciones</span></th></tr></thead>
        <tbody>{visibleCourses.map(course => <tr key={course.id}>
          <td><span className={styles.courseName}>{course.name}</span><span className={styles.courseDescription}>{course.description}</span></td>
          <td>{categories.filter(category => category.courseIds.includes(course.id)).map(category => category.name).join(', ') || 'Sin categoría'}</td>
          <td>{course.units.length}</td>
          <td><div className={styles.rowActions}><button className={styles.editButton} type="button" onClick={() => openEditor(course)}>Editar</button><button className={styles.deleteButton} type="button" onClick={() => deleteCourse(course)} aria-label={`Eliminar ${course.name}`} title="Eliminar"><Trash2 size={16} /></button></div></td>
        </tr>)}
        {visibleCourses.length === 0 && <tr><td className={styles.empty} colSpan={4}>No hay cursos que coincidan con la búsqueda.</td></tr>}</tbody>
      </table></div>
      <footer className={styles.pagination}><span>{filteredCourses.length === 0 ? '0 resultados' : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredCourses.length)} de ${filteredCourses.length}`}</span><div className={styles.pageControls}><span>Página {currentPage} de {pageCount}</span><button className={styles.pageButton} type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Página anterior"><ChevronLeft size={18} /></button><button className={styles.pageButton} type="button" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="Página siguiente"><ChevronRight size={18} /></button></div></footer>
    </section>
  </main>
}
