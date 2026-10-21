import { useEffect, useState } from 'react'
import { Check, Circle, CircleHelp, Clock3, ListChecks, Search } from 'lucide-react'
import { getSchoolQuestionSet } from '../mocks/schoolQuestionMock'
import './QuestionBank.css'

interface Props { courseId: string; courseName: string; topicTitle: string; mode: 'entry' | 'assessment'; onEnter?: () => void; onExit?: () => void }
const LIMIT_SECONDS = 10 * 60
const QUESTION_COUNT = 10
const POINTS_PER_QUESTION = 20 / QUESTION_COUNT
type QuestionKind = 'multiple-choice' | 'multiple-select' | 'matching' | 'word-search'
const questionKinds: QuestionKind[] = ['multiple-choice', 'matching', 'word-search', 'multiple-select', 'multiple-choice', 'word-search', 'multiple-select', 'multiple-choice', 'multiple-select', 'multiple-select']

function occurrenceOfKind(index: number, kind: QuestionKind): number {
  return questionKinds.slice(0, index).filter(questionKind => questionKind === kind).length
}

function isCompleteWordPath(selection: number[], rows: string[][], word: string): boolean {
  if (selection.length !== word.length) return false
  const width = rows[0]?.length ?? 0
  const rowOf = (index: number) => Math.floor(index / width)
  const colOf = (index: number) => index % width
  const letters = selection.map(index => rows[rowOf(index)]?.[colOf(index)] ?? '').join('')
  const target = word.toUpperCase()
  if (letters !== target && letters !== [...target].reverse().join('')) return false
  const rowStep = selection.length > 1 ? rowOf(selection[1]) - rowOf(selection[0]) : 0
  const colStep = selection.length > 1 ? colOf(selection[1]) - colOf(selection[0]) : 0
  if (Math.abs(rowStep) > 1 || Math.abs(colStep) > 1 || (rowStep === 0 && colStep === 0)) return false
  return selection.every((index, position) => rowOf(index) === rowOf(selection[0]) + rowStep * position && colOf(index) === colOf(selection[0]) + colStep * position)
}

export function QuestionBank({ courseId, courseName, topicTitle, mode, onEnter = () => undefined, onExit = () => undefined }: Props) {
  const questions = getSchoolQuestionSet(courseId, topicTitle)
  const [started] = useState(mode === 'assessment')
  const [finished, setFinished] = useState(false)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(LIMIT_SECONDS)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [multiAnswers, setMultiAnswers] = useState<Record<number, number[]>>({})
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [connectionsByQuestion, setConnectionsByQuestion] = useState<Record<number, Record<number, string>>>({})
  const [foundWords, setFoundWords] = useState<Record<number, string[]>>({})
  const [foundWordPaths, setFoundWordPaths] = useState<Record<number, Record<string, number[]>>>({})
  const [wordSelections, setWordSelections] = useState<Record<number, number[]>>({})
  const currentKind = questionKinds[questionIndex]
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
      if (secondsLeft <= 1) { setSecondsLeft(0); setFinished(true) }
      else setSecondsLeft(secondsLeft - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [started, finished, secondsLeft])

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
  if (finished) return <section className="course-evaluations-panel" aria-labelledby="evaluation-result-title">
    <header className="question-bank-header"><span className="question-bank-icon"><Check size={22} /></span><div><span className="question-activity-course">{courseName} · {topicTitle}</span><h2 id="evaluation-result-title">Evaluación finalizada</h2><p>Tu resultado para este tema</p></div></header>
    <article className="question-card evaluation-result"><strong>{Number(score.toFixed(1))}<span> / 20</span></strong><p>{score >= 14 ? 'Aprobado' : 'Sigue practicando este tema.'}</p><button className="evaluation-button" type="button" onClick={onExit}>Volver al resumen</button></article>
  </section>

  if (mode === 'entry') return <section className="course-evaluations-panel" aria-labelledby="question-bank-title">
    <header className="question-bank-header"><span className="question-bank-icon"><CircleHelp size={22} /></span><div><h2 id="question-bank-title">Evaluaciones</h2><p>Comprueba lo aprendido en {topicTitle}.</p></div></header>
    <button className="question-bank-choice" type="button" onClick={onEnter}><span className="question-type-number"><ListChecks size={18} /></span><span className="question-bank-choice-copy"><strong>Entrar a evaluaciones</strong><small>{QUESTION_COUNT} preguntas · 10 minutos · calificación sobre 20</small></span><Clock3 size={19} /></button>
  </section>

  const prompt = currentKind === 'multiple-choice' ? currentMultipleChoice.prompt : currentKind === 'multiple-select' ? currentMultipleSelect.prompt : currentKind === 'matching' ? questions.matching.prompt : currentWordSearch.prompt
  return <section className="course-evaluations-panel" aria-label={`Evaluación de ${topicTitle}`}>
    <div className="evaluation-layout">
      <aside className="evaluation-rail" aria-label="Progreso de la evaluación">
        <div className={`evaluation-timer${secondsLeft <= 60 ? ' is-low' : ''}`}>
          <div className="evaluation-timer-label"><Clock3 size={16} /><span>{timeLabel}</span></div>
          <div className="evaluation-timer-track" role="progressbar" aria-label="Tiempo restante" aria-valuemin={0} aria-valuemax={LIMIT_SECONDS} aria-valuenow={secondsLeft}><span style={{ width: `${(secondsLeft / LIMIT_SECONDS) * 100}%` }} /></div>
        </div>
        <p>Pregunta {questionIndex + 1} de {QUESTION_COUNT}</p>
        <nav className="evaluation-question-list" aria-label="Ir a una pregunta">{questionKinds.map((_, index) => <button type="button" key={index} className={questionIndex === index ? 'current' : ''} onClick={() => { setQuestionIndex(index); setSelectedImage(null) }} aria-current={questionIndex === index ? 'step' : undefined} aria-label={`Ir a la pregunta ${index + 1}`}><span>{String(index + 1).padStart(2, '0')}</span></button>)}</nav>
        <div className="evaluation-navigation evaluation-rail-navigation">
          <button className="evaluation-button secondary" type="button" disabled={questionIndex === 0} onClick={() => { setQuestionIndex(index => Math.max(0, index - 1)); setSelectedImage(null) }}>Anterior</button>
          <button className="evaluation-button" type="button" onClick={() => { if (questionIndex === QUESTION_COUNT - 1) setFinished(true); else { setQuestionIndex(index => index + 1); setSelectedImage(null) } }}>{questionIndex === QUESTION_COUNT - 1 ? 'Finalizar' : 'Siguiente'}</button>
        </div>
      </aside>
      <div className="evaluation-question-area">
        <div className="evaluation-toolbar"><strong>Pregunta {questionIndex + 1}</strong><span>{currentKind === 'multiple-choice' ? 'Una respuesta' : currentKind === 'multiple-select' ? 'Varias respuestas' : currentKind === 'matching' ? 'Relacionar con fotografías' : 'Sopa de letras'}</span></div>
        <article className="question-card question-activity-card">
          <h3>{prompt}</h3>
          {currentKind === 'multiple-choice' && <div className="question-options">{currentMultipleChoice.options.map((option, index) => { const selected = answers[questionIndex] === index; return <button type="button" key={option} className={selected ? 'is-selected' : ''} onClick={() => setAnswers(current => ({ ...current, [questionIndex]: index }))} aria-pressed={selected}><span className="question-option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span></button> })}</div>}
          {currentKind === 'multiple-select' && <div className="question-options multiple-select-options" role="group" aria-label="Selecciona una o más opciones">{currentMultipleSelect.options.map((option, index) => { const selected = (multiAnswers[questionIndex] ?? []).includes(index); const image = currentMultipleSelect.optionImages[index]; return <label key={option} className={`multiple-select-option${selected ? ' is-selected' : ''}`}><input type="checkbox" checked={selected} onChange={() => setMultiAnswers(current => { const selectedOptions = current[questionIndex] ?? []; const next = selected ? selectedOptions.filter(item => item !== index) : [...selectedOptions, index]; return { ...current, [questionIndex]: next } })} /><img className="multiple-select-option-image" src={image.imageUrl} alt={image.imageAlt} loading="lazy" /><span className="question-option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span></label> })}</div>}
          {currentKind === 'matching' && <><div className="matching-board"><svg className="matching-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{Object.entries(connections).map(([sourceIndex, value]) => { const from = Number(sourceIndex); const to = questions.matching.options.indexOf(value); const y1 = ((from + .5) / questions.matching.pairs.length) * 100; const y2 = ((to + .5) / questions.matching.options.length) * 100; return <path key={`${from}-${value}`} className="matching-connection-path" d={`M 43 ${y1} C 47 ${y1}, 53 ${y2}, 57 ${y2}`} /> })}</svg><div className="matching-image-list">{questions.matching.pairs.map((pair, index) => <button type="button" key={pair.imageAlt} className={`matching-image-choice${selectedImage === index ? ' is-selected' : ''}${connections[index] ? ' is-connected' : ''}`} onClick={() => setSelectedImage(index)} aria-pressed={selectedImage === index} aria-label={`Imagen ${index + 1}: ${pair.imageAlt}`}><img src={pair.imageUrl} alt={pair.imageAlt} loading="lazy" /><span>Imagen {String.fromCharCode(65 + index)}</span><i aria-hidden="true" /></button>)}</div><div className="matching-answer-list">{questions.matching.options.map((option, index) => <button type="button" key={option} className={`matching-answer-choice${Object.values(connections).includes(option) ? ' is-connected' : ''}`} onClick={() => { if (selectedImage === null) return; setConnectionsByQuestion(current => ({ ...current, [questionIndex]: { ...(current[questionIndex] ?? {}), [selectedImage]: option } })); setSelectedImage(null) }} aria-label={`Respuesta ${index + 1}: ${option}`}><span>{String.fromCharCode(65 + index)}.</span><strong>{option}</strong><i aria-hidden="true" /></button>)}</div></div><p className="matching-instruction">{selectedImage === null ? 'Selecciona una imagen para comenzar a unir.' : `Imagen ${String.fromCharCode(65 + selectedImage)} seleccionada · ahora elige su respuesta.`}</p></>}
          {currentKind === 'word-search' && <>
            <div className="word-search-layout">
              <div className="word-search-grid" role="group" aria-label="Selecciona las letras de la sopa de letras">
                {rows.map((row, rowIndex) => <div className="word-search-row" key={`row-${rowIndex}`} style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                  {row.map((letter, colIndex) => {
                    const index = rowIndex * row.length + colIndex
                    const selected = (wordSelections[questionIndex] ?? []).includes(index)
                    const correct = correctWordCells.has(index)
                    return <button type="button" key={`${letter}-${index}`} aria-label={`Letra ${letter}, posición ${index + 1}${correct ? ', correcta' : ''}`} className={`${selected ? 'selected-letter' : ''}${correct ? ' is-correct-letter' : ''}`} style={correct ? { animationDelay: `${[...correctWordCells].indexOf(index) * 45}ms` } : undefined} onClick={() => {
                      if (correct) return
                      const currentSelection = wordSelections[questionIndex] ?? []
                      const next = selected ? currentSelection.filter(item => item !== index) : [...currentSelection, index]
                      const match = currentWordSearch.words.find(word => !currentFoundWords.includes(word) && isCompleteWordPath(next, rows, word))
                      if (match) {
                        setFoundWords(current => ({ ...current, [questionIndex]: [...(current[questionIndex] ?? []), match] }))
                        setFoundWordPaths(current => ({ ...current, [questionIndex]: { ...(current[questionIndex] ?? {}), [match]: next } }))
                        setWordSelections(current => ({ ...current, [questionIndex]: [] }))
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
              </aside>
            </div>
            <p className="word-search-feedback"><Search size={14} />Selecciona las letras de cada palabra en orden.</p>
          </>}
        </article>
      </div>
    </div>
  </section>
}
