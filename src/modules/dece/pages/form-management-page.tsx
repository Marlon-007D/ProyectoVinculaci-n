import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { createDeceFormService, type FormQuestion, type QuestionType, type QuestionValidation } from '../services/form-service'
import { useDeceData } from '../services/dece-data-context'

type Template = { id: string; code: string; name: string; versionId: string | null }
const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: 'text', label: 'Texto corto' }, { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Número' }, { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí / No' }, { value: 'single_select', label: 'Selección única' },
  { value: 'multi_select', label: 'Selección múltiple' },
]

export default function FormManagementPage() {
  const integration = useDeceData()
  const service = useMemo(() => integration ? createDeceFormService(integration.client) : null, [integration?.client])
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [questions, setQuestions] = useState<FormQuestion[]>([])
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [section, setSection] = useState('Información')
  const [type, setType] = useState<QuestionType>('text')
  const [required, setRequired] = useState(false)
  const [format, setFormat] = useState<QuestionValidation['format'] | ''>('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [integer, setInteger] = useState(false)
  const [options, setOptions] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = templates.find(template => template.id === selectedId)

  async function refresh() {
    if (!integration || !service) return
    const rows = await service.listFormTemplates(integration.institutionId) as Template[]
    setTemplates(rows)
    if (!rows.some(template => template.id === selectedId)) setSelectedId(rows[0]?.id ?? '')
  }

  useEffect(() => { void refresh().catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las fichas.')) }, [service, integration?.institutionId])

  useEffect(() => {
    let active = true
    const template = templates.find(item => item.id === selectedId)
    if (!integration || !template?.versionId) { setQuestions([]); return () => { active = false } }
    void integration.client.from('form_questions')
      .select('form_question_id, form_version_id, code, label, help_text, data_type, source_field, is_required, is_system, position, display_config, form_question_options(question_option_id, value, label, position)')
      .eq('form_version_id', template.versionId).eq('is_active', true).order('position')
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(queryError.message)
        else setQuestions((data ?? []) as FormQuestion[])
      })
    return () => { active = false }
  }, [integration, selectedId, templates])

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!integration || !service || !name.trim()) return
    setBusy(true); setError('')
    try {
      const created = await service.createFormTemplate(integration.institutionId, name)
      await refresh()
      setSelectedId(created.id); setName('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear la plantilla.') }
    finally { setBusy(false) }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!service || !selected?.versionId || !label.trim()) return
    if (min !== '' && max !== '' && Number(min) > Number(max)) { setError('El valor mínimo no puede ser mayor que el máximo.'); return }
    setBusy(true); setError('')
    try {
      await service.addQuestion(selected.versionId, {
        code: `custom_${crypto.randomUUID()}`, label: label.trim(), help_text: null, data_type: type,
        is_required: required, display_config: {
          section: section.trim() || 'Información',
          validation: {
            ...(type === 'text' && format ? { format } : {}),
            ...(type === 'number' && min !== '' ? { min: Number(min) } : {}),
            ...(type === 'number' && max !== '' ? { max: Number(max) } : {}),
            ...(type === 'number' && integer ? { integer: true } : {}),
          },
        },
      }, ['single_select', 'multi_select'].includes(type) ? options.split('\n') : [])
      setLabel(''); setOptions(''); setRequired(false); setFormat(''); setMin(''); setMax(''); setInteger(false)
      const { data } = await integration!.client.from('form_questions')
        .select('form_question_id, form_version_id, code, label, help_text, data_type, source_field, is_required, is_system, position, display_config, form_question_options(question_option_id, value, label, position)')
        .eq('form_version_id', selected.versionId).eq('is_active', true).order('position')
      setQuestions((data ?? []) as FormQuestion[])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo agregar la pregunta.') }
    finally { setBusy(false) }
  }

  async function removeTemplate(template: Template) {
    if (!service) return
    const result = await Swal.fire({
      title: `¿Retirar “${template.name}”?`,
      html: '<p>La plantilla dejará de aparecer para completar. Las respuestas y envíos existentes se conservarán.</p><p>El botón se habilitará después de cinco segundos.</p>',
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#b42318',
      confirmButtonText: 'Espera 5 segundos…', cancelButtonText: 'Cancelar', allowOutsideClick: false,
      didOpen: () => {
        const button = Swal.getConfirmButton()
        if (!button) return
        button.disabled = true
        let remaining = 5
        const timer = window.setInterval(() => {
          remaining -= 1
          if (remaining <= 0) { window.clearInterval(timer); button.disabled = false; button.textContent = 'Retirar plantilla' }
          else button.textContent = `Espera ${remaining} segundos…`
        }, 1000)
      },
    })
    if (!result.isConfirmed) return
    setBusy(true); setError('')
    try { await service.deactivateFormTemplate(template.id); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo retirar la plantilla.') }
    finally { setBusy(false) }
  }

  async function resetDefaults() {
    if (!service || !integration) return
    const result = await Swal.fire({ title: 'Restablecer fichas base', text: 'Se restaurarán las preguntas predeterminadas de la ficha general y de autorización. Las respuestas guardadas se conservarán.', icon: 'question', showCancelButton: true, confirmButtonText: 'Restablecer', cancelButtonText: 'Cancelar' })
    if (!result.isConfirmed) return
    setBusy(true); setError('')
    try { await service.resetDefaultTemplates(integration.institutionId); await refresh(); setError('Fichas base restablecidas correctamente.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron restablecer las fichas base.') }
    finally { setBusy(false) }
  }

  async function removeQuestion(question: FormQuestion) {
    if (!service || !selected?.versionId || question.is_system) return
    setBusy(true); setError('')
    try {
      await service.removeQuestion(selected.versionId, question.form_question_id)
      setQuestions(current => current.filter(item => item.form_question_id !== question.form_question_id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo retirar la pregunta.') }
    finally { setBusy(false) }
  }

  return <div className="page-content container-fluid">
    <div className="eyebrow">CONFIGURACIÓN DECE</div>
    <div className="welcome-row"><div><h1>Plantillas de fichas</h1><p className="subheading">Crea fichas para tu institución y personaliza sus preguntas sin borrar envíos existentes.</p></div>
      <button type="button" className="button btn secondary" disabled={busy} onClick={() => void resetDefaults()}>Restablecer fichas por defecto</button></div>
    {error && <div className="notice" role="status">{error}</div>}
    <section className="table-card p-3 mb-4"><h2>Nueva ficha</h2><form className="d-flex gap-2" onSubmit={event => void createTemplate(event)}>
      <input className="form-control" aria-label="Nombre de la ficha" placeholder="Nombre de la ficha" required value={name} onChange={event => setName(event.target.value)} />
      <button className="button btn primary" disabled={busy}>Crear plantilla</button>
    </form></section>
    <section className="table-card p-3"><div className="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-3"><h2 className="m-0">Editar preguntas</h2>
      <select className="form-select" style={{ maxWidth: 380 }} aria-label="Seleccionar ficha" value={selectedId} onChange={event => setSelectedId(event.target.value)}>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
      {selected && !['general', 'authorization'].includes(selected.code) && <button className="btn btn-outline-danger" disabled={busy} onClick={() => void removeTemplate(selected)}>Retirar ficha</button>}
    </div>
    {!selected && <p>No hay plantillas activas.</p>}
    {selected && <><ul className="list-group mb-4">{questions.map(question => <li className="list-group-item d-flex justify-content-between align-items-center gap-2" key={question.form_question_id}><span><strong>{question.label}</strong><small className="d-block text-secondary">{question.display_config?.section ?? 'Información'}</small></span>{!question.is_system && <button className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => void removeQuestion(question)}>Retirar pregunta</button>}</li>)}</ul>
      <form className="row g-2" onSubmit={event => void addQuestion(event)}><div className="col-md-6"><input className="form-control" required placeholder="Texto de la pregunta" value={label} onChange={event => setLabel(event.target.value)} /></div>
        <div className="col-md-3"><select className="form-select" value={type} onChange={event => setType(event.target.value as QuestionType)}>{questionTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="col-md-3"><input className="form-control" placeholder="Sección" value={section} onChange={event => setSection(event.target.value)} /></div>
        <div className="col-md-4 form-check ms-2"><input id="question-required" className="form-check-input" type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} /><label className="form-check-label" htmlFor="question-required">Respuesta obligatoria</label></div>
        {type === 'text' && <div className="col-md-4"><label className="form-label" htmlFor="question-format">Validación del dato</label><select id="question-format" className="form-select" value={format} onChange={event => setFormat(event.target.value as QuestionValidation['format'] | '')}><option value="">Sin restricción</option><option value="phone">Teléfono</option><option value="email">Correo electrónico</option><option value="national_id">Cédula (10 dígitos)</option></select></div>}
        {type === 'number' && <><div className="col-md-4"><label className="form-label">Valor mínimo<input className="form-control" type="number" value={min} onChange={event => setMin(event.target.value)} /></label></div><div className="col-md-4"><label className="form-label">Valor máximo<input className="form-control" type="number" value={max} onChange={event => setMax(event.target.value)} /></label></div><div className="col-12 form-check ms-2"><input id="question-integer" className="form-check-input" type="checkbox" checked={integer} onChange={event => setInteger(event.target.checked)} /><label className="form-check-label" htmlFor="question-integer">Solo números enteros</label></div></>}
        {['single_select', 'multi_select'].includes(type) && <div className="col-12"><textarea className="form-control" required aria-label="Opciones, una por línea" placeholder="Opciones, una por línea" value={options} onChange={event => setOptions(event.target.value)} /></div>}
        <div className="col-12"><button className="button btn primary" disabled={busy}>Agregar pregunta</button></div>
      </form></>}
    </section>
  </div>
}
