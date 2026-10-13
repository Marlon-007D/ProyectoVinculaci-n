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
  audience?: 'staff' | 'student'
}

const choices: Array<{ value: QuestionType; label: string }> = [
  { value: 'text', label: 'Texto corto' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'single_select', label: 'Selección única' },
  { value: 'multi_select', label: 'Selección múltiple' },
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
  readOnly = false,
}: {
  question: FormQuestion
  value: FormAnswerValue
  onChange: (value: FormAnswerValue) => void
  student: Student
  readOnly?: boolean
}) {
  const fixedValue = question.is_system ? getSystemValue(question, student) : undefined
  if (question.data_type === 'boolean') {
    return <label className="field"><span>{question.label}{question.is_required && <i> *</i>}</span>
      <select className="form-select" value={value === null ? '' : String(value)} disabled={question.is_system || readOnly}
        required={question.is_required} onChange={event => onChange(event.target.value === '' ? null : event.target.value === 'true')}>
        <option value="">Seleccionar</option><option value="true">Sí</option><option value="false">No</option>
      </select>
    </label>
  }

  if (question.data_type === 'single_select') {
    return <label className="field"><span>{question.label}{question.is_required && <i> *</i>}</span>
      <select className="form-select" value={String(value ?? '')} disabled={question.is_system || readOnly}
        required={question.is_required} onChange={event => onChange(event.target.value || null)}>
        <option value="">Seleccionar</option>{question.form_question_options.map(option => <option key={option.question_option_id} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  }

  if (question.data_type === 'multi_select') {
    const selected = Array.isArray(value) ? value : []
    return <fieldset className="check-group"><legend>{question.label}{question.is_required && <i> *</i>}</legend><div>
      {question.form_question_options.map(option => <label key={option.question_option_id}>
        <input className="form-check-input" type="checkbox" disabled={question.is_system || readOnly} checked={selected.includes(option.value)}
          onChange={event => onChange(event.target.checked ? [...selected, option.value] : selected.filter(item => item !== option.value))} /> {option.label}
      </label>)}
    </div></fieldset>
  }

  const inputType = question.data_type === 'date' ? 'date' : question.data_type === 'number' ? 'number' : 'text'
  return <label className="field"><span>{question.label}{question.is_required && <i> *</i>}</span>
    {question.data_type === 'textarea' ? (
      <textarea className="form-control" value={question.is_system ? fixedValue : String(value ?? '')}
        disabled={question.is_system || readOnly} required={question.is_required} onChange={event => onChange(event.target.value)} />
    ) : (
      <input className="form-control" type={inputType} value={question.is_system ? fixedValue : String(value ?? '')}
        disabled={question.is_system || readOnly} required={question.is_required} onChange={event => onChange(
          question.data_type === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value,
        )} />
    )}
  </label>
}

export default function ConfigurableForm({ integration, student, code, section, onSectionsChange, audience = 'staff' }: Props) {
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
  const [questionOptions, setQuestionOptions] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

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
    const loadingForm = audience === 'staff'
      ? service.ensureStandardForms(integration.institutionId).then(() => service.loadForm(integration.institutionId, code, studentId, true))
      : service.loadForm(integration.institutionId, code, studentId, false)
    void loadingForm
      .then(data => {
        if (!active) return
        setRuntime(data)
        setAnswers(data.answers)
        setError('')
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la ficha.') })
    return () => { active = false }
  }, [audience, code, integration.institutionId, reloadToken, service, studentId])

  const sections = useMemo(() => {
    const names = Array.from(new Set((runtime?.questions ?? []).map(question => question.display_config?.section || 'Información')))
    return names.length ? names : ['Información']
  }, [runtime?.questions])

  useEffect(() => { onSectionsChange(sections) }, [onSectionsChange, sections])

  if (error) return <div className="notice sensitive" role="alert">{error}</div>
  if (!runtime) return <p className="helper" role="status">Cargando ficha…</p>

  const currentSection = sections[section] ?? sections[0]
  const locked = runtime.submission?.status === 'submitted' || runtime.submission?.status === 'reviewed'
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
      const code = `custom_${crypto.randomUUID()}`
      const result = await service.addQuestion(runtime.versionId, {
        code,
        label: questionLabel.trim(),
        help_text: null,
        data_type: questionType,
        is_required: false,
        display_config: { section: questionSection.trim() || 'Datos adicionales' },
      }, ['single_select', 'multi_select'].includes(questionType) ? questionOptions.split('\n') : [])
      const newQuestion: FormQuestion = {
        form_question_id: result.id, form_version_id: runtime.versionId, code,
        label: questionLabel.trim(), help_text: null, data_type: questionType, source_field: null,
        is_required: false, is_system: false, position: runtime.questions.length + 1,
        display_config: { section: questionSection.trim() || 'Datos adicionales' }, form_question_options: result.options,
      }
      setRuntime({ ...runtime, questions: [...runtime.questions, newQuestion] })
      setAnswers({ ...answers, [result.id]: null })
      setQuestionLabel('')
      setQuestionOptions('')
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
    <div className="d-flex justify-content-end mb-2"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setReloadToken(value => value + 1)}>Actualizar preguntas</button></div>
    {runtime.status === 'draft' && <div className="notice">Estás editando una versión borrador de esta ficha.</div>}
    {code === 'authorization' && <div className="notice sensitive">Ficha confidencial. La información debe ser conocida únicamente por el equipo de salud escolar para apoyar la atención del estudiante y responder ante emergencias.</div>}
    {code === 'general' && <div className="notice">El representante legal debe mantener comunicación regular con la institución sobre novedades académicas e inasistencias.</div>}
    {questions.length === 0 && <p className="helper" role="status">No hay preguntas visibles en esta sección. Puede faltar permiso o la publicación de preguntas por DECE; actualiza la ficha o consulta al equipo.</p>}
    <div className="field-grid">
      {questions.map(question => <div className="custom-question" key={question.form_question_id}>
        <QuestionInput question={question} student={student} readOnly={locked} value={answers[question.form_question_id] ?? null}
          onChange={value => setAnswers(current => ({ ...current, [question.form_question_id]: value }))} />
        {audience === 'staff' && !question.is_system && <button type="button" className="text-button" onClick={() => void removeQuestion(question)}>Quitar pregunta</button>}
      </div>)}
    </div>
    {audience === 'staff' && (adding ? <form className="question-builder" onSubmit={event => void addQuestion(event)}>
      <label className="field"><span>Pregunta</span><input className="form-control" autoFocus required value={questionLabel} onChange={event => setQuestionLabel(event.target.value)} /></label>
      <label className="field"><span>Tipo de respuesta</span><select className="form-select" value={questionType} onChange={event => setQuestionType(event.target.value as QuestionType)}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
      {['single_select', 'multi_select'].includes(questionType) && <label className="field"><span>Opciones (una por línea)</span><textarea className="form-control" required value={questionOptions} onChange={event => setQuestionOptions(event.target.value)} /></label>}
      <label className="field"><span>Sección</span><input className="form-control" value={questionSection} onChange={event => setQuestionSection(event.target.value)} /></label>
      <button className="button btn primary" type="submit">Agregar pregunta</button>
      <button className="button btn secondary" type="button" onClick={() => setAdding(false)}>Cancelar</button>
    </form> : <button className="button btn secondary" type="button" onClick={() => setAdding(true)}>+ Agregar pregunta</button>)}
    {!locked && <div className="form-actions">
      <span className="save-message" role="status">{message}</span>
      <button className="button btn primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar borrador'}</button>
      {audience === 'student' && <button className="button btn secondary" type="button" disabled={saving || runtime.submission?.status !== 'draft'} onClick={() => void (async () => {
        if (!runtime.submission) { setMessage('Guarda el borrador antes de enviarlo.'); return }
        setSaving(true)
        try {
          await service.submit(runtime.submission.form_submission_id)
          setRuntime(current => current ? { ...current, submission: { ...current.submission!, status: 'submitted' } } : current)
          setMessage('Ficha enviada correctamente.')
        } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo enviar la ficha.') }
        finally { setSaving(false) }
      })()}>{saving ? 'Enviando…' : 'Enviar ficha'}</button>}
    </div>}
    {locked && <p role="status" className="save-message">Esta ficha ya fue enviada y no se puede editar.</p>}
    {audience === 'staff' && runtime.submission?.status === 'submitted' && <button className="button btn primary" type="button" onClick={() => void (async () => {
      setSaving(true)
      try {
        await service.markReviewed(runtime.submission!.form_submission_id)
        setRuntime(current => current ? { ...current, submission: { ...current.submission!, status: 'reviewed' } } : current)
        setMessage('Ficha marcada como revisada.')
      } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo marcar la ficha como revisada.') }
      finally { setSaving(false) }
    })()} disabled={saving}>Marcar como revisada</button>}
  </>
}
