import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createDeceFormService, getQuestionValidation, validateFormAnswers, type FormAnswerValue, type FormQuestion, type FormRuntime, type QuestionType, type QuestionValidation } from '../../services/form-service'
import type { DeceDataIntegration } from '../../services/dece-data-context'
import type { Student } from '../../types/student'

type Props = {
  integration: DeceDataIntegration
  student: Student
  code: string
  section: number
  onSectionsChange: (sections: string[]) => void
  audience?: 'staff' | 'student'
  allowQuestionManagement?: boolean
  submissionId?: string
  readOnly?: boolean
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

function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error) return cause.message
  if (cause && typeof cause === 'object') {
    const error = cause as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    const message = typeof error.message === 'string' ? error.message : fallback
    const code = typeof error.code === 'string' ? ` (${error.code})` : ''
    const details = typeof error.details === 'string' ? ` ${error.details}` : ''
    const hint = typeof error.hint === 'string' ? ` ${error.hint}` : ''
    return `${message}${code}${details}${hint}`
  }
  return fallback
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
  const validation = getQuestionValidation(question)
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

  const inputType = question.data_type === 'date' ? 'date' : question.data_type === 'number' ? 'number' : validation.format === 'phone' ? 'tel' : validation.format === 'email' ? 'email' : 'text'
  const pattern = validation.format === 'phone' ? '[+()0-9\\s-]+' : validation.format === 'email' ? '[^\\s@]+@[^\\s@]+\\.[^\\s@]+' : validation.format === 'national_id' ? '[0-9]{10}' : undefined
  return <label className="field"><span>{question.label}{question.is_required && <i> *</i>}</span>
    {question.data_type === 'textarea' ? (
      <textarea className="form-control" value={question.is_system ? fixedValue : String(value ?? '')}
        disabled={question.is_system || readOnly} required={question.is_required} onChange={event => onChange(event.target.value)} />
    ) : (
      <input className="form-control" type={inputType} value={question.is_system ? fixedValue : String(value ?? '')}
        min={question.data_type === 'number' ? validation.min : undefined} max={question.data_type === 'number' ? validation.max : undefined}
        step={question.data_type === 'number' && validation.integer ? 1 : undefined}
        minLength={validation.format === 'national_id' ? 10 : undefined} maxLength={validation.format === 'national_id' ? 10 : undefined}
        pattern={pattern} title={validation.format === 'phone' ? 'Ingresa un teléfono de 7 a 15 dígitos.' : validation.format === 'national_id' ? 'Ingresa 10 dígitos.' : undefined}
        inputMode={validation.format === 'phone' || validation.format === 'national_id' ? 'numeric' : undefined}
        disabled={question.is_system || readOnly} required={question.is_required} onChange={event => onChange(
          question.data_type === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value,
        )} />
    )}
  </label>
}

export default function ConfigurableForm({ integration, student, code, section, onSectionsChange, audience = 'staff', allowQuestionManagement = true, submissionId, readOnly = false }: Props) {
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
  const [questionRequired, setQuestionRequired] = useState(false)
  const [questionFormat, setQuestionFormat] = useState<QuestionValidation['format'] | ''>('')
  const [questionMin, setQuestionMin] = useState('')
  const [questionMax, setQuestionMax] = useState('')
  const [questionInteger, setQuestionInteger] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [questionPage, setQuestionPage] = useState(1)
  const QUESTIONS_PER_PAGE = 8
  useEffect(() => { setQuestionPage(1) }, [section])

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
    const loadingForm = submissionId
      ? service.loadSubmission(submissionId, studentId)
      : audience === 'staff'
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
  }, [audience, code, integration.institutionId, reloadToken, service, studentId, submissionId])

  const sections = useMemo(() => {
    const names = Array.from(new Set((runtime?.questions ?? []).map(question => question.display_config?.section || 'Información')))
    return names.length ? names : ['Información']
  }, [runtime?.questions])

  useEffect(() => { onSectionsChange(sections) }, [onSectionsChange, sections])

  if (error) return <div className="notice sensitive" role="alert">{error}</div>
  if (!runtime) return <p className="helper" role="status">Cargando ficha…</p>

  const currentSection = sections[section] ?? sections[0]
  const locked = readOnly || runtime.submission?.status === 'submitted' || runtime.submission?.status === 'reviewed'
  const questions = runtime.questions.filter(question => (audience === 'staff' && submissionId ? true : question.is_active !== false) && (question.display_config?.section || 'Información') === currentSection)
  const questionPageCount = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE))
  const visibleQuestions = questions.slice((questionPage - 1) * QUESTIONS_PER_PAGE, questionPage * QUESTIONS_PER_PAGE)

  async function save() {
    if (!studentId || !runtime || readOnly) return
    const validationError = validateFormAnswers(runtime.questions.filter(question => question.is_active !== false), answers)
    if (validationError) {
      setMessage(validationError)
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const savedSubmissionId = await service.saveDraft(
        studentId, runtime.versionId, runtime.submission?.form_submission_id ?? null, answers, runtime.questions,
      )
      const refreshed = await service.loadSubmission(savedSubmissionId, studentId)
      setRuntime(refreshed)
      setAnswers(refreshed.answers)
      setMessage('Borrador guardado en la base de datos.')
    } catch (cause) {
      setMessage(errorMessage(cause, 'No se pudo guardar el borrador.'))
    } finally {
      setSaving(false)
    }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!runtime || !questionLabel.trim()) return
    try {
      if (questionMin !== '' && questionMax !== '' && Number(questionMin) > Number(questionMax)) {
        setMessage('El valor mínimo no puede ser mayor que el máximo.')
        return
      }
      const code = `custom_${crypto.randomUUID()}`
      const displayConfig = {
        section: questionSection.trim() || 'Datos adicionales',
        validation: {
          ...(questionType === 'text' && questionFormat ? { format: questionFormat } : {}),
          ...(questionType === 'number' && questionMin !== '' ? { min: Number(questionMin) } : {}),
          ...(questionType === 'number' && questionMax !== '' ? { max: Number(questionMax) } : {}),
          ...(questionType === 'number' && questionInteger ? { integer: true } : {}),
        },
      }
      const result = await service.addQuestion(runtime.versionId, {
        code,
        label: questionLabel.trim(),
        help_text: null,
        data_type: questionType,
        is_required: questionRequired,
        display_config: displayConfig,
      }, ['single_select', 'multi_select'].includes(questionType) ? questionOptions.split('\n') : [])
      const newQuestion: FormQuestion = {
        form_question_id: result.id, form_version_id: runtime.versionId, code,
        label: questionLabel.trim(), help_text: null, data_type: questionType, source_field: null,
        is_required: questionRequired, is_system: false, position: runtime.questions.length + 1,
        display_config: displayConfig, form_question_options: result.options,
      }
      setRuntime({ ...runtime, questions: [...runtime.questions, newQuestion] })
      setAnswers({ ...answers, [result.id]: null })
      setQuestionLabel('')
      setQuestionOptions('')
      setQuestionRequired(false)
      setQuestionFormat('')
      setQuestionMin('')
      setQuestionMax('')
      setQuestionInteger(false)
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
      {visibleQuestions.map(question => <div className="custom-question" key={question.form_question_id}>
        <QuestionInput question={question} student={student} readOnly={locked} value={answers[question.form_question_id] ?? null}
          onChange={value => setAnswers(current => ({ ...current, [question.form_question_id]: value }))} />
        {audience === 'staff' && allowQuestionManagement && !question.is_system && <button type="button" className="text-button" onClick={() => void removeQuestion(question)}>Quitar pregunta</button>}
      </div>)}
    </div>
    {questions.length > QUESTIONS_PER_PAGE && <nav aria-label="Paginación de preguntas" className="d-flex align-items-center justify-content-between gap-2 py-3"><button type="button" className="btn btn-outline-secondary btn-sm" disabled={questionPage <= 1} onClick={() => setQuestionPage(page => page - 1)}>Anterior</button><span>Página {questionPage} de {questionPageCount}</span><button type="button" className="btn btn-outline-secondary btn-sm" disabled={questionPage >= questionPageCount} onClick={() => setQuestionPage(page => page + 1)}>Siguiente</button></nav>}
    {audience === 'staff' && allowQuestionManagement && (adding ? <form className="question-builder" onSubmit={event => void addQuestion(event)}>
      <label className="field"><span>Pregunta</span><input className="form-control" autoFocus required value={questionLabel} onChange={event => setQuestionLabel(event.target.value)} /></label>
      <label className="field"><span>Tipo de respuesta</span><select className="form-select" value={questionType} onChange={event => setQuestionType(event.target.value as QuestionType)}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
      {['single_select', 'multi_select'].includes(questionType) && <label className="field"><span>Opciones (una por línea)</span><textarea className="form-control" required value={questionOptions} onChange={event => setQuestionOptions(event.target.value)} /></label>}
      <label className="field"><span>Sección</span><input className="form-control" value={questionSection} onChange={event => setQuestionSection(event.target.value)} /></label>
      <label className="field"><span><input className="form-check-input me-2" type="checkbox" checked={questionRequired} onChange={event => setQuestionRequired(event.target.checked)} />Respuesta obligatoria</span></label>
      {questionType === 'text' && <label className="field"><span>Validación del dato</span><select className="form-select" value={questionFormat} onChange={event => setQuestionFormat(event.target.value as QuestionValidation['format'] | '')}><option value="">Sin restricción</option><option value="phone">Teléfono</option><option value="email">Correo electrónico</option><option value="national_id">Cédula (10 dígitos)</option></select></label>}
      {questionType === 'number' && <><div className="d-flex gap-2"><label className="field"><span>Valor mínimo</span><input className="form-control" type="number" value={questionMin} onChange={event => setQuestionMin(event.target.value)} /></label><label className="field"><span>Valor máximo</span><input className="form-control" type="number" value={questionMax} onChange={event => setQuestionMax(event.target.value)} /></label></div><label className="field"><span><input className="form-check-input me-2" type="checkbox" checked={questionInteger} onChange={event => setQuestionInteger(event.target.checked)} />Solo números enteros</span></label></>}
      <button className="button btn primary" type="submit">Agregar pregunta</button>
      <button className="button btn secondary" type="button" onClick={() => setAdding(false)}>Cancelar</button>
    </form> : <button className="button btn secondary" type="button" onClick={() => setAdding(true)}>+ Agregar pregunta</button>)}
    {!locked && <div className="form-actions">
      <span className="save-message" role="status">{message}</span>
      <button className="button btn primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar borrador'}</button>
      {audience === 'student' && <button className="button btn secondary" type="button" disabled={saving || runtime.submission?.status !== 'draft'} onClick={() => void (async () => {
        if (!runtime.submission || !studentId) { setMessage('Guarda el borrador antes de enviarlo.'); return }
        setSaving(true)
        try {
          await service.submit(runtime.submission.form_submission_id)
          const refreshed = await service.loadSubmission(runtime.submission.form_submission_id, studentId)
          setRuntime(refreshed)
          setAnswers(refreshed.answers)
          setMessage('Ficha enviada correctamente.')
        } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo enviar la ficha.') }
        finally { setSaving(false) }
      })()}>{saving ? 'Enviando…' : 'Enviar ficha'}</button>}
    </div>}
    {audience === 'student' && locked && <p role="status" className="save-message">Para corregir esta ficha, comunícate con el DECE.</p>}
    {locked && <p role="status" className="save-message">Esta ficha ya fue enviada y no se puede editar.</p>}
    {audience === 'staff' && !readOnly && runtime.submission?.status === 'submitted' && <button className="button btn primary" type="button" onClick={() => void (async () => {
      setSaving(true)
      try {
        await service.markReviewed(runtime.submission!.form_submission_id)
        const refreshed = await service.loadSubmission(runtime.submission!.form_submission_id, studentId!)
        setRuntime(refreshed)
        setAnswers(refreshed.answers)
        setMessage('Ficha marcada como revisada.')
      } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo marcar la ficha como revisada.') }
      finally { setSaving(false) }
    })()} disabled={saving}>Marcar como revisada</button>}
  </>
}
