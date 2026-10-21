import type { SupabaseClient } from '@supabase/supabase-js'
import type { FormQuestion } from './form-service'

type Institution = { institution_id: string; name: string }
type Student = { student_id: string; institution_id: string; first_name: string; last_name: string; national_id: string | null; grade_level: string | null; enrollment_number: string | null; birth_date: string | null }
type FormMeta = { form_definition_id: string; code: string; name: string }
type PdfContext = { institution: Institution; student: Student | null; generatedBy: string; title: string }
type DeceCase = { dece_case_id: string; institution_id: string; student_id: string; case_number: string; reason: string; primary_category: string; risk_level: string; confidentiality_level: string; status: string; opened_by: string | null; created_at: string }
type DeceVisit = { dece_visit_id: string; dece_case_id: string; visit_date: string; summary: string; attention_notes: string | null; attended_by: string | null }
type DeceAction = { dece_action_id: string; dece_case_id: string; description: string; due_date: string | null; is_completed: boolean; completed_at: string | null; responsible_profile_id: string | null }
type Observation = { dece_visit_id: string; category: string; description: string; severity: string; requires_follow_up: boolean }
type Submission = { form_submission_id: string; form_version_id: string; status: string; submitted_at: string | null; reviewed_at: string | null }
type Answer = { form_question_id: string; value_text: string | null; value_number: number | null; value_boolean: boolean | null; value_date: string | null; selected_option_id: string | null; form_answer_options: Array<{ question_option_id: string }> }
type PdfQuestion = FormQuestion & { is_active?: boolean }

const statuses: Record<string, string> = { registered: 'Registrado', in_progress: 'En atención', under_monitoring: 'En seguimiento', closed: 'Cerrado' }
const risks: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Crítico' }
const confidentiality: Record<string, string> = { restricted: 'Restringido', highly_restricted: 'Altamente restringido' }
const categories: Record<string, string> = { physical: 'Física', psychological: 'Psicológica', social: 'Social', family: 'Familiar', academic: 'Académica', behavioral: 'Conductual', other: 'Otra' }
const formStatuses: Record<string, string> = { draft: 'Borrador', submitted: 'Enviada', reviewed: 'Revisada' }

function check<T>(data: T | null, error: { code?: string; message?: string } | null, fallback: string): NonNullable<T> {
  if (error) throw new Error(error.code === '42501' ? 'No tienes permiso para consultar estos datos.' : fallback)
  if (data === null) throw new Error(fallback)
  return data as NonNullable<T>
}

function date(value?: string | null, withTime = false) {
  if (!value) return 'Sin registro'
  if (!withTime && /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}) }).format(parsed)
}

function profileName(profiles: Map<string, string>, id?: string | null) { return id ? profiles.get(id) ?? '' : '' }
function studentName(student: Student | null) { return student ? `${student.last_name} ${student.first_name}`.trim() : '' }
function sourceValue(sourceField: string | null, student: Student): unknown {
  const fields: Record<string, unknown> = {
    'students.student_id': student.student_id,
    'students.first_name': student.first_name,
    'students.last_name': student.last_name,
    'students.national_id': student.national_id,
    'students.grade_level': student.grade_level,
    'students.enrollment_number': student.enrollment_number,
    'students.birth_date': student.birth_date ? date(student.birth_date) : null,
  }
  return sourceField ? fields[sourceField] ?? null : null
}

async function loadContext(client: SupabaseClient, institutionId: string, studentId?: string | null): Promise<PdfContext> {
  const { data: institutionData, error: institutionError } = await client.from('institutions').select('institution_id,name').eq('institution_id', institutionId).maybeSingle()
  const institution = check(institutionData, institutionError, 'No se pudo cargar la institución activa.') as Institution
  let student: Student | null = null
  if (studentId) {
    const { data, error } = await client.from('students').select('student_id,institution_id,first_name,last_name,national_id,grade_level,enrollment_number,birth_date').eq('student_id', studentId).eq('institution_id', institutionId).maybeSingle()
    student = check(data, error, 'No se pudo cargar el estudiante de esta institución.')
  }
  return { institution, student, generatedBy: '', title: '' }
}

async function loadGeneratedBy(client: SupabaseClient, profileId?: string) {
  if (!profileId) return ''
  const { data, error } = await client.from('profiles').select('first_name,last_name').eq('profile_id', profileId).maybeSingle()
  if (error || !data) return ''
  return `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
}

async function pdfDoc(title: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', putOnlyUsedFonts: true })
  pdf.setProperties({ title, subject: 'Documento confidencial del Departamento de Consejería Estudiantil', creator: 'DECE' })
  pdf.setLanguage('es-EC')
  return pdf
}

function addHeader(pdf: import('jspdf').jsPDF, context: PdfContext, page: number, total: number) {
  const w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight()
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(0); pdf.text('CONFIDENCIAL', 15, 11)
  pdf.setFont('helvetica', 'normal'); pdf.text(context.institution.name, w - 15, 11, { align: 'right', maxWidth: 125 })
  pdf.setDrawColor(90); pdf.setLineWidth(.25); pdf.line(15, 14, w - 15, 14)
  pdf.line(15, h - 13, w - 15, h - 13); pdf.setFontSize(8); pdf.text(`Página ${page} de ${total}`, w - 15, h - 8, { align: 'right' })
}

function cover(pdf: import('jspdf').jsPDF, context: PdfContext, title: string) {
  const w = pdf.internal.pageSize.getWidth(); let y = 30
  pdf.setTextColor(0); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text(context.institution.name, w / 2, y, { align: 'center', maxWidth: w - 30 }); y += 10
  pdf.setFontSize(11); pdf.text('Departamento de Consejería Estudiantil', w / 2, y, { align: 'center' }); y += 16
  pdf.setFontSize(15); pdf.text(title, w / 2, y, { align: 'center', maxWidth: w - 30 }); y += 18
  if (context.student) {
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal')
    for (const [label, value] of [['Apellidos y nombres', studentName(context.student)], ['Cédula', context.student.national_id ?? ''], ['Año de EGB / grado', context.student.grade_level ?? ''], ['Matrícula', context.student.enrollment_number ?? '']]) {
      pdf.setFont('helvetica', 'bold'); pdf.text(`${label}:`, 20, y); pdf.setFont('helvetica', 'normal'); pdf.text(value || '________________________________', 65, y, { maxWidth: w - 85 }); y += 9
    }
  } else {
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal')
    for (const label of ['Apellidos y nombres', 'Cédula', 'Año de EGB / grado', 'Matrícula']) { pdf.text(`${label}:  ________________________________________________`, 20, y); y += 9 }
  }
  y += 6; pdf.text(`Fecha de emisión: ${date(new Date().toISOString())}`, 20, y); y += 8
  if (context.generatedBy) pdf.text(`Generado por: ${context.generatedBy}`, 20, y)
  return y + 14
}

function pageCursor(pdf: import('jspdf').jsPDF) {
  let y = 21
  const ensure = (height: number) => { if (y + height > 277) { pdf.addPage(); y = 21 } }
  const text = (label: string, value: string, gap = 5) => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); const labelText = `${label}: `; const lw = pdf.getTextWidth(labelText)
    pdf.setFont('helvetica', 'normal'); const lines = pdf.splitTextToSize(value || 'Sin registros', 180 - lw)
    ensure(lines.length * 4.5 + gap); pdf.setFont('helvetica', 'bold'); pdf.text(labelText, 15, y); pdf.setFont('helvetica', 'normal'); pdf.text(lines, 15 + lw, y); y += lines.length * 4.5 + gap
  }
  const heading = (value: string, following = 0) => { ensure(12 + following); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.text(value, 15, y); y += 8 }
  const paragraph = (value: string, gap = 4) => { const lines = pdf.splitTextToSize(value || 'Sin registros', 180); ensure(lines.length * 4.7 + gap); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(lines, 15, y); y += lines.length * 4.7 + gap }
  const measure = (value: string, width = 160) => pdf.splitTextToSize(value || 'Sin registros', width).length * 4.7 + 5
  return { get y() { return y }, set y(next: number) { y = next }, text, heading, paragraph, ensure, measure }
}

function finish(pdf: import('jspdf').jsPDF, context: PdfContext, filename: string, download = true) {
  const total = pdf.getNumberOfPages()
  for (let page = 1; page <= total; page += 1) { pdf.setPage(page); addHeader(pdf, context, page, total) }
  if (download) { pdf.save(filename); return null }
  return pdf.output('blob')
}

function signatureBlock(pdf: import('jspdf').jsPDF, cursor: ReturnType<typeof pageCursor>) {
  cursor.ensure(35)
  const y = cursor.y + 8
  pdf.setDrawColor(0); pdf.setLineWidth(.25); pdf.line(20, y, 88, y); pdf.line(122, y, 190, y)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
  pdf.text('Representante legal o cuidador: nombre, cédula y firma', 20, y + 5, { maxWidth: 68 })
  pdf.text('Profesional del DECE: nombre y firma', 122, y + 5, { maxWidth: 68 })
  pdf.text(`Fecha: ${date(new Date().toISOString())}`, 20, y + 15)
}

function questionHeight(pdf: import('jspdf').jsPDF, question: FormQuestion, value: unknown, filled: boolean) {
  const labelLines = pdf.splitTextToSize(`${question.label}${question.is_required ? ' *' : ''}`, 180).length
  if (filled) return Math.max(18, labelLines * 4.5 + pdf.splitTextToSize(Array.isArray(value) ? value.join(', ') : String(value ?? 'Sin respuesta'), 180).length * 4.5 + 10)
  if (question.data_type === 'single_select' || question.data_type === 'multi_select') return labelLines * 4.5 + (question.form_question_options ?? []).reduce((height, option) => height + Math.max(1, pdf.splitTextToSize(option.label, 175).length) * 4.5 + 2, 12)
  return labelLines * 4.5 + (question.data_type === 'textarea' ? 32 : 15)
}

function formQuestion(pdf: import('jspdf').jsPDF, cursor: ReturnType<typeof pageCursor>, question: FormQuestion, value: unknown, filled: boolean) {
  const label = `${question.label}${question.is_required ? ' *' : ''}`
  cursor.ensure(questionHeight(pdf, question, value, filled))
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); const labelLines = pdf.splitTextToSize(label, 180); pdf.text(labelLines, 15, cursor.y)
  let y = cursor.y + labelLines.length * 4.5 + 2
  if (filled) {
    const resolved = Array.isArray(value) ? value.join(', ') : value === true ? 'Sí' : value === false ? 'No' : String(value ?? 'Sin respuesta')
    const lines = pdf.splitTextToSize(resolved, 180); pdf.setFont('helvetica', 'normal'); pdf.text(lines, 15, y); y += lines.length * 4.5 + 3
  } else {
    const options = question.form_question_options ?? []
    if (question.data_type === 'boolean') { pdf.setFont('helvetica', 'normal'); pdf.rect(15, y - 2, 3, 3); pdf.text('Sí', 20, y); pdf.rect(33, y - 2, 3, 3); pdf.text('No', 38, y); y += 10 }
    else if (question.data_type === 'single_select' || question.data_type === 'multi_select') {
      pdf.setFont('helvetica', 'normal')
      for (const option of options) { const optionLines = pdf.splitTextToSize(option.label, 175); pdf.rect(15, y - 2, 3, 3); pdf.text(optionLines, 20, y); y += optionLines.length * 4.5 + 2 }
      y += 1
    } else {
      const count = question.data_type === 'textarea' ? 3 : 1
      if (question.data_type === 'date') { pdf.setFont('helvetica', 'normal'); pdf.text('__/__/____', 15, y); y += 8 }
      else for (let i = 0; i < count; i += 1) { pdf.setDrawColor(125); pdf.line(15, y + 2, question.data_type === 'number' ? 65 : 195, y + 2); y += 7 }
      y += 3
    }
  }
  cursor.y = y
}

function renderQuestions(pdf: import('jspdf').jsPDF, cursor: ReturnType<typeof pageCursor>, items: FormQuestion[], valueFor: (question: FormQuestion) => unknown, filled: boolean) {
  let section = ''
  for (const question of items) {
    const nextSection = question.display_config?.section?.trim() || 'Información'
    const value = valueFor(question)
    const height = questionHeight(pdf, question, value, filled)
    if (nextSection !== section) { cursor.heading(nextSection, height); section = nextSection }
    formQuestion(pdf, cursor, question, value, filled)
  }
}

async function audit(client: SupabaseClient, institutionId: string, profileId: string | undefined, entityType: string, entityId: string, kind: string) {
  if (!profileId) return
  try { await client.from('audit_events').insert({ institution_id: institutionId, profile_id: profileId, action: 'pdf.generate', entity_type: entityType, entity_id: entityId, payload: { kind } }) } catch { /* Auditoría opcional */ }
}

async function formDefinition(client: SupabaseClient, institutionId: string, code: string) {
  const { data: definitionData, error } = await client.from('form_definitions').select('form_definition_id,code,name,form_versions(form_version_id,version_number,status)').eq('institution_id', institutionId).eq('code', code).eq('is_active', true).maybeSingle()
  const data = check(definitionData, error, 'No se encontró la ficha publicada.')
  const versions = (data.form_versions ?? []) as Array<{ form_version_id: string; version_number: number; status: string }>
  const version = versions.filter(item => item.status === 'published').sort((a, b) => b.version_number - a.version_number)[0]
  if (!version) throw new Error('La ficha no tiene una versión publicada.')
  return { definition: data as unknown as FormMeta, version }
}

async function questions(client: SupabaseClient, versionId: string, includeInactive = false) {
  let query = client.from('form_questions').select('form_question_id,form_version_id,code,label,help_text,data_type,source_field,is_required,is_system,is_active,position,display_config,form_question_options(question_option_id,value,label,position,is_active)').eq('form_version_id', versionId).order('position')
  if (!includeInactive) query = query.eq('is_active', true).eq('form_question_options.is_active', true)
  const { data, error } = await query
  return check(data, error, 'No se pudieron cargar las preguntas de la ficha.') as PdfQuestion[]
}

async function profiles(client: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, string>()
  const { data, error } = await client.from('profiles').select('profile_id,first_name,last_name').in('profile_id', [...new Set(ids)])
  if (error || !data) return new Map<string, string>()
  const rows = data
  return new Map(rows.map(row => [row.profile_id, `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()]))
}

export function createDecePdfService(client: SupabaseClient) {
  async function blankForm(institutionId: string, code: string, studentId?: string | null, profileId?: string, preview = false) {
    const context = await loadContext(client, institutionId, studentId); context.generatedBy = await loadGeneratedBy(client, profileId)
    const { definition, version } = await formDefinition(client, institutionId, code); context.title = definition.name
    const items = await questions(client, version.form_version_id)
    const pdf = await pdfDoc(definition.name); const start = cover(pdf, context, definition.name); const cursor = pageCursor(pdf); cursor.y = start
    renderQuestions(pdf, cursor, items, () => null, false)
    signatureBlock(pdf, cursor); const blob = finish(pdf, context, `ficha-${code}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.pdf`, !preview)
    await audit(client, institutionId, profileId, 'form', definition.form_definition_id, 'form_blank')
    return blob
  }

  async function filledForm(institutionId: string, submissionId: string, profileId?: string) {
    const { data: submissionData, error } = await client.from('form_submissions').select('form_submission_id,student_id,form_version_id,status,submitted_at,reviewed_at').eq('form_submission_id', submissionId).maybeSingle()
    const submission = check(submissionData, error, 'No se pudo cargar el envío de la ficha.')
    const { data: studentData, error: studentError } = await client.from('students').select('student_id,institution_id,first_name,last_name,national_id,grade_level,enrollment_number,birth_date').eq('student_id', submission.student_id).eq('institution_id', institutionId).maybeSingle()
    const student = check(studentData, studentError, 'No se pudo cargar el estudiante de esta ficha.') as Student
    const { data: versionData, error: versionError } = await client.from('form_versions').select('form_version_id,form_definition_id,version_number').eq('form_version_id', submission.form_version_id).maybeSingle()
    const version = check(versionData, versionError, 'No se pudo cargar la versión respondida.')
    const { data: definitionData, error: definitionError } = await client.from('form_definitions').select('form_definition_id,name,code').eq('form_definition_id', version.form_definition_id).eq('institution_id', institutionId).maybeSingle()
    const definition = check(definitionData, definitionError, 'No se pudo cargar la ficha respondida.')
    const context = await loadContext(client, institutionId, student.student_id); context.generatedBy = await loadGeneratedBy(client, profileId)
    const allQuestions = await questions(client, submission.form_version_id, true)
    const { data: answersData, error: answersError } = await client.from('form_answers').select('form_question_id,value_text,value_number,value_boolean,value_date,selected_option_id,form_answer_options(question_option_id)').eq('form_submission_id', submissionId)
    const answers = check(answersData, answersError, 'No se pudieron cargar las respuestas de la ficha.') as Answer[]
    const answerById = new Map(answers.map(answer => [answer.form_question_id, answer]))
    const itemQuestions = allQuestions.filter(question => question.is_active !== false || answerById.has(question.form_question_id))
    const { data: optionData, error: optionError } = await client.from('form_question_options').select('question_option_id,value').in('form_question_id', itemQuestions.map(question => question.form_question_id))
    const options = itemQuestions.length ? check(optionData, optionError, 'No se pudieron cargar las opciones de respuesta.') : []
    const optionById = new Map((options ?? []).map(row => [row.question_option_id, row.value]))
    const title = `${definition.name} · ${studentName(student)}`; const pdf = await pdfDoc(title); const cursor = pageCursor(pdf); cursor.y = cover(pdf, context, definition.name)
    cursor.text('Estado', formStatuses[submission.status] ?? submission.status); cursor.text('Fecha de envío', date(submission.submitted_at)); cursor.text('Fecha de revisión', date(submission.reviewed_at)); cursor.text('Versión', String(version.version_number))
    const valueFor = (question: FormQuestion) => {
      const answer = answerById.get(question.form_question_id)
      const multi = (answer?.form_answer_options ?? []).map(row => optionById.get(row.question_option_id)).filter(Boolean)
      return question.source_field ? sourceValue(question.source_field, student) : question.data_type === 'multi_select' ? multi : question.data_type === 'single_select' ? optionById.get(answer?.selected_option_id ?? '') : answer?.value_text ?? answer?.value_number ?? answer?.value_boolean ?? (answer?.value_date ? date(answer.value_date) : null)
    }
    renderQuestions(pdf, cursor, itemQuestions, valueFor, true)
    signatureBlock(pdf, cursor); finish(pdf, context, `ficha-${definition.code}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.pdf`)
    await audit(client, institutionId, profileId, 'form', submissionId, 'form_filled')
  }

  async function loadCases(institutionId: string, studentId: string) {
    const { data, error } = await client.from('dece_cases').select('dece_case_id,institution_id,student_id,case_number,reason,primary_category,risk_level,confidentiality_level,status,opened_by,created_at').eq('institution_id', institutionId).eq('student_id', studentId).order('created_at')
    return check(data, error, 'No se pudieron cargar los casos del estudiante.') as DeceCase[]
  }

  async function caseRelated(caseRows: DeceCase[]) {
    const caseIds = caseRows.map(row => row.dece_case_id)
    if (!caseIds.length) return { visits: [] as DeceVisit[], actions: [] as DeceAction[], observations: [] as Observation[], profiles: new Map<string, string>() }
    const [visitResult, actionResult] = await Promise.all([
      client.from('dece_visits').select('dece_visit_id,dece_case_id,visit_date,summary,attention_notes,attended_by').in('dece_case_id', caseIds).order('visit_date'),
      client.from('dece_actions').select('dece_action_id,dece_case_id,description,due_date,is_completed,completed_at,responsible_profile_id').in('dece_case_id', caseIds).order('due_date'),
    ])
    const visits = check(visitResult.data, visitResult.error, 'No se pudieron cargar las visitas de los casos.') as DeceVisit[]
    const actions = check(actionResult.data, actionResult.error, 'No se pudieron cargar las acciones de los casos.') as DeceAction[]
    const visitIds = visits.map(visit => visit.dece_visit_id)
    const { data: observationData, error: observationError } = visitIds.length
      ? await client.from('dece_observations').select('dece_visit_id,category,description,severity,requires_follow_up').in('dece_visit_id', visitIds)
      : { data: [], error: null }
    const observations = check(observationData, observationError, 'No se pudieron cargar las observaciones.') as Observation[]
    const profileIds = [...caseRows.map(row => row.opened_by), ...visits.map(row => row.attended_by), ...actions.map(row => row.responsible_profile_id)].filter((id): id is string => Boolean(id))
    return { visits, actions, observations, profiles: await profiles(client, profileIds) }
  }

  function renderCase(cursor: ReturnType<typeof pageCursor>, row: DeceCase, related: Awaited<ReturnType<typeof caseRelated>>) {
    cursor.heading(`Caso ${row.case_number}`, 35)
    cursor.text('Categoría', categories[row.primary_category] ?? row.primary_category); cursor.text('Riesgo', risks[row.risk_level] ?? row.risk_level); cursor.text('Confidencialidad', confidentiality[row.confidentiality_level] ?? row.confidentiality_level); cursor.text('Estado', statuses[row.status] ?? row.status); cursor.text('Fecha de apertura', date(row.created_at, true)); cursor.text('Abierto por', profileName(related.profiles, row.opened_by)); cursor.text('Motivo', row.reason)
    const visits = related.visits.filter(visit => visit.dece_case_id === row.dece_case_id)
    cursor.heading('Visitas', visits.length ? 20 : 8)
    if (!visits.length) cursor.paragraph('Sin registros')
    for (const visit of visits) {
      const observations = related.observations.filter(item => item.dece_visit_id === visit.dece_visit_id)
      const content = [visit.summary, visit.attention_notes ?? 'Sin registros', profileName(related.profiles, visit.attended_by) || 'Sin responsable registrado', ...observations.map(item => `Observación: ${categories[item.category] ?? item.category} · ${risks[item.severity] ?? item.severity} · ${item.requires_follow_up ? 'Requiere seguimiento' : 'No requiere seguimiento'} · ${item.description}`)]
      cursor.ensure(12 + content.reduce((height, value) => height + cursor.measure(value), 0))
      cursor.heading(`Visita · ${date(visit.visit_date, true)}`); cursor.text('Resumen', visit.summary); cursor.text('Notas de atención', visit.attention_notes ?? 'Sin registros'); cursor.text('Atendió', profileName(related.profiles, visit.attended_by))
      if (!observations.length) cursor.paragraph('Observaciones: Sin registros')
      for (const observation of observations) cursor.paragraph(`Observación: ${categories[observation.category] ?? observation.category} · ${risks[observation.severity] ?? observation.severity} · ${observation.requires_follow_up ? 'Requiere seguimiento' : 'No requiere seguimiento'} · ${observation.description}`)
    }
    const actions = related.actions.filter(action => action.dece_case_id === row.dece_case_id)
    cursor.heading('Acuerdos y acciones', actions.length ? 10 : 8)
    if (!actions.length) cursor.paragraph('Sin registros')
    for (const action of actions) {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
      const today = `${parts.find(item => item.type === 'year')?.value}-${parts.find(item => item.type === 'month')?.value}-${parts.find(item => item.type === 'day')?.value}`
      const state = action.is_completed ? `Completada · ${date(action.completed_at)}` : action.due_date && action.due_date < today ? 'Vencida' : 'Pendiente'
      cursor.paragraph(`${action.description} · Responsable: ${profileName(related.profiles, action.responsible_profile_id) || 'Sin responsable'} · Fecha límite: ${date(action.due_date)} · Estado: ${state}`)
    }
  }

  async function casePdf(institutionId: string, caseId: string, profileId?: string) {
    const { data: rowData, error } = await client.from('dece_cases').select('dece_case_id,institution_id,student_id,case_number,reason,primary_category,risk_level,confidentiality_level,status,opened_by,created_at').eq('dece_case_id', caseId).eq('institution_id', institutionId).maybeSingle()
    const row = check(rowData, error, 'No se pudo cargar el caso de esta institución.') as DeceCase
    const context = await loadContext(client, institutionId, row.student_id); context.generatedBy = await loadGeneratedBy(client, profileId)
    const related = await caseRelated([row]); const pdf = await pdfDoc(`Caso ${row.case_number}`); const cursor = pageCursor(pdf); cursor.y = cover(pdf, context, `Caso ${row.case_number}`)
    renderCase(cursor, row, related); signatureBlock(pdf, cursor); finish(pdf, context, `caso-${row.case_number}.pdf`)
    await audit(client, institutionId, profileId, 'dece_case', caseId, 'case')
  }

  async function studentFile(institutionId: string, studentId: string, includeForms: boolean, profileId?: string) {
    const context = await loadContext(client, institutionId, studentId); context.generatedBy = await loadGeneratedBy(client, profileId)
    const caseRows = await loadCases(institutionId, studentId); const related = await caseRelated(caseRows)
    const pdf = await pdfDoc(`Expediente DECE · ${studentName(context.student)}`); const cursor = pageCursor(pdf); cursor.y = cover(pdf, context, 'Expediente del estudiante')
    cursor.heading('Resumen de casos')
    if (!caseRows.length) cursor.paragraph('Sin registros')
    caseRows.forEach(row => cursor.paragraph(`${row.case_number} · ${statuses[row.status] ?? row.status} · Riesgo: ${risks[row.risk_level] ?? row.risk_level} · ${date(row.created_at)}`))
    for (const row of caseRows) renderCase(cursor, row, related)
    if (includeForms) {
      cursor.heading('Fichas llenadas')
      const { data: submissions, error } = await client.from('form_submissions').select('form_submission_id,form_version_id,status,submitted_at,reviewed_at').eq('student_id', studentId).in('status', ['draft', 'submitted', 'reviewed']).order('submitted_at')
      const rows = check(submissions, error, 'No se pudieron cargar las fichas del estudiante.') as Submission[]
      if (!rows.length) cursor.paragraph('Sin registros')
      for (const submission of rows) {
        const { data: versionData, error: versionError } = await client.from('form_versions').select('form_version_id,form_definition_id,version_number').eq('form_version_id', submission.form_version_id).maybeSingle()
        const version = check(versionData, versionError, 'No se pudo cargar la versión de una ficha.')
        const { data: definitionData, error: formError } = await client.from('form_definitions').select('name,code').eq('form_definition_id', version.form_definition_id).eq('institution_id', institutionId).maybeSingle()
        const definition = check(definitionData, formError, 'No se pudo cargar una ficha del estudiante.')
        cursor.heading(`${definition.name} · ${formStatuses[submission.status] ?? submission.status}`); cursor.text('Fecha de envío', date(submission.submitted_at)); cursor.text('Fecha de revisión', date(submission.reviewed_at))
        const allQuestions = await questions(client, submission.form_version_id, true)
        const { data: answerRows, error: answerError } = await client.from('form_answers').select('form_question_id,value_text,value_number,value_boolean,value_date,selected_option_id,form_answer_options(question_option_id)').eq('form_submission_id', submission.form_submission_id)
        const answerList = check(answerRows, answerError, 'No se pudieron cargar las respuestas de una ficha.') as Answer[]
        const answerMap = new Map(answerList.map(item => [item.form_question_id, item]))
        const itemQuestions = allQuestions.filter(question => question.is_active !== false || answerMap.has(question.form_question_id))
        const optionIds = [...new Set(answerList.flatMap(item => [item.selected_option_id, ...(item.form_answer_options ?? []).map(option => option.question_option_id)].filter((value): value is string => Boolean(value))))]
        const { data: options, error: optionsError } = optionIds.length ? await client.from('form_question_options').select('question_option_id,value').in('question_option_id', optionIds) : { data: [], error: null }
        const optionMap = new Map(check(options, optionsError, 'No se pudieron cargar opciones de una ficha.').map(item => [item.question_option_id, item.value]))
        renderQuestions(pdf, cursor, itemQuestions, question => {
          const answer = answerMap.get(question.form_question_id)
          return question.source_field ? sourceValue(question.source_field, context.student!) : question.data_type === 'multi_select' ? (answer?.form_answer_options ?? []).map(item => optionMap.get(item.question_option_id)) : question.data_type === 'single_select' ? optionMap.get(answer?.selected_option_id ?? '') : answer?.value_text ?? answer?.value_number ?? answer?.value_boolean ?? (answer?.value_date ? date(answer.value_date) : null)
        }, true)
      }
    }
    signatureBlock(pdf, cursor); finish(pdf, context, `expediente-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.pdf`)
    await audit(client, institutionId, profileId, 'student', studentId, 'student_file')
  }

  return { blankForm, filledForm, casePdf, studentFile }
}
