import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, BookOpen, Check, CheckCircle2, Circle, CircleHelp, ClipboardList, Clock3, Hourglass, Lightbulb, ListChecks, RotateCcw, Search } from 'lucide-react'
import { getSchoolQuestionSet } from '../mocks/schoolQuestionMock'
import { PenguinMascot } from './PenguinMascot'
import './QuestionBank.css'

interface Props { courseId: string; courseName: string; topicTitle: string; mode: 'entry' | 'assessment'; onEnter?: () => void; onExit?: () => void }
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
  questionIndex: number; elapsedSeconds: number; savedAt: number; completed: boolean; hintsUsed?: number
  history?: AttemptMetrics[]; score?: number; answeredCount?: number
}
interface AttemptMetrics { attempt: number; completed: boolean; answeredCount: number; elapsedSeconds: number; savedAt: number; score?: number }
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

export function QuestionBank({ courseId, courseName, topicTitle, mode, onEnter = () => undefined, onExit = () => undefined }: Props) {
  const questions = getSchoolQuestionSet(courseId, topicTitle)
  const storageKey = progressKey(courseId, topicTitle)
  const initialProgress = useRef(readProgress(storageKey)).current
  const [attempts, setAttempts] = useState(initialProgress?.attempts ?? 0)
  const [lastSaved, setLastSaved] = useState(initialProgress?.savedAt ?? null)
  const [started, setStarted] = useState(mode === 'assessment')
  const [finished, setFinished] = useState(mode === 'assessment' && (initialProgress?.completed ?? false))
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
  const [hintsUsed, setHintsUsed] = useState(initialProgress?.hintsUsed ?? 0)
  const [hintedCells, setHintedCells] = useState<Record<number, number>>({})
  const [attemptHistory, setAttemptHistory] = useState<AttemptMetrics[]>(initialProgress?.history ?? [])
  const elapsedSeconds = Math.max(0, LIMIT_SECONDS - secondsLeft)

  useEffect(() => {
    if (!started || finished) return
    const progress: SavedProgress = { attempts, answers, multiAnswers, connectionsByQuestion, foundWords, foundWordPaths, wordSelections, questionIndex, elapsedSeconds, savedAt: Date.now(), completed: false, hintsUsed, history: attemptHistory }
    try { localStorage.setItem(storageKey, JSON.stringify(progress)); setLastSaved(progress.savedAt) } catch { /* storage can be unavailable */ }
  }, [started, storageKey, attempts, answers, multiAnswers, connectionsByQuestion, foundWords, foundWordPaths, wordSelections, questionIndex, elapsedSeconds, finished, hintsUsed, attemptHistory])
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

  useEffect(() => {
    if (!started || finished) return
    const timer = window.setTimeout(() => {
      if (secondsLeft <= 1) {
        setSecondsLeft(0); setFinished(true)
      }
      else setSecondsLeft(secondsLeft - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [started, finished, secondsLeft, storageKey])

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

  const score = questionKinds.reduce((total, kind, index) => {
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
  const answeredCount = questionKinds.filter((kind, index) => kind === 'multiple-choice'
    ? answers[index] !== undefined
    : kind === 'multiple-select'
      ? (multiAnswers[index]?.length ?? 0) > 0
      : kind === 'matching'
        ? Object.keys(connectionsByQuestion[index] ?? {}).length === questions.matching.pairs.length
        : (foundWords[index]?.length ?? 0) > 0).length
  const hasActiveAttempt = Boolean(initialProgress && !initialProgress.completed)
  useEffect(() => {
    if (!started || !finished) return
    const savedAt = Date.now()
    const completed: SavedProgress = { attempts, answers, multiAnswers, connectionsByQuestion, foundWords, foundWordPaths, wordSelections, questionIndex, elapsedSeconds, savedAt, completed: true, hintsUsed, history: attemptHistory, score, answeredCount }
    try { localStorage.setItem(storageKey, JSON.stringify(completed)); setLastSaved(savedAt) } catch { /* storage can be unavailable */ }
  }, [started, finished, storageKey, attempts, answers, multiAnswers, connectionsByQuestion, foundWords, foundWordPaths, wordSelections, questionIndex, elapsedSeconds, hintsUsed, attemptHistory, score, answeredCount])
  const goToNextQuestion = () => {
    if (questionIndex === QUESTION_COUNT - 1) {
      setFinished(true)
      return
    }
    setQuestionIndex(index => index + 1)
    setSelectedImage(null)
  }
  const evaluationEntry = <button className="question-bank-choice evaluation-entry-choice" type="button" disabled={attempts >= MAX_ATTEMPTS} onClick={() => {
    const saved = readProgress(storageKey)
    if (!saved || saved.completed) {
      const nextAttempts = Math.min(MAX_ATTEMPTS, (saved?.attempts ?? attempts) + 1)
      const history = [...(saved?.history ?? attemptHistory)]
      if (saved?.completed && !history.some(item => item.attempt === saved.attempts)) history.push({ attempt: saved.attempts, completed: true, answeredCount: saved.answeredCount ?? answeredCount, elapsedSeconds: saved.elapsedSeconds, savedAt: saved.savedAt, score: saved.score ?? score })
      setAttemptHistory(history)
      const fresh: SavedProgress = { attempts: nextAttempts, answers: {}, multiAnswers: {}, connectionsByQuestion: {}, foundWords: {}, foundWordPaths: {}, wordSelections: {}, questionIndex: 0, elapsedSeconds: 0, savedAt: Date.now(), completed: false, hintsUsed: 0, history }
      try { localStorage.setItem(storageKey, JSON.stringify(fresh)) } catch { /* storage can be unavailable */ }
      setAttempts(nextAttempts); setLastSaved(fresh.savedAt)
      setQuestionIndex(0); setSecondsLeft(LIMIT_SECONDS); setFinished(false)
      setAnswers({}); setMultiAnswers({}); setConnectionsByQuestion({}); setFoundWords({}); setFoundWordPaths({}); setWordSelections({}); setSelectedImage(null); setHintsUsed(0); setHintedCells({})
    }
    setStarted(true)
    onEnter()
  }}><span className="question-type-number"><ListChecks size={19} aria-hidden="true" /></span><span className="question-bank-choice-copy"><strong>{attempts > 0 && !initialProgress?.completed ? 'Continuar evaluación' : 'Entrar a evaluaciones'}</strong><small>{QUESTION_COUNT} preguntas · 10 minutos · calificación sobre 20</small></span><span className="evaluation-entry-action">{attempts >= MAX_ATTEMPTS ? 'Intentos agotados' : 'Iniciar'} <ArrowRight size={17} aria-hidden="true" /></span></button>
  if (finished) return <section className="course-evaluations-panel" aria-labelledby="evaluation-result-title">
    <header className="question-bank-header"><span className="question-bank-icon"><Check size={22} /></span><div><span className="question-activity-course">{courseName} · {topicTitle}</span><h2 id="evaluation-result-title">Evaluación finalizada</h2><p>Tu resultado para este tema</p></div></header>
    <article className="question-card evaluation-result"><strong>{Number(score.toFixed(1))}<span> / 20</span></strong><p>{score >= 14 ? 'Aprobado' : 'Sigue practicando este tema.'}</p><p>Intento {attempts} de {MAX_ATTEMPTS} · Tiempo: {Math.floor(elapsedSeconds / 60)} min {elapsedSeconds % 60} s</p><button className="evaluation-button" type="button" onClick={onExit}>Volver al resumen</button></article>
  </section>

  if (!started) return <section className="course-evaluations-panel" aria-labelledby="question-bank-title">
    <header className="question-bank-header"><span className="question-bank-icon"><CircleHelp size={22} /></span><div><h2 id="question-bank-title">Evaluaciones</h2><p>Comprueba lo aprendido en {topicTitle}.</p></div></header>
    {!hasActiveAttempt && evaluationEntry}
    {(attemptHistory.length > 0 || attempts > 0) && <div className="evaluation-attempt-grid" aria-label="Historial de intentos">
      {[...attemptHistory, ...(attempts > 0 ? [{ attempt: attempts, completed: initialProgress?.completed ?? false, answeredCount: initialProgress?.answeredCount ?? answeredCount, elapsedSeconds: initialProgress?.elapsedSeconds ?? elapsedSeconds, savedAt: lastSaved ?? initialProgress?.savedAt ?? Date.now(), score: initialProgress?.score ?? (initialProgress?.completed ? score : undefined) }] : [])].map(item => <article className="evaluation-attempt-card" key={item.attempt}>
        <header><span className="evaluation-attempt-heading"><span className="evaluation-attempt-icon"><ClipboardList size={17} aria-hidden="true" /></span><strong>Intento {item.attempt}</strong></span></header>
        <div className="evaluation-attempt-metrics"><span className="evaluation-status-chip"><ListChecks size={14} aria-hidden="true" />{item.answeredCount}/{QUESTION_COUNT} respondidas</span><span className="evaluation-status-chip"><Clock3 size={14} aria-hidden="true" />{Math.floor(item.elapsedSeconds / 60)} min {item.elapsedSeconds % 60} s</span>{item.completed && item.score !== undefined && <span className="evaluation-status-chip is-score"><CheckCircle2 size={14} aria-hidden="true" />Nota: {Number(item.score.toFixed(1))}/20</span>}<span className={`evaluation-status-chip${item.completed ? ' is-complete' : ' is-progress'}`}>{item.completed ? <CheckCircle2 size={14} aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}{item.completed ? 'Finalizado' : 'En curso'}</span>{!item.completed && <span className="evaluation-status-chip is-time-left"><Hourglass size={14} aria-hidden="true" />Quedan {Math.floor(Math.max(0, LIMIT_SECONDS - item.elapsedSeconds) / 60)} min {Math.max(0, LIMIT_SECONDS - item.elapsedSeconds) % 60} s</span>}</div>
        {!item.completed && item.attempt === attempts && <button className="evaluation-resume-button" type="button" onClick={() => { setStarted(true); onEnter() }}><RotateCcw size={16} aria-hidden="true" />Reanudar evaluación</button>}
      </article>)}
    </div>}
    {attempts >= MAX_ATTEMPTS && <p className="evaluation-attempt-limit">Ya usaste los 3 intentos disponibles.</p>}
  </section>

  const prompt = currentKind === 'multiple-choice' ? currentMultipleChoice.prompt : currentKind === 'multiple-select' ? currentMultipleSelect.prompt : currentKind === 'matching' ? questions.matching.prompt : currentWordSearch.prompt
  return <section className="course-evaluations-panel" aria-label={`Evaluación de ${topicTitle}`}>
    <div className="evaluation-layout">
      <aside className="evaluation-rail" aria-label="Progreso de la evaluación">
        <div className="question-encouragement" role="status">
          <PenguinMascot key={danceSequence} expression={penguinExpressions[questionIndex % penguinExpressions.length]} dance={danceActive} />
          <span key={questionIndex} className="question-encouragement-copy"><strong><BookOpen size={16} aria-hidden="true" /> {encouragement.title}</strong><span>{encouragement.detail}</span></span>
        </div>
        <div className={`evaluation-timer${secondsLeft <= 60 ? ' is-low' : ''}`} style={{ '--timer-progress': `${(secondsLeft / LIMIT_SECONDS) * 360}deg` } as CSSProperties}>
          <div className="evaluation-timer-label"><Clock3 size={16} /><span>{timeLabel}</span></div>
          <div className="evaluation-timer-track" role="progressbar" aria-label="Tiempo restante" aria-valuemin={0} aria-valuemax={LIMIT_SECONDS} aria-valuenow={secondsLeft}><span style={{ width: `${(secondsLeft / LIMIT_SECONDS) * 100}%` }} /></div>
        </div>
        <nav className="evaluation-question-list" aria-label="Ir a una pregunta">{questionKinds.map((kind, index) => {
          const answered = kind === 'multiple-choice'
            ? answers[index] !== undefined
            : kind === 'multiple-select'
              ? (multiAnswers[index]?.length ?? 0) > 0
              : kind === 'matching'
                ? Object.keys(connectionsByQuestion[index] ?? {}).length === questions.matching.pairs.length
                : (foundWords[index]?.length ?? 0) > 0
          return <button type="button" key={index} className={`${questionIndex === index ? 'current ' : ''}${answered ? 'answered' : ''}`} onClick={() => { setQuestionIndex(index); setSelectedImage(null) }} aria-current={questionIndex === index ? 'step' : undefined} aria-label={`Pregunta ${index + 1}${answered ? ', respondida' : ''}`}><span>{String(index + 1).padStart(2, '0')}</span>{answered && <Check size={14} aria-hidden="true" />}</button>
        })}</nav>
        <div className="evaluation-navigation evaluation-rail-navigation">
          <button className="evaluation-button secondary" type="button" disabled={questionIndex === 0} onClick={() => { setQuestionIndex(index => Math.max(0, index - 1)); setSelectedImage(null) }}>Anterior</button>
          <button className="evaluation-button" type="button" onClick={goToNextQuestion}>{questionIndex === QUESTION_COUNT - 1 ? 'Finalizar' : 'Siguiente'}</button>
        </div>
      </aside>
      <div className="evaluation-question-area">
        <article className="question-card question-activity-card">
          <h3>{prompt}</h3>
          {currentKind === 'multiple-choice' && <div className="question-options">{currentMultipleChoice.options.map((option, index) => { const selected = answers[questionIndex] === index; return <button type="button" key={option} className={selected ? 'is-selected' : ''} onClick={() => setAnswers(current => ({ ...current, [questionIndex]: index }))} aria-pressed={selected}><span className="question-option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span></button> })}</div>}
          {currentKind === 'multiple-select' && <div className="question-options multiple-select-options" role="group" aria-label="Selecciona una o más opciones">{currentMultipleSelect.options.map((option, index) => { const selected = (multiAnswers[questionIndex] ?? []).includes(index); const image = currentMultipleSelect.optionImages[index]; return <label key={option} className={`multiple-select-option${selected ? ' is-selected' : ''}`}><input type="checkbox" checked={selected} onChange={() => setMultiAnswers(current => { const selectedOptions = current[questionIndex] ?? []; const next = selected ? selectedOptions.filter(item => item !== index) : [...selectedOptions, index]; return { ...current, [questionIndex]: next } })} /><img className="multiple-select-option-image" src={image.imageUrl} alt={image.imageAlt} loading="lazy" /><span className="question-option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span></label> })}</div>}
          {currentKind === 'matching' && <><div className="matching-board"><svg className="matching-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{Object.entries(connections).map(([sourceIndex, value]) => { const from = Number(sourceIndex); const to = questions.matching.options.indexOf(value); const y1 = ((from + .5) / questions.matching.pairs.length) * 100; const y2 = ((to + .5) / questions.matching.options.length) * 100; return <path key={`${from}-${value}`} className="matching-connection-path" d={`M 43 ${y1} C 47 ${y1}, 53 ${y2}, 57 ${y2}`} /> })}</svg><div className="matching-image-list">{questions.matching.pairs.map((pair, index) => <button type="button" key={pair.imageAlt} className={`matching-image-choice${selectedImage === index ? ' is-selected' : ''}${connections[index] ? ' is-connected' : ''}`} onClick={() => setSelectedImage(index)} aria-pressed={selectedImage === index} aria-label={`Opción ${String.fromCharCode(65 + index)}: ${pair.imageAlt}`}><img src={pair.imageUrl} alt={pair.imageAlt} loading="lazy" /><span>{String.fromCharCode(65 + index)}.</span><i aria-hidden="true" /></button>)}</div><div className="matching-answer-list">{questions.matching.options.map((option, index) => <button type="button" key={option} className={`matching-answer-choice${Object.values(connections).includes(option) ? ' is-connected' : ''}`} onClick={() => { if (selectedImage === null) return; setConnectionsByQuestion(current => ({ ...current, [questionIndex]: { ...(current[questionIndex] ?? {}), [selectedImage]: option } })); setSelectedImage(null) }} aria-label={`Respuesta ${index + 1}: ${option}`}><span>{String.fromCharCode(65 + index)}.</span><strong>{option}</strong><i aria-hidden="true" /></button>)}</div></div></>}
          {currentKind === 'word-search' && <>
            <div className="word-search-layout">
              <div className="word-search-grid" role="group" aria-label="Selecciona las letras de la sopa de letras">
                {rows.map((row, rowIndex) => <div className="word-search-row" key={`row-${rowIndex}`} style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                  {row.map((letter, colIndex) => {
                    const index = rowIndex * row.length + colIndex
                    const selected = (wordSelections[questionIndex] ?? []).includes(index)
                    const correct = correctWordCells.has(index)
                    const hinted = hintedCells[questionIndex] === index && !correct
                    return <button type="button" key={`${letter}-${index}`} aria-label={`Letra ${letter}, posición ${index + 1}${correct ? ', correcta' : hinted ? ', pista' : ''}`} className={`${selected ? 'selected-letter' : ''}${correct ? ' is-correct-letter' : ''}${hinted ? ' is-hinted-letter' : ''}`} style={correct ? { animationDelay: `${[...correctWordCells].indexOf(index) * 45}ms` } : undefined} onClick={() => {
                      if (correct) return
                      const currentSelection = wordSelections[questionIndex] ?? []
                      const next = selected ? currentSelection.filter(item => item !== index) : [...currentSelection, index]
                      const matchedPath = currentWordSearch.words
                        .filter(word => !currentFoundWords.includes(word) && word.length === next.length)
                        .map(word => ({ word, path: findWordPath(rows, word) }))
                        .find(candidate => candidate.path?.length === next.length && candidate.path.every(cell => next.includes(cell)))
                      const match = matchedPath?.word
                      if (match) {
                        setFoundWords(current => ({ ...current, [questionIndex]: [...(current[questionIndex] ?? []), match] }))
                        setFoundWordPaths(current => ({ ...current, [questionIndex]: { ...(current[questionIndex] ?? {}), [match]: matchedPath.path! } }))
                        setWordSelections(current => ({ ...current, [questionIndex]: [] }))
                        setHintedCells(current => { const nextHints = { ...current }; delete nextHints[questionIndex]; return nextHints })
                      } else setWordSelections(current => ({ ...current, [questionIndex]: next }))
                    }} aria-pressed={selected || correct}>{letter}</button>
                  })}
                </div>)}
              </div>
              <aside className="word-search-progress" aria-label="Progreso de palabras">
                <header><span className="word-search-progress-icon"><Search size={16} /></span><strong>Palabras</strong><span className="word-search-progress-count">{currentFoundWords.length}/{currentWordSearch.words.length}</span></header>
                <div className="word-search-progress-track" role="progressbar" aria-label="Palabras encontradas" aria-valuemin={0} aria-valuemax={currentWordSearch.words.length} aria-valuenow={currentFoundWords.length}><span style={{ width: `${(currentFoundWords.length / currentWordSearch.words.length) * 100}%` }} /></div>
                <p>{currentFoundWords.length === currentWordSearch.words.length ? '¡Encontraste todas!' : `Faltan ${currentWordSearch.words.length - currentFoundWords.length} palabras`}</p>
                <ol>{currentWordSearch.words.map(word => {
                  const found = currentFoundWords.includes(word)
                  return <li key={word} className={found ? 'found' : ''}>{found ? <Check size={14} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}<span>{word}</span></li>
                })}</ol>
                <div className="word-search-controls"><button className="word-search-hint" type="button" onClick={() => {
                  const nextWord = currentWordSearch.words.find(word => !currentFoundWords.includes(word))
                  const path = nextWord ? findWordPath(rows, nextWord) : null
                  if (path) { setHintedCells(current => ({ ...current, [questionIndex]: path[0] })); setHintsUsed(current => Math.min(3, current + 1)) }
                }} disabled={hintsUsed >= 3 || currentFoundWords.length === currentWordSearch.words.length}><Lightbulb size={15} aria-hidden="true" />Pistas {3 - hintsUsed}/3</button><button className="word-search-reset" type="button" onClick={() => setWordSelections(current => ({ ...current, [questionIndex]: [] }))} disabled={(wordSelections[questionIndex] ?? []).length === 0}><RotateCcw size={15} aria-hidden="true" />Limpiar</button></div>
              </aside>
            </div>
          </>}
        </article>
      </div>
    </div>
  </section>
}
