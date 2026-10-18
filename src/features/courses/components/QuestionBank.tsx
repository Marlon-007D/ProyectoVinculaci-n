import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, CheckCircle2, Circle, CircleHelp, ClipboardList, Clock3, Hourglass, Lightbulb, ListChecks, MessageSquareText, RotateCcw, Search, Timer, XCircle } from 'lucide-react'
import { getSchoolQuestionSet } from '../mocks/schoolQuestionMock'
import evaluationIllustration from '../assets/online-test.svg'
import evaluationChecklist from '../assets/evaluation-checklist.svg'
import evaluationResults from '../assets/evaluation-results.svg'
import { PenguinMascot } from './PenguinMascot'
import styles from './QuestionBank.module.css'

const cx = (classNames: string) => classNames.split(/\s+/).filter(Boolean).map(className => styles[className]).filter(Boolean).join(' ')

interface Props { courseId: string; courseName: string; topicTitle: string; mode: 'entry' | 'assessment'; onEnter?: () => void }
const LIMIT_SECONDS = 10 * 60
const QUESTION_COUNT = 10
const POINTS_PER_QUESTION = 20 / QUESTION_COUNT
type QuestionKind = 'multiple-choice' | 'multiple-select' | 'matching' | 'word-search'
const questionKinds: QuestionKind[] = ['multiple-choice', 'matching', 'word-search', 'multiple-select', 'multiple-choice', 'word-search', 'multiple-select', 'multiple-choice', 'multiple-select', 'multiple-select']
const MAX_ATTEMPTS = 3
interface SavedProgress {
  attempts: number; answers: Record<number, number>; multiAnswers: Record<number, number[]>;
  connectionsByQuestion: Record<number, Record<number, string>>; foundWords: Record<number, string[]>;
  foundWordPaths: Record<number, Record<string, number[]>>; wordSelections: Record<number, number[]>;
  hintedCells?: Record<number, number[]>; hintedWords?: Record<number, string[]>;
  questionIndex: number; elapsedSeconds: number; questionTimes?: Record<number, number>; savedAt: number; completed: boolean; hintsUsed?: number | Record<number, number>
  history?: AttemptMetrics[]; score?: number; answeredCount?: number
}
interface AttemptMetrics { attempt: number; completed: boolean; answeredCount: number; elapsedSeconds: number; savedAt: number; score?: number }
type ReviewStatus = 'correct' | 'incorrect' | 'unanswered'
type EvaluationView = 'inicio' | 'respuestas' | 'analisis'
interface ReviewRow { index: number; prompt: string; userAnswer: string; correctAnswer: string; status: ReviewStatus }
const progressKey = (courseId: string, topicTitle: string) => `evaluation-progress:${courseId}:${encodeURIComponent(topicTitle)}`
function readProgress(key: string): SavedProgress | null {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as SavedProgress : null } catch { return null }
}
function getEncouragements(courseName: string, topicTitle: string) {
  const subject = `${courseName} ${topicTitle}`.toLocaleLowerCase()
  if (subject.includes('matem')) return [
    { title: '¡A calcular!', detail: `En ${topicTitle}, cada razonamiento suma.` },
    { title: '¡Vas muy bien!', detail: 'Resuelve una idea a la vez.' },
    { title: '¡Sigue pensando!', detail: 'Tus estrategias te acercan a la respuesta.' },
  ]
  if (subject.includes('lengua') || subject.includes('literatura')) return [
    { title: '¡Sigue leyendo!', detail: 'Cada palabra te ayuda a comprender mejor.' },
    { title: '¡Muy bien!', detail: 'Tus ideas tienen mucho que decir.' },
    { title: '¡Continúa!', detail: 'Leer con atención abre nuevas respuestas.' },
  ]
  if (subject.includes('ciencia')) return [
    { title: '¡A explorar!', detail: 'Observa, piensa y descubre la respuesta.' },
    { title: '¡Qué curioso!', detail: 'Cada pregunta te enseña algo nuevo.' },
    { title: '¡Sigue investigando!', detail: 'Tu curiosidad te lleva más lejos.' },
  ]
  if (subject.includes('social')) return [
    { title: '¡Conecta ideas!', detail: 'Entender nuestro entorno empieza con una pregunta.' },
    { title: '¡Buen análisis!', detail: 'Cada respuesta te acerca a comprender la sociedad.' },
    { title: '¡Sigue aprendiendo!', detail: 'Tu mirada ayuda a entender el mundo.' },
  ]
  if (subject.includes('art')) return [
    { title: '¡Crea y explora!', detail: 'Cada idea también puede ser una obra.' },
    { title: '¡Muy creativo!', detail: 'Tu mirada hace único cada detalle.' },
    { title: '¡Sigue expresándote!', detail: 'El arte comienza con tu imaginación.' },
  ]
  return [
    { title: '¡Tú puedes!', detail: `Cada paso en ${topicTitle} cuenta.` },
    { title: '¡Vas muy bien!', detail: 'Mantén la curiosidad y sigue aprendiendo.' },
    { title: '¡Continúa!', detail: 'Una pregunta a la vez, vas avanzando.' },
  ]
}

function occurrenceOfKind(index: number, kind: QuestionKind): number {
  return questionKinds.slice(0, index).filter(questionKind => questionKind === kind).length
}

function findWordPath(rows: string[][], word: string): number[] | null {
  const directions = [-1, 0, 1].flatMap(rowStep => [-1, 0, 1].map(colStep => [rowStep, colStep] as const)).filter(([rowStep, colStep]) => rowStep !== 0 || colStep !== 0)
  for (let row = 0; row < rows.length; row++) for (let col = 0; col < (rows[row]?.length ?? 0); col++) {
    if (rows[row][col] !== word[0]) continue
    for (const [rowStep, colStep] of directions) {
      const path = Array.from({ length: word.length }, (_, offset) => {
        const nextRow = row + rowStep * offset
        const nextCol = col + colStep * offset
        return rows[nextRow]?.[nextCol] === word[offset] ? nextRow * rows[0].length + nextCol : -1
      })
      if (path.every(index => index >= 0)) return path
    }
  }
  return null
}

export function QuestionBank({ courseId, courseName, topicTitle, mode, onEnter = () => undefined }: Props) {
  const questions = getSchoolQuestionSet(courseId, topicTitle)
  const storageKey = progressKey(courseId, topicTitle)
  const initialProgress = useRef(readProgress(storageKey)).current
  const evaluationHubRef = useRef<HTMLElement | null>(null)
  const [attempts, setAttempts] = useState(initialProgress?.attempts ?? 0)
  const [lastSaved, setLastSaved] = useState(initialProgress?.savedAt ?? null)
  const [started, setStarted] = useState(mode === 'assessment')
  const [finished, setFinished] = useState(mode === 'assessment' && (initialProgress?.completed ?? false))
  const [evaluationView, setEvaluationView] = useState<EvaluationView>(mode === 'assessment' && initialProgress?.completed ? 'respuestas' : 'inicio')
  const [questionIndex, setQuestionIndex] = useState(initialProgress?.questionIndex ?? 0)
  const [danceSequence, setDanceSequence] = useState(0)
  const [danceActive, setDanceActive] = useState(false)
  const previousQuestionIndex = useRef(questionIndex)
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, LIMIT_SECONDS - (initialProgress?.elapsedSeconds ?? 0)))
  const [answers, setAnswers] = useState<Record<number, number>>(initialProgress?.answers ?? {})
  const [multiAnswers, setMultiAnswers] = useState<Record<number, number[]>>(initialProgress?.multiAnswers ?? {})
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [connectionsByQuestion, setConnectionsByQuestion] = useState<Record<number, Record<number, string>>>(initialProgress?.connectionsByQuestion ?? {})
  const [foundWords, setFoundWords] = useState<Record<number, string[]>>(initialProgress?.foundWords ?? {})
  const [foundWordPaths, setFoundWordPaths] = useState<Record<number, Record<string, number[]>>>(initialProgress?.foundWordPaths ?? {})
  const [wordSelections, setWordSelections] = useState<Record<number, number[]>>(initialProgress?.wordSelections ?? {})
  const [hintedCells, setHintedCells] = useState<Record<number, number[]>>(initialProgress?.hintedCells ?? {})
  const [hintedWords, setHintedWords] = useState<Record<number, string[]>>(initialProgress?.hintedWords ?? {})
  const [hintsUsed, setHintsUsed] = useState<Record<number, number>>(
    initialProgress?.hintsUsed && typeof initialProgress.hintsUsed === 'object'
      ? initialProgress.hintsUsed
      : {},
  )
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>(initialProgress?.questionTimes ?? {})
  const [attemptHistory, setAttemptHistory] = useState<AttemptMetrics[]>(initialProgress?.history ?? [])
  const elapsedSeconds = Math.max(0, LIMIT_SECONDS - secondsLeft)

  useEffect(() => {
    if (!started || finished) return
    const progress: SavedProgress = { attempts, answers, multiAnswers, connectionsByQuestion, foundWords, foundWordPaths, wordSelections, hintedCells, hintedWords, questionIndex, elapsedSeconds, questionTimes, savedAt: Date.now(), completed: false, hintsUsed, history: attemptHistory }
    try { localStorage.setItem(storageKey, JSON.stringify(progress)); setLastSaved(progress.savedAt) } catch { /* storage can be unavailable */ }
  }, [started, storageKey, attempts, answers, multiAnswers, connectionsByQuestion, foundWords, foundWordPaths, wordSelections, hintedCells, hintedWords, questionIndex, elapsedSeconds, questionTimes, finished, hintsUsed, attemptHistory])
  const currentKind = questionKinds[questionIndex]
  const encouragements = getEncouragements(courseName, topicTitle)
  const encouragement = encouragements[questionIndex % encouragements.length]
  const penguinExpressions = ['happy', 'wink', 'excited', 'curious'] as const
  const currentMultipleChoice = questions.multipleChoiceVersions[occurrenceOfKind(questionIndex, 'multiple-choice')]
  const currentMultipleSelect = questions.multipleSelectVersions[occurrenceOfKind(questionIndex, 'multiple-select')]
  const currentWordSearch = questions.wordSearchVersions[occurrenceOfKind(questionIndex, 'word-search')]
  const rows = currentWordSearch?.grid.map(row => row.replace(/\s/g, '').split('')) ?? []
  const connections = connectionsByQuestion[questionIndex] ?? {}
  const currentFoundWords = foundWords[questionIndex] ?? []
  const currentFoundWordPaths = foundWordPaths[questionIndex] ?? {}
  const correctWordCells = new Set(Object.values(currentFoundWordPaths).flat())
  const selectWordCell = (index: number, forceSelect = false) => {
    if (!currentWordSearch || correctWordCells.has(index)) return
    const currentSelection = wordSelections[questionIndex] ?? []
    const next = currentSelection.includes(index)
      ? forceSelect ? currentSelection : currentSelection.filter(cell => cell !== index)
      : [...currentSelection, index]
    const matchedPath = currentWordSearch.words
      .filter(word => !currentFoundWords.includes(word) && word.length === next.length)
      .map(word => ({ word, path: findWordPath(rows, word) }))
      .find(candidate => candidate.path?.length === next.length && candidate.path.every(cell => next.includes(cell)))
    if (matchedPath?.path) {
      setFoundWords(current => ({ ...current, [questionIndex]: [...(current[questionIndex] ?? []), matchedPath.word] }))
      setFoundWordPaths(current => ({ ...current, [questionIndex]: { ...(current[questionIndex] ?? {}), [matchedPath.word]: matchedPath.path! } }))
      setWordSelections(current => ({ ...current, [questionIndex]: [] }))
    } else {
      setWordSelections(current => ({ ...current, [questionIndex]: next }))
    }
  }

  useEffect(() => {
    if (!started || finished) return
    const timer = window.setTimeout(() => {
      setQuestionTimes(current => ({ ...current, [questionIndex]: (current[questionIndex] ?? 0) + 1 }))
      if (secondsLeft <= 1) {
        setSecondsLeft(0); setFinished(true); setEvaluationView('respuestas')
      }
      else setSecondsLeft(secondsLeft - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [started, finished, secondsLeft, questionIndex, storageKey])

  useEffect(() => {
    if (!danceActive) return
    const timer = window.setTimeout(() => setDanceActive(false), 1100)
    return () => window.clearTimeout(timer)
  }, [danceActive, danceSequence])

  useEffect(() => {
    if (questionIndex > previousQuestionIndex.current) {
      setDanceSequence(sequence => sequence + 1)
      setDanceActive(true)
    }
    previousQuestionIndex.current = questionIndex
  }, [questionIndex])

  const isQuestionAnswered: Record<QuestionKind, (index: number) => boolean> = {
    'multiple-choice': index => answers[index] !== undefined,
    'multiple-select': index => (multiAnswers[index]?.length ?? 0) > 0,
    matching: index => Object.keys(connectionsByQuestion[index] ?? {}).length === questions.matching.pairs.length,
    'word-search': index => {
      const question = questions.wordSearchVersions[occurrenceOfKind(index, 'word-search')]
      return (foundWords[index]?.length ?? 0) === question.words.length
    },
  }
  const calculatedScore = questionKinds.reduce((total, kind, index) => {
    if (kind === 'multiple-choice') {
      const question = questions.multipleChoiceVersions[occurrenceOfKind(index, kind)]
      return total + (answers[index] === question.answer ? POINTS_PER_QUESTION : 0)
    }
    if (kind === 'multiple-select') {
      const question = questions.multipleSelectVersions[occurrenceOfKind(index, kind)]
      const selected = multiAnswers[index] ?? []
      const correct = selected.filter(answer => question.answers.includes(answer)).length
      const incorrect = selected.length - correct
      return total + Math.max(0, (correct - incorrect) / question.answers.length) * POINTS_PER_QUESTION
    }
    if (kind === 'word-search') {
      const question = questions.wordSearchVersions[occurrenceOfKind(index, kind)]
      return total + ((foundWords[index]?.length ?? 0) / question.words.length) * POINTS_PER_QUESTION
    }
    const matches = connectionsByQuestion[index] ?? {}
    const correct = Object.entries(matches).filter(([pairIndex, value]) => questions.matching.pairs[Number(pairIndex)]?.match === value).length
    return total + (correct / questions.matching.pairs.length) * POINTS_PER_QUESTION
  }, 0)
  const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
  const answeredCount = questionKinds.filter((kind, index) => isQuestionAnswered[kind](index)).length
  const score = answeredCount === 0 || !Number.isFinite(calculatedScore) ? 0 : calculatedScore
  const hasActiveAttempt = Boolean(initialProgress && !initialProgress.completed && !attemptHistory.some(item => item.attempt === attempts && item.completed))
  useEffect(() => {
    if (!started || !finished) return
    const savedAt = Date.now()
    const completed: SavedProgress = { attempts, answers, multiAnswers, connectionsByQuestion, foundWords, foundWordPaths, wordSelections, hintedCells, hintedWords, questionIndex, elapsedSeconds, questionTimes, savedAt, completed: true, hintsUsed, history: attemptHistory, score, answeredCount }
    try { localStorage.setItem(storageKey, JSON.stringify(completed)); setLastSaved(savedAt) } catch { /* storage can be unavailable */ }
    setAttemptHistory(history => history.some(item => item.attempt === attempts && item.completed)
      ? history
      : [...history, { attempt: attempts, completed: true, answeredCount, elapsedSeconds, savedAt, score }])
  }, [started, finished, storageKey, attempts, answers, multiAnswers, connectionsByQuestion, foundWords, foundWordPaths, wordSelections, hintedCells, hintedWords, questionIndex, elapsedSeconds, questionTimes, hintsUsed, attemptHistory, score, answeredCount])
  const finishEvaluation = () => {
    const completedAttempt: AttemptMetrics = { attempt: attempts, completed: true, answeredCount, elapsedSeconds, savedAt: Date.now(), score }
    setAttemptHistory(history => [...history.filter(item => item.attempt !== attempts), completedAttempt])
    setEvaluationView('respuestas')
    setFinished(true)
  }
  const goToNextQuestion = () => {
    if (questionIndex >= QUESTION_COUNT - 1) return
    setQuestionIndex(index => index + 1)
    setSelectedImage(null)
  }
  const evaluationEntry = <button className={cx('question-bank-choice evaluation-entry-choice')} type="button" disabled={attempts >= MAX_ATTEMPTS} onClick={() => {
    const saved = readProgress(storageKey)
    if (!saved || saved.completed) {
      const nextAttempts = Math.min(MAX_ATTEMPTS, (saved?.attempts ?? attempts) + 1)
      const history = [...(saved?.history ?? attemptHistory)]
      if (saved?.completed && !history.some(item => item.attempt === saved.attempts)) history.push({ attempt: saved.attempts, completed: true, answeredCount: saved.answeredCount ?? answeredCount, elapsedSeconds: saved.elapsedSeconds, savedAt: saved.savedAt, score: saved.score ?? score })
      setAttemptHistory(history)
      const fresh: SavedProgress = { attempts: nextAttempts, answers: {}, multiAnswers: {}, connectionsByQuestion: {}, foundWords: {}, foundWordPaths: {}, wordSelections: {}, hintedCells: {}, hintedWords: {}, questionIndex: 0, elapsedSeconds: 0, questionTimes: {}, savedAt: Date.now(), completed: false, hintsUsed: {}, history }
      try { localStorage.setItem(storageKey, JSON.stringify(fresh)) } catch { /* storage can be unavailable */ }
      setAttempts(nextAttempts); setLastSaved(fresh.savedAt)
      setQuestionIndex(0); setSecondsLeft(LIMIT_SECONDS); setFinished(false); setEvaluationView('inicio')
      setAnswers({}); setMultiAnswers({}); setConnectionsByQuestion({}); setFoundWords({}); setFoundWordPaths({}); setWordSelections({}); setHintedCells({}); setHintedWords({}); setQuestionTimes({}); setSelectedImage(null); setHintsUsed({})
    }
    setStarted(true)
    onEnter()
  }}><span className={cx('question-type-number')}><ListChecks size={19} aria-hidden="true" /></span><span className={cx('question-bank-choice-copy')}><strong>{hasActiveAttempt ? 'Continuar evaluación' : attempts > 0 ? 'Nuevo intento' : 'Entrar a evaluaciones'}</strong><small>{QUESTION_COUNT} preguntas · 10 minutos · calificación sobre 20</small></span><span className={cx('evaluation-entry-action')}>{attempts >= MAX_ATTEMPTS ? 'Intentos agotados' : 'Iniciar'} <ArrowRight size={17} aria-hidden="true" /></span></button>
  const displayedAttempts = [...attemptHistory]
  if (attempts > 0 && !displayedAttempts.some(item => item.attempt === attempts)) displayedAttempts.push({ attempt: attempts, completed: initialProgress?.completed ?? false, answeredCount: initialProgress?.answeredCount ?? answeredCount, elapsedSeconds: initialProgress?.elapsedSeconds ?? elapsedSeconds, savedAt: lastSaved ?? initialProgress?.savedAt ?? Date.now(), score: initialProgress?.score ?? (initialProgress?.completed ? score : undefined) })
  const reviewRows: ReviewRow[] = questionKinds.map((kind, index) => {
    if (kind === 'multiple-choice') {
      const question = questions.multipleChoiceVersions[occurrenceOfKind(index, kind)]
      const selected = answers[index]
      return { index, prompt: question.prompt, userAnswer: selected === undefined ? 'Sin responder' : question.options[selected], correctAnswer: question.options[question.answer], status: selected === undefined ? 'unanswered' : selected === question.answer ? 'correct' : 'incorrect' }
    }
    if (kind === 'multiple-select') {
      const question = questions.multipleSelectVersions[occurrenceOfKind(index, kind)]
      const selected = multiAnswers[index] ?? []
      const format = (indexes: number[]) => indexes.length ? indexes.map(optionIndex => question.options[optionIndex]).join(', ') : 'Sin responder'
      const isCorrect = selected.length === question.answers.length && question.answers.every(answer => selected.includes(answer))
      return { index, prompt: question.prompt, userAnswer: format(selected), correctAnswer: format(question.answers), status: selected.length === 0 ? 'unanswered' : isCorrect ? 'correct' : 'incorrect' }
    }
    if (kind === 'matching') {
      const questionConnections = connectionsByQuestion[index] ?? {}
      const selectedCount = Object.keys(questionConnections).length
      const correctCount = questions.matching.pairs.filter((pair, pairIndex) => questionConnections[pairIndex] === pair.match).length
      const formatPairs = (valueFor: (pairIndex: number, match: string) => string | undefined) => questions.matching.pairs.map((pair, pairIndex) => `${pair.imageAlt}: ${valueFor(pairIndex, pair.match) ?? 'Sin responder'}`).join(' · ')
      return { index, prompt: questions.matching.prompt, userAnswer: selectedCount ? formatPairs(pairIndex => questionConnections[pairIndex]) : 'Sin responder', correctAnswer: formatPairs((_pairIndex, match) => match), status: selectedCount === 0 ? 'unanswered' : correctCount === questions.matching.pairs.length ? 'correct' : 'incorrect' }
    }
    const question = questions.wordSearchVersions[occurrenceOfKind(index, kind)]
    const found = foundWords[index] ?? []
    const isCorrect = found.length === question.words.length && question.words.every(word => found.includes(word))
    return { index, prompt: question.prompt, userAnswer: found.length ? found.join(', ') : 'Sin responder', correctAnswer: question.words.join(', '), status: found.length === 0 ? 'unanswered' : isCorrect ? 'correct' : 'incorrect' }
  })
  const reviewCorrectCount = reviewRows.filter(row => row.status === 'correct').length
  const reviewIncorrectCount = reviewRows.filter(row => row.status === 'incorrect').length
  const reviewUnansweredCount = reviewRows.filter(row => row.status === 'unanswered').length
  const hasCompletedAttempt = finished || initialProgress?.completed === true || attemptHistory.some(item => item.completed)
  const topicsToReview = reviewRows.filter(row => row.status !== 'correct')
  const questionSeconds = questionKinds.map((_, index) => questionTimes[index] ?? 0)
  const longestQuestionSeconds = Math.max(1, ...questionSeconds)
  const averageQuestionSeconds = Math.round(elapsedSeconds / QUESTION_COUNT)
  const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)} min ${seconds % 60} s`
  const evaluationTabs: { id: EvaluationView; label: string; Icon: typeof MessageSquareText }[] = [
    { id: 'respuestas', label: 'Respuestas', Icon: MessageSquareText },
    { id: 'analisis', label: 'Análisis', Icon: BarChart3 },
  ]
  if (!started || finished) return <section ref={evaluationHubRef} className={cx('course-evaluations-panel evaluation-hub evaluation-overview')} data-evaluation-overview="true" aria-label={`Evaluación de ${topicTitle}`}>
    {hasCompletedAttempt && evaluationView !== 'inicio' && <div className={cx('evaluation-view-tabs-sticky')}>
      <nav className={cx('evaluation-view-tabs')} role="tablist" aria-label="Secciones de la evaluación">
        {evaluationTabs.map(({ id, label, Icon }) => <button className={cx(`evaluation-view-tab${evaluationView === id ? ' is-active' : ''}`)} key={id} type="button" role="tab" aria-selected={evaluationView === id} onClick={() => {
          setEvaluationView(id)
        }}><Icon size={17} aria-hidden="true" />{label}</button>)}
      </nav>
    </div>}
    {evaluationView === 'respuestas' && hasCompletedAttempt && <article className={cx('question-card evaluation-review-card')} role="tabpanel">
      <div className={cx('evaluation-review-summary')}><strong>{Number(score.toFixed(1))}<span> / 20</span></strong><p>{reviewCorrectCount} correctas · {reviewIncorrectCount} incorrectas · {reviewUnansweredCount} sin responder</p></div>
      <div className={cx('evaluation-review-table-wrap')}>
        <table className={cx('evaluation-review-table')}>
          <thead><tr><th scope="col">#</th><th scope="col">Pregunta</th><th scope="col">Tu respuesta</th><th scope="col">Respuesta correcta</th><th scope="col">Resultado</th></tr></thead>
          <tbody>{reviewRows.map(row => <tr key={row.index}><td>{String(row.index + 1).padStart(2, '0')}</td><td>{row.prompt}</td><td>{row.userAnswer}</td><td>{row.correctAnswer}</td><td><span className={cx(`evaluation-review-status is-${row.status}`)}>{row.status === 'correct' ? 'Correcta' : row.status === 'incorrect' ? 'Incorrecta' : 'Sin responder'}</span></td></tr>)}</tbody>
        </table>
      </div>
      <button className={cx('evaluation-review-back')} type="button" onClick={() => {
        setEvaluationView('inicio')
        setStarted(false)
        setFinished(false)
        requestAnimationFrame(() => evaluationHubRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }}><ArrowLeft size={16} aria-hidden="true" />Volver a evaluaciones</button>
    </article>}
    {evaluationView === 'analisis' && hasCompletedAttempt && <div className={cx('evaluation-analysis')} role="tabpanel">
      <div className={cx('evaluation-analysis-heading')}><div><span>Análisis del intento {attempts}</span><h2>Tu progreso</h2></div><strong>{Number(score.toFixed(1))}<small> / 20</small></strong></div>
      <div className={cx('evaluation-kpi-grid')}>
        <article className={cx('evaluation-kpi is-correct')}><CheckCircle2 size={19} aria-hidden="true" /><span>Correctas</span><strong>{reviewCorrectCount}<small> de {QUESTION_COUNT}</small></strong></article>
        <article className={cx('evaluation-kpi is-incorrect')}><XCircle size={19} aria-hidden="true" /><span>Incorrectas</span><strong>{reviewIncorrectCount}<small> de {QUESTION_COUNT}</small></strong></article>
        <article className={cx('evaluation-kpi is-time')}><Clock3 size={19} aria-hidden="true" /><span>Tiempo total</span><strong>{formatDuration(elapsedSeconds)}</strong></article>
        <article className={cx('evaluation-kpi is-average')}><Timer size={19} aria-hidden="true" /><span>Promedio por pregunta</span><strong>{formatDuration(averageQuestionSeconds)}</strong></article>
      </div>
      <section className={cx('evaluation-analysis-card')} aria-labelledby="evaluation-time-chart-title">
        <h3 id="evaluation-time-chart-title">Tiempo por pregunta</h3>
        {Object.keys(questionTimes).length === 0 && <p className={cx('evaluation-time-note')}>El detalle por pregunta estará disponible en los intentos realizados desde ahora.</p>}
        <div className={cx('evaluation-time-chart')}>
          {reviewRows.map((row, index) => <div className={cx('evaluation-time-row')} key={row.index}>
            <span className={cx('evaluation-time-label')}>Pregunta {String(index + 1).padStart(2, '0')}</span>
            <div className={cx('evaluation-time-track')} role="img" aria-label={`Pregunta ${index + 1}: ${formatDuration(questionSeconds[index])}, ${row.status === 'correct' ? 'correcta' : row.status === 'incorrect' ? 'incorrecta' : 'sin responder'}`}>
              <span className={cx(`evaluation-time-bar is-${row.status}`)} style={{ width: `${questionSeconds[index] ? Math.max(3, questionSeconds[index] / longestQuestionSeconds * 100) : 0}%` }} />
            </div>
            <strong>{questionTimes[index] === undefined ? '—' : `${questionSeconds[index]} s`}</strong>
          </div>)}
        </div>
      </section>
      <section className={cx('evaluation-analysis-card evaluation-topics-card')} aria-labelledby="evaluation-topics-title">
        <h3 id="evaluation-topics-title">Temas que debes repasar</h3>
        {topicsToReview.length > 0
          ? <><p>Refuerza <strong>{topicTitle}</strong> con estas preguntas:</p><ul>{topicsToReview.map(row => <li key={row.index}><span className={cx(`evaluation-review-status is-${row.status}`)}>{row.status === 'incorrect' ? 'Incorrecta' : 'Sin responder'}</span><span>{row.prompt}</span></li>)}</ul></>
          : <p>¡Buen trabajo! No tienes preguntas pendientes de repaso en este tema.</p>}
      </section>
      <button className={cx('evaluation-review-back')} type="button" onClick={() => setEvaluationView('respuestas')}><MessageSquareText size={16} aria-hidden="true" />Ver respuestas</button>
    </div>}
    {evaluationView === 'inicio' && <div role="tabpanel">
      <header className={cx('question-bank-header evaluation-welcome-header')}>
        <div className={cx('evaluation-welcome-artwork')} aria-hidden="true">
          {[evaluationChecklist, evaluationIllustration, evaluationResults].map(illustration => <span className={cx('evaluation-welcome-illustration')} key={illustration}><img src={illustration} alt="" /></span>)}
        </div>
        <div className={cx('evaluation-welcome-copy')}><span className={cx('question-bank-icon')}><CircleHelp size={22} aria-hidden="true" /></span><div><h2>Evaluaciones</h2><p>Comprueba lo aprendido en {topicTitle}.</p></div></div>
      </header>
      {!hasActiveAttempt && attempts < MAX_ATTEMPTS && evaluationEntry}
      {(attemptHistory.length > 0 || attempts > 0) && <div className={cx('evaluation-attempt-grid')} aria-label="Historial de intentos">
        {displayedAttempts.map(item => <article className={cx('evaluation-attempt-card')} key={item.attempt}>
          <header><span className={cx('evaluation-attempt-heading')}><span className={cx('evaluation-attempt-icon')}><ClipboardList size={17} aria-hidden="true" /></span><strong>Intento {item.attempt}</strong></span></header>
          <div className={cx('evaluation-attempt-metrics')}><span className={cx('evaluation-status-chip is-answered')}><ListChecks size={14} aria-hidden="true" />{item.answeredCount}/{QUESTION_COUNT} respondidas</span><span className={cx('evaluation-status-chip is-elapsed')}><Clock3 size={14} aria-hidden="true" />{Math.floor(item.elapsedSeconds / 60)} min {item.elapsedSeconds % 60} s</span>{item.completed && item.score !== undefined && <span className={cx('evaluation-status-chip is-score')}><CheckCircle2 size={14} aria-hidden="true" />Nota: {Number(item.score.toFixed(1))}/20</span>}<span className={cx(`evaluation-status-chip${item.completed ? ' is-complete' : ' is-progress'}`)}>{item.completed ? <CheckCircle2 size={14} aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}{item.completed ? 'Finalizado' : 'En curso'}</span>{!item.completed && <><span className={cx('evaluation-status-chip is-time-left')}><Hourglass size={14} aria-hidden="true" />Quedan {Math.floor(Math.max(0, LIMIT_SECONDS - item.elapsedSeconds) / 60)} min {Math.max(0, LIMIT_SECONDS - item.elapsedSeconds) % 60} s</span>{item.attempt === attempts && <button className={cx('evaluation-resume-button')} type="button" onClick={() => { setStarted(true); onEnter() }}><RotateCcw size={14} aria-hidden="true" />Reanudar</button>}</>}</div>
        </article>)}
      </div>}
      {attempts >= MAX_ATTEMPTS && <p className={cx('evaluation-attempt-limit')}>Ya usaste los 3 intentos disponibles.</p>}
    </div>}
  </section>

  const prompt = currentKind === 'multiple-choice' ? currentMultipleChoice.prompt : currentKind === 'multiple-select' ? currentMultipleSelect.prompt : currentKind === 'matching' ? questions.matching.prompt : currentWordSearch.prompt
  return <section className={cx('course-evaluations-panel')} aria-label={`Evaluación de ${topicTitle}`}>
    <div className={cx('evaluation-layout')}>
      <aside className={cx('evaluation-rail')} aria-label="Progreso de la evaluación">
        <div className={cx('evaluation-support-card')}>
          <div className={cx('question-encouragement')} role="status">
            <PenguinMascot key={danceSequence} className={cx('question-encouragement-vector')} expression={penguinExpressions[questionIndex % penguinExpressions.length]} dance={danceActive} />
            <span key={questionIndex} className={cx('question-encouragement-copy')}><strong><BookOpen size={16} aria-hidden="true" /> {encouragement.title}</strong><span>{encouragement.detail}</span></span>
          </div>
          <div className={cx(`evaluation-timer${secondsLeft <= 60 ? ' is-low' : ''}`)} style={{ '--timer-progress': `${(secondsLeft / LIMIT_SECONDS) * 360}deg` } as CSSProperties}>
            <div className={cx('evaluation-timer-label')}><Clock3 size={16} /><span>{timeLabel}</span></div>
            <div className={cx('evaluation-timer-track')} role="progressbar" aria-label="Tiempo restante" aria-valuemin={0} aria-valuemax={LIMIT_SECONDS} aria-valuenow={secondsLeft}><span style={{ width: `${(secondsLeft / LIMIT_SECONDS) * 100}%` }} /></div>
          </div>
        </div>
        <nav className={cx('evaluation-question-list')} aria-label="Ir a una pregunta">{questionKinds.map((kind, index) => {
          const answered = isQuestionAnswered[kind](index)
          return <button type="button" key={index} className={cx(`${questionIndex === index ? 'current ' : ''}${answered ? 'answered' : ''}`)} onClick={() => { setQuestionIndex(index); setSelectedImage(null) }} aria-current={questionIndex === index ? 'step' : undefined} aria-label={`Pregunta ${index + 1}${answered ? ', respondida' : ', sin responder'}`}><span>{String(index + 1).padStart(2, '0')}</span>{answered && <Check size={14} aria-hidden="true" />}</button>
        })}</nav>
      </aside>
      <div className={cx('evaluation-question-area')}>
        <article className={cx('question-card question-activity-card')}>
          <h3>{prompt}</h3>
          {currentKind === 'multiple-choice' && <div id="course-evaluation-options" className={cx('question-options')}>{currentMultipleChoice.options.map((option, index) => { const selected = answers[questionIndex] === index; return <button type="button" key={option} className={cx(selected ? 'is-selected' : '')} onClick={() => setAnswers(current => ({ ...current, [questionIndex]: index }))} aria-pressed={selected}><span className={cx('question-option-letter')}>{String.fromCharCode(65 + index)}</span><span>{option}</span></button> })}</div>}
          {currentKind === 'multiple-select' && <div className={cx('question-options multiple-select-options')} role="group" aria-label="Selecciona una o más opciones">{currentMultipleSelect.options.map((option, index) => { const selected = (multiAnswers[questionIndex] ?? []).includes(index); const image = currentMultipleSelect.optionImages[index]; return <label key={option} className={cx(`multiple-select-option${selected ? ' is-selected' : ''}`)}><input type="checkbox" checked={selected} onChange={() => setMultiAnswers(current => { const selectedOptions = current[questionIndex] ?? []; const next = selected ? selectedOptions.filter(item => item !== index) : [...selectedOptions, index]; return { ...current, [questionIndex]: next } })} /><span className={cx('multiple-select-image-wrap')}><img className={cx('multiple-select-option-image')} src={image.imageUrl} alt={image.imageAlt} loading="lazy" /><span className={cx('question-option-letter')}>{String.fromCharCode(65 + index)}</span></span><span className={cx('multiple-select-answer')}>{option}</span></label> })}</div>}
          {currentKind === 'matching' && <><div className={cx('matching-board')}><svg className={cx('matching-connections')} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{Object.entries(connections).map(([sourceIndex, value]) => { const from = Number(sourceIndex); const to = questions.matching.options.indexOf(value); const y1 = ((from + .5) / questions.matching.pairs.length) * 100; const y2 = ((to + .5) / questions.matching.options.length) * 100; return <path key={`${from}-${value}`} className={cx('matching-connection-path')} d={`M 43 ${y1} C 47 ${y1}, 53 ${y2}, 57 ${y2}`} /> })}</svg><div className={cx('matching-image-list')}>{questions.matching.pairs.map((pair, index) => <button type="button" key={pair.imageAlt} className={cx(`matching-image-choice${selectedImage === index ? ' is-selected' : ''}${connections[index] ? ' is-connected' : ''}`)} onClick={() => setSelectedImage(index)} aria-pressed={selectedImage === index} aria-label={`Opción ${String.fromCharCode(65 + index)}: ${pair.imageAlt}`}><img src={pair.imageUrl} alt={pair.imageAlt} loading="lazy" /><span>{String.fromCharCode(65 + index)}.</span><i aria-hidden="true" /></button>)}</div><div className={cx('matching-answer-list')}>{questions.matching.options.map((option, index) => <button type="button" key={option} className={cx(`matching-answer-choice${Object.values(connections).includes(option) ? ' is-connected' : ''}`)} onClick={() => { if (selectedImage === null) return; setConnectionsByQuestion(current => ({ ...current, [questionIndex]: { ...(current[questionIndex] ?? {}), [selectedImage]: option } })); setSelectedImage(null) }} aria-label={`Respuesta ${index + 1}: ${option.replace(/\s*→\s*/g, ' ')}`}><span>{String.fromCharCode(65 + index)}.</span><strong>{option.replace(/\s*→\s*/g, ' ')}</strong><i aria-hidden="true" /></button>)}</div></div></>}
          {currentKind === 'word-search' && <>
            <div className={cx('word-search-layout')}>
              <div className={cx('word-search-grid')} role="group" aria-label="Selecciona las letras de la sopa de letras">
                {rows.map((row, rowIndex) => <div className={cx('word-search-row')} key={`row-${rowIndex}`} style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                  {row.map((letter, colIndex) => {
                    const index = rowIndex * row.length + colIndex
                    const selected = (wordSelections[questionIndex] ?? []).includes(index)
                    const correct = correctWordCells.has(index)
                    const hinted = (hintedCells[questionIndex] ?? []).includes(index)
                    return <button type="button" key={`${letter}-${index}`} aria-label={`Letra ${letter}, posición ${index + 1}${hinted ? ', pista' : ''}${correct ? ', correcta' : ''}`} className={cx(`${selected ? 'selected-letter' : ''}${correct ? ' is-correct-letter' : ''}${hinted ? ' is-hinted-letter' : ''}`)} onClick={() => selectWordCell(index)} aria-pressed={selected || correct}>{letter}</button>
                  })}
                </div>)}
              </div>
              <aside className={cx('word-search-progress')} aria-label="Progreso de palabras">
                <p className={cx('word-search-progress-summary')}><Search size={15} aria-hidden="true" />{currentFoundWords.length}/{currentWordSearch.words.length} palabras</p>
                <div className={cx('word-search-progress-track')} role="progressbar" aria-label="Palabras encontradas" aria-valuemin={0} aria-valuemax={currentWordSearch.words.length} aria-valuenow={currentFoundWords.length}><span style={{ width: `${(currentFoundWords.length / currentWordSearch.words.length) * 100}%` }} /></div>
                <ol>{currentWordSearch.words.map(word => {
                  const found = currentFoundWords.includes(word)
                  return <li key={word} className={cx(found ? 'found' : '')}>{found ? <Check size={14} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}<span>{word}</span></li>
                })}</ol>
                <div className={cx('word-search-controls')}><button className={cx('word-search-hint')} type="button" onClick={() => {
                  const availableWords = currentWordSearch.words.filter(word => !currentFoundWords.includes(word))
                  const questionHintedWords = hintedWords[questionIndex] ?? []
                  const unhintedWords = availableWords.filter(word => !questionHintedWords.includes(word))
                  const candidates = unhintedWords.length > 0
                    ? unhintedWords
                    : availableWords.filter(word => word !== questionHintedWords[questionHintedWords.length - 1])
                  const nextWord = candidates[0]
                  const path = nextWord ? findWordPath(rows, nextWord) : null
                  if (nextWord && path) {
                    const hintedCell = path[Math.floor(Math.random() * path.length)]
                    setHintedCells(current => ({ ...current, [questionIndex]: [...(current[questionIndex] ?? []), hintedCell] }))
                    setHintedWords(current => ({ ...current, [questionIndex]: [...(current[questionIndex] ?? []), nextWord] }))
                    selectWordCell(hintedCell, true)
                    setHintsUsed(current => ({ ...current, [questionIndex]: Math.min(3, (current[questionIndex] ?? 0) + 1) }))
                  }
                }} disabled={(hintsUsed[questionIndex] ?? 0) >= 3 || currentFoundWords.length === currentWordSearch.words.length}><Lightbulb size={15} aria-hidden="true" />Pistas {hintsUsed[questionIndex] ?? 0}/3</button><button className={cx('word-search-reset')} type="button" onClick={() => {
                  setWordSelections(current => ({ ...current, [questionIndex]: [] }))
                  setHintedCells(current => ({ ...current, [questionIndex]: [] }))
                }}><RotateCcw size={15} aria-hidden="true" />Limpiar</button></div>
              </aside>
            </div>
          </>}
          <div className={cx('evaluation-action-row')}>
            <button className={cx('evaluation-button secondary evaluation-previous-button')} type="button" disabled={questionIndex === 0} onClick={() => { setQuestionIndex(index => Math.max(0, index - 1)); setSelectedImage(null) }}>Anterior</button>
            <button className={cx('evaluation-button evaluation-next-button')} type="button" disabled={questionIndex === QUESTION_COUNT - 1} onClick={goToNextQuestion}>Siguiente</button>
            <button className={cx('evaluation-finish-button')} type="button" onClick={finishEvaluation}>Finalizar</button>
          </div>
        </article>
      </div>
    </div>
  </section>
}
