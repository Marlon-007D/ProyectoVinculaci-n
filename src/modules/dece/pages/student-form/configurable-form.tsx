import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createDeceFormService, type FormAnswerValue, type FormQuestion, type FormRuntime, type QuestionType } from '../../services/form-service'
import type { DeceDataIntegration } from '../../services/dece-data-context'
import type { Student } from '../../types/student'

type Props = {
  integration: DeceDataIntegration
  student: Student
  code: 'general' | 'authorization'
  section: number
  onSectionsChange: (sections: string[]) => void
}

const choices: Array<{ value: QuestionType; label: string }> = [
  { value: 'text', label: 'Texto corto' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí / No' },
]

function getSystemValue(question: FormQuestion, student: Student) {
  switch (question.source_field) {
    case 'students.first_name': return student.name
    case 'students.grade_level': return student.grade
    case 'students.national_id': return student.id
    default: return ''
  }
}

function QuestionInput({
  question,
  value,
  onChange,
  student,
}: {
  question: FormQuestion
  value: FormAnswerValue
  onChange: (value: FormAnswerValue) => void
  student: Student
}) {
  const fixedValue = question.is_system ? getSystemValue(question, student) : undefined
  if (question.data_type === 'boolean') {
    return <label className="field"><span>{question.label}{question.is_required && <i> *</i>}</span>
      <select className="form-select" value={value === null ? '' : String(value)} disabled={question.is_system}
        required={question.is_required} onChange={event => onChange(event.target.value === '' ? null : event.target.value === 'true')}>
        <option value="">Seleccionar</option><option value="true">Sí</option><option value="false">No</option>
      </select>
    </label>
  }

  if (question.data_type === 'single_select') {
    return <label className="field"><span>{question.label}{question.is_required && <i> *</i>}</span>
      <select className="form-select" value={String(value ?? '')} disabled={question.is_system}
        required={question.is_required} onChange={event => onChange(event.target.value || null)}>
        <option value="">Seleccionar</option>{question.form_question_options.map(option => <option key={option.question_option_id} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  }

  if (question.data_type === 'multi_select') {
    const selected = Array.isArray(value) ? value : []
    return <fieldset className="check-group"><legend>{question.label}{question.is_required && <i> *</i>}</legend><div>
      {question.form_question_options.map(option => <label key={option.question_option_id}>
        <input className="form-check-input" type="checkbox" disabled={question.is_system} checked={selected.includes(option.value)}
          onChange={event => onChange(event.target.checked ? [...selected, option.value] : selected.filter(item => item !== option.value))} /> {option.label}
      </label>)}
    </div></fieldset>
  }

  const inputType = question.data_type === 'date' ? 'date' : question.data_type === 'number' ? 'number' : 'text'
  return <label className="field"><span>{question.label}{question.is_required && <i> *</i>}</span>
    {question.data_type === 'textarea' ? (
      <textarea className="form-control" value={question.is_system ? fixedValue : String(value ?? '')}
        disabled={question.is_system} required={question.is_required} onChange={event => onChange(event.target.value)} />
    ) : (
      <input className="form-control" type={inputType} value={question.is_system ? fixedValue : String(value ?? '')}
        disabled={question.is_system} required={question.is_required} onChange={event => onChange(
          question.data_type === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value,
        )} />
    )}
  </label>
}

export default function ConfigurableForm({ integration, student, code, section, onSectionsChange }: Props) {
  const service = useMemo(() => createDeceFormService(integration.client), [integration.client])
  const [runtime, setRuntime] = useState<FormRuntime | null>(null)
  const [answers, setAnswers] = useState<Record<string, FormAnswerValue>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [questionLabel, setQuestionLabel] = useState('')
  const [questionType, setQuestionType] = useState<QuestionType>('text')
  const [questionSection, setQuestionSection] = useState('Datos adicionales')

  const studentId = integration.getStudentId(student)

  useEffect(() => {
    let active = true
    setRuntime(null)
    setAnswers({})
    setError('')
    setMessage('')
    if (!studentId) {
      setError('No se encontró el UUID de este estudiante. El módulo de estudiantes debe proporcionar su ID de base de datos.')
      return () => { active = false }
    }
    void service.loadForm(integration.institutionId, code, studentId)
      .then(data => {
        if (!active) return
        setRuntime(data)
        setAnswers(data.answers)
        setError('')
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la ficha.') })
    return () => { active = false }
  }, [code, integration.institutionId, service, studentId])

  const sections = useMemo(() => {
    const names = Array.from(new Set((runtime?.questions ?? []).map(question => question.display_config?.section || 'Información')))
    return names.length ? names : ['Información']
  }, [runtime?.questions])

  useEffect(() => { onSectionsChange(sections) }, [onSectionsChange, sections])

  if (error) return <div className="notice sensitive" role="alert">{error}</div>
  if (!runtime) return <p className="helper" role="status">Cargando ficha…</p>

  const currentSection = sections[section] ?? sections[0]
  const questions = runtime.questions.filter(question => (question.display_config?.section || 'Información') === currentSection)

  async function save() {
    if (!studentId || !runtime) return
    const missingQuestion = runtime.questions.find(question => {
      if (question.is_system || !question.is_required) return false
      const value = answers[question.form_question_id]
      return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
    })
    if (missingQuestion) {
      setMessage(`Completa el campo requerido: ${missingQuestion.label}`)
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const submissionId = await service.saveDraft(
        studentId, runtime.versionId, runtime.submission?.form_submission_id ?? null, answers, runtime.questions,
      )
      setRuntime({ ...runtime, submission: { form_submission_id: submissionId, form_version_id: runtime.versionId, status: 'draft' } })
      setMessage('Borrador guardado en la base de datos.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar el borrador.')
    } finally {
      setSaving(false)
    }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!runtime || !questionLabel.trim()) return
    try {
      const id = await service.addQuestion(runtime.versionId, {
        code: `custom_${crypto.randomUUID()}`,
        label: questionLabel.trim(),
        help_text: null,
        data_type: questionType,
        is_required: false,
        display_config: { section: questionSection.trim() || 'Datos adicionales' },
      })
      const newQuestion: FormQuestion = {
        form_question_id: id, form_version_id: runtime.versionId, code: `custom_${id}`,
        label: questionLabel.trim(), help_text: null, data_type: questionType, source_field: null,
        is_required: false, is_system: false, position: runtime.questions.length + 1,
        display_config: { section: questionSection.trim() || 'Datos adicionales' }, form_question_options: [],
      }
      setRuntime({ ...runtime, questions: [...runtime.questions, newQuestion] })
      setAnswers({ ...answers, [id]: null })
      setQuestionLabel('')
      setAdding(false)
      setMessage('Pregunta añadida.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo añadir la pregunta.')
    }
  }

  async function removeQuestion(question: FormQuestion) {
    if (!runtime || question.is_system) return
    try {
      await service.removeQuestion(runtime.versionId, question.form_question_id)
      setRuntime({ ...runtime, questions: runtime.questions.filter(item => item.form_question_id !== question.form_question_id) })
      const nextAnswers = { ...answers }
      delete nextAnswers[question.form_question_id]
      setAnswers(nextAnswers)
      setMessage('Pregunta retirada de la ficha. Las respuestas históricas se conservan.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo retirar la pregunta.')
    }
  }

  return <>
    {runtime.status === 'draft' && <div className="notice">Estás editando una versión borrador de esta ficha.</div>}
    {questions.length === 0 && <p className="helper">Esta sección aún no tiene preguntas.</p>}
    <div className="field-grid">
      {questions.map(question => <div className="custom-question" key={question.form_question_id}>
        <QuestionInput question={question} student={student} value={answers[question.form_question_id] ?? null}
          onChange={value => setAnswers(current => ({ ...current, [question.form_question_id]: value }))} />
        {!question.is_system && <button type="button" className="text-button" onClick={() => void removeQuestion(question)}>Quitar pregunta</button>}
      </div>)}
    </div>
    {adding ? <form className="question-builder" onSubmit={event => void addQuestion(event)}>
      <label className="field"><span>Pregunta</span><input className="form-control" autoFocus required value={questionLabel} onChange={event => setQuestionLabel(event.target.value)} /></label>
      <label className="field"><span>Tipo de respuesta</span><select className="form-select" value={questionType} onChange={event => setQuestionType(event.target.value as QuestionType)}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
      <label className="field"><span>Sección</span><input className="form-control" value={questionSection} onChange={event => setQuestionSection(event.target.value)} /></label>
      <button className="button btn primary" type="submit">Agregar pregunta</button>
      <button className="button btn secondary" type="button" onClick={() => setAdding(false)}>Cancelar</button>
    </form> : <button className="button btn secondary" type="button" onClick={() => setAdding(true)}>+ Agregar pregunta</button>}
    <div className="form-actions">
      <span className="save-message" role="status">{message}</span>
      <button className="button btn primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar borrador'}</button>
    </div>
  </>
}
