import type { SupabaseClient } from '@supabase/supabase-js'

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'single_select'
  | 'multi_select'

export type FormQuestion = {
  form_question_id: string
  form_version_id: string
  code: string
  label: string
  help_text: string | null
  data_type: QuestionType
  source_field: string | null
  is_required: boolean
  is_system: boolean
  position: number
  display_config: QuestionDisplayConfig
  form_question_options: Array<{
    question_option_id: string
    value: string
    label: string
    position: number
  }>
}

export type FormSubmission = {
  form_submission_id: string
  form_version_id: string
  status: 'draft' | 'submitted' | 'reviewed'
}

export type FormAnswerValue = string | number | boolean | string[] | null
export type QuestionValidation = { format?: 'phone' | 'email' | 'national_id'; min?: number; max?: number; integer?: boolean }
export type QuestionDisplayConfig = { section?: string; validation?: QuestionValidation }

export function getQuestionValidation(question: Pick<FormQuestion, 'code' | 'display_config'>): QuestionValidation {
  const code = question.code.toLowerCase()
  const fallback: QuestionValidation = code.endsWith('_age')
    ? { min: 4, max: 100, integer: true }
    : code.includes('national_id') || code.includes('guardian_national_id')
      ? { format: 'national_id' }
      : ['family_phones', 'representative_phone', 'responsible_landline', 'responsible_mobile', 'emergency_contact_phone'].includes(code)
        ? { format: 'phone' }
        : {}
  return { ...fallback, ...question.display_config?.validation }
}

export function validateFormAnswers(questions: FormQuestion[], answers: Record<string, FormAnswerValue>) {
  for (const question of questions) {
    if (question.is_system) continue
    const value = answers[question.form_question_id]
    const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
    if (question.is_required && empty) return `Completa el campo requerido: ${question.label}`
    if (empty) continue
    const validation = getQuestionValidation(question)
    if (question.data_type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${question.label}: ingresa un número válido.`
      if (validation.integer && !Number.isInteger(value)) return `${question.label}: ingresa un número entero.`
      if (validation.min !== undefined && value < validation.min) return `${question.label}: el valor mínimo es ${validation.min}.`
      if (validation.max !== undefined && value > validation.max) return `${question.label}: el valor máximo es ${validation.max}.`
    }
    if (typeof value === 'string' && validation.format === 'phone') {
      const digits = value.replace(/\D/g, '').length
      const maxDigits = question.code === 'family_phones' ? 30 : 15
      if (!/^[+(),/\d\s-]+$/.test(value) || digits < 7 || digits > maxDigits) return `${question.label}: ingresa un teléfono válido de 7 a ${maxDigits} dígitos.`
    }
    if (typeof value === 'string' && validation.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `${question.label}: ingresa un correo electrónico válido.`
    if (typeof value === 'string' && validation.format === 'national_id' && !/^\d{10}$/.test(value)) return `${question.label}: ingresa una cédula de 10 dígitos.`
  }
  return null
}

export type FormRuntime = {
  definitionId: string
  versionId: string
  versionNumber: number
  status: 'draft' | 'published'
  name: string
  questions: FormQuestion[]
  submission: FormSubmission | null
  answers: Record<string, FormAnswerValue>
}

type StandardQuestion = {
  code: string
  label: string
  type: QuestionType
  section: string
  required?: boolean
  options?: string[]
  help?: string
}

const standardFormSetupTasks = new Map<string, Promise<void>>()

const standardQuestions: Record<'general' | 'authorization', StandardQuestion[]> = {
  general: [
    { code: 'school_year', label: 'Año lectivo', type: 'text', section: 'Identificación' },
    { code: 'birth_place_date', label: 'Lugar y fecha de nacimiento', type: 'text', section: 'Identificación' },
    { code: 'enrollment_number', label: 'Número de matrícula', type: 'text', section: 'Identificación' },
    { code: 'student_age', label: 'Edad', type: 'number', section: 'Identificación' },
    { code: 'home_address', label: 'Dirección del domicilio', type: 'textarea', section: 'Identificación' },
    { code: 'home_sector', label: 'Sector', type: 'text', section: 'Identificación' },
    { code: 'domicile_change', label: '¿Ha cambiado de domicilio?', type: 'boolean', section: 'Identificación' },
    { code: 'mother_name', label: 'Nombre de la madre', type: 'text', section: 'Datos familiares' },
    { code: 'mother_age', label: 'Edad de la madre', type: 'number', section: 'Datos familiares' },
    { code: 'mother_marital_status', label: 'Estado civil de la madre', type: 'text', section: 'Datos familiares' },
    { code: 'mother_education', label: 'Instrucción de la madre', type: 'text', section: 'Datos familiares' },
    { code: 'mother_occupation', label: 'Profesión u ocupación de la madre', type: 'text', section: 'Datos familiares' },
    { code: 'mother_workplace', label: 'Lugar de trabajo de la madre', type: 'text', section: 'Datos familiares' },
    { code: 'father_name', label: 'Nombre del padre', type: 'text', section: 'Datos familiares' },
    { code: 'father_age', label: 'Edad del padre', type: 'number', section: 'Datos familiares' },
    { code: 'father_marital_status', label: 'Estado civil del padre', type: 'text', section: 'Datos familiares' },
    { code: 'father_education', label: 'Instrucción del padre', type: 'text', section: 'Datos familiares' },
    { code: 'father_occupation', label: 'Profesión u ocupación del padre', type: 'text', section: 'Datos familiares' },
    { code: 'father_workplace', label: 'Lugar de trabajo del padre', type: 'text', section: 'Datos familiares' },
    { code: 'family_phones', label: 'Teléfonos de contacto familiar', type: 'text', section: 'Datos familiares' },
    { code: 'legal_representative', label: 'Representante legal, cuidador o tutor', type: 'text', section: 'Datos familiares' },
    { code: 'representative_relation', label: 'Parentesco', type: 'text', section: 'Datos familiares' },
    { code: 'representative_age', label: 'Edad del representante', type: 'number', section: 'Datos familiares' },
    { code: 'representative_occupation', label: 'Profesión u ocupación del representante', type: 'text', section: 'Datos familiares' },
    { code: 'representative_workplace', label: 'Lugar de trabajo del representante', type: 'text', section: 'Datos familiares' },
    { code: 'representative_phone', label: 'Teléfono del representante', type: 'text', section: 'Datos familiares' },
    { code: 'family_members', label: 'Personas con quienes vive el estudiante', type: 'textarea', section: 'Referencias familiares' },
    { code: 'siblings_count_ages', label: 'Número de hermanos y edades', type: 'textarea', section: 'Referencias familiares' },
    { code: 'family_birth_order', label: 'Lugar que ocupa en la familia', type: 'text', section: 'Referencias familiares' },
    { code: 'siblings_at_school', label: 'Hermanos que estudian en la institución y edades', type: 'textarea', section: 'Referencias familiares' },
    { code: 'family_structure', label: 'Descripción de la estructura familiar', type: 'textarea', section: 'Referencias familiares' },
    { code: 'family_disability', label: '¿Hay una persona con discapacidad en la familia?', type: 'boolean', section: 'Referencias familiares' },
    { code: 'family_disability_who', label: '¿Quién?', type: 'text', section: 'Referencias familiares' },
    { code: 'housing_type', label: 'Condición de la vivienda', type: 'single_select', options: ['Propia', 'Arrendada', 'Prestada', 'Compartida', 'Cedida'], section: 'Vivienda y servicios' },
    { code: 'housing_description', label: 'Descripción de la vivienda', type: 'textarea', section: 'Vivienda y servicios' },
    { code: 'housing_services', label: 'Servicios disponibles', type: 'multi_select', options: ['Luz', 'Agua potable', 'SSHH', 'Pozo séptico', 'Teléfono', 'Cable', 'Celular', 'Computadora', 'Internet'], section: 'Vivienda y servicios' },
    { code: 'student_disability', label: '¿El estudiante tiene alguna discapacidad?', type: 'boolean', section: 'Salud' },
    { code: 'student_disability_detail', label: 'Detalle de discapacidad', type: 'textarea', section: 'Salud' },
    { code: 'medical_condition', label: '¿Tiene una condición médica específica?', type: 'boolean', section: 'Salud' },
    { code: 'medical_condition_detail', label: 'Detalle de condición médica', type: 'textarea', section: 'Salud' },
    { code: 'has_allergies', label: '¿Padece alergias?', type: 'boolean', section: 'Salud' },
    { code: 'allergy_medications', label: 'Alergias y medicamentos que utiliza', type: 'textarea', section: 'Salud' },
    { code: 'healthcare_place', label: 'Centro de salud donde recibe atención', type: 'single_select', options: ['Centro de salud', 'Subcentro de salud', 'Hospital público', 'Hospital privado'], section: 'Salud' },
    { code: 'regular_doctor', label: 'Nombre del médico que le atiende regularmente', type: 'text', section: 'Salud' },
    { code: 'school_entry_date', label: 'Fecha de ingreso a la institución', type: 'date', section: 'Datos académicos' },
    { code: 'previous_school', label: 'Institución educativa de procedencia', type: 'text', section: 'Datos académicos' },
  ],
  authorization: [
    { code: 'school_amie', label: 'Código AMIE de la institución', type: 'text', section: 'Datos generales', help: 'Ingrese el código correspondiente a esta institución.' },
    { code: 'student_birth_date', label: 'Fecha de nacimiento', type: 'date', section: 'Datos generales' },
    { code: 'student_address', label: 'Dirección del domicilio', type: 'textarea', section: 'Datos generales' },
    { code: 'school_year', label: 'Año lectivo', type: 'text', section: 'Datos generales' },
    { code: 'responsible_name', label: 'Representante o familiar responsable', type: 'text', section: 'Datos generales' },
    { code: 'school_name', label: 'Nombre de la institución educativa', type: 'text', section: 'Datos generales', required: true },
    { code: 'responsible_relation', label: 'Parentesco', type: 'text', section: 'Datos generales' },
    { code: 'responsible_landline', label: 'Teléfono fijo', type: 'text', section: 'Datos generales' },
    { code: 'responsible_mobile', label: 'Teléfono celular', type: 'text', section: 'Datos generales' },
    { code: 'has_insurance', label: '¿El estudiante posee seguro médico?', type: 'boolean', section: 'Datos generales' },
    { code: 'insurance_name', label: 'Nombre del seguro (IESS, ISSFA, ISSPOL u otro)', type: 'text', section: 'Datos generales' },
    { code: 'usual_healthcare', label: 'Establecimiento de salud al que acude', type: 'text', section: 'Datos generales' },
    { code: 'can_swim', label: '¿El estudiante sabe nadar?', type: 'boolean', section: 'Datos generales' },
    { code: 'blood_type', label: 'Grupo sanguíneo y factor RH', type: 'text', section: 'Datos generales' },
    { code: 'emergency_contact_1', label: 'Contacto de emergencia 1: nombre, parentesco, teléfono fijo y celular', type: 'textarea', section: 'Contactos de emergencia', required: true, help: 'Indique al menos un número fijo de contacto.' },
    { code: 'emergency_contact_2', label: 'Contacto de emergencia 2: nombre, parentesco, teléfono fijo y celular', type: 'textarea', section: 'Contactos de emergencia' },
    { code: 'prior_surgeries', label: '¿Ha sido sometido a cirugías previas?', type: 'boolean', section: 'Información importante' },
    { code: 'surgery_details', label: 'Detalle de cirugías', type: 'textarea', section: 'Información importante' },
    { code: 'has_allergies', label: '¿Tiene alergias?', type: 'boolean', section: 'Información importante' },
    { code: 'allergy_details', label: 'Detalle de alergias', type: 'textarea', section: 'Información importante' },
    { code: 'diagnosed_conditions', label: '¿Tiene enfermedades diagnosticadas?', type: 'boolean', section: 'Información importante' },
    { code: 'condition_details', label: 'Detalle de enfermedades o condiciones', type: 'textarea', section: 'Información importante' },
    { code: 'medications', label: 'Medicamentos que usa', type: 'textarea', section: 'Información importante' },
    { code: 'special_therapy', label: 'Tratamiento médico específico que considera importante', type: 'textarea', section: 'Información importante' },
    { code: 'treatment_restrictions', label: 'Tratamiento que no autoriza por razones culturales o religiosas', type: 'textarea', section: 'Información importante' },
    { code: 'healthcare_authorization', label: 'Confirmo la autorización para atención médica escolar y traslado en caso de urgencia', type: 'boolean', section: 'Autorización', required: true, help: 'Lea la autorización y consulte con la institución si necesita registrar una restricción.' },
    { code: 'authorization_truth_declaration', label: 'Declaro que la información es correcta y comunicaré cualquier modificación a la institución', type: 'boolean', section: 'Autorización', required: true },
    { code: 'authorization_signer_name', label: 'Nombres y apellidos de quien autoriza', type: 'text', section: 'Autorización', required: true },
    { code: 'guardian_national_id', label: 'Cédula del representante legal', type: 'text', section: 'Autorización', required: true },
    { code: 'authorization_date', label: 'Fecha de autorización', type: 'date', section: 'Autorización' },
    { code: 'authorization_observations', label: 'Observaciones', type: 'textarea', section: 'Autorización' },
  ],
}

/**
 * Servicio del módulo. Recibe el cliente autenticado del contenedor de la app
 * y nunca crea una sesión propia; así reutiliza la autenticación del equipo.
 */
export function createDeceFormService(client: SupabaseClient) {
  async function setupStandardForms(institutionId: string) {
    const { data: initialDefinitions, error: initialError } = await client.from('form_definitions')
      .select('form_definition_id, code, is_active, form_versions(form_version_id, version_number, status)')
      .eq('institution_id', institutionId).in('code', ['general', 'authorization'])
    if (initialError) throw initialError
    const complete = ['general', 'authorization'].every(code => (initialDefinitions ?? []).some(definition =>
      definition.code === code && definition.is_active && (definition.form_versions ?? []).some((version: { status: string }) => version.status === 'published'),
    ))
    if (!complete) {
      const { error: createError } = await client.rpc('create_dece_default_forms', { target_institution: institutionId })
      if (createError) throw createError
    }

    const { data: definitions, error: definitionsError } = await client.from('form_definitions')
      .select('form_definition_id, code, form_versions(form_version_id, version_number, status)')
      .eq('institution_id', institutionId).eq('is_active', true).in('code', ['general', 'authorization'])
    if (definitionsError) throw definitionsError

    for (const definition of (definitions ?? []) as Array<{ code: string; form_versions: Array<{ form_version_id: string; version_number: number; status: string }> }>) {
      if (definition.code !== 'general' && definition.code !== 'authorization') continue
      const version = definition.form_versions.filter(item => item.status === 'published' || item.status === 'draft')
        .sort((a, b) => b.version_number - a.version_number)[0]
      if (!version) continue
      const { data: existing, error: existingError } = await client.from('form_questions')
        .select('form_question_id, code, position, form_question_options(question_option_id)')
        .eq('form_version_id', version.form_version_id)
      if (existingError) throw existingError
      const rows = (existing ?? []) as Array<{ form_question_id: string; code: string; position: number; form_question_options: Array<{ question_option_id: string }> }>
      const rowsByCode = new Map(rows.map(row => [row.code, row]))
      const missing = standardQuestions[definition.code].filter(question => !rowsByCode.has(question.code))
      const firstPosition = Math.max(0, ...rows.map(row => row.position))
      if (missing.length) {
        const { data: inserted, error: insertError } = await client.from('form_questions').insert(missing.map((question, index) => ({
          form_version_id: version.form_version_id,
          code: question.code,
          label: question.label,
          help_text: question.help ?? null,
          data_type: question.type,
          is_required: question.required ?? false,
          is_system: false,
          is_active: true,
          position: firstPosition + index + 1,
          display_config: { section: question.section },
        }))).select('form_question_id, code')
        if (insertError) throw insertError
        for (const row of inserted ?? []) rowsByCode.set(row.code, { ...row, position: 0, form_question_options: [] })
      }
      const optionsToInsert = standardQuestions[definition.code].flatMap(question => {
        if (!question.options?.length) return []
        const existingRow = rowsByCode.get(question.code)
        if (!existingRow || existingRow.form_question_options.length) return []
        return question.options.map((option, index) => ({
          form_question_id: existingRow.form_question_id, value: option, label: option, position: index + 1,
        }))
      })
      if (optionsToInsert.length) {
        const { error: optionsError } = await client.from('form_question_options').insert(optionsToInsert)
        if (optionsError) throw optionsError
      }
    }
  }

  async function ensureStandardForms(institutionId: string) {
    const pending = standardFormSetupTasks.get(institutionId)
    if (pending) return pending
    const task = setupStandardForms(institutionId)
    standardFormSetupTasks.set(institutionId, task)
    try {
      await task
    } catch (error) {
      if (standardFormSetupTasks.get(institutionId) === task) standardFormSetupTasks.delete(institutionId)
      throw error
    }
  }

  async function listFormTemplates(institutionId: string) {
    const { data, error } = await client.from('form_definitions')
      .select('form_definition_id, code, name, is_active, form_versions(form_version_id, version_number, status)')
      .eq('institution_id', institutionId).eq('is_active', true).order('name')
    if (error) throw error
    return (data ?? []).map(definition => {
      const versions = (definition.form_versions ?? []) as Array<{ form_version_id: string; version_number: number; status: string }>
      const version = versions.filter(item => item.status === 'published' || item.status === 'draft').sort((a, b) => b.version_number - a.version_number)[0]
      return { id: definition.form_definition_id as string, code: definition.code as string, name: definition.name as string, versionId: version?.form_version_id ?? null }
    })
  }

  async function createFormTemplate(institutionId: string, name: string) {
    const code = `custom_${crypto.randomUUID()}`
    const { data: definition, error: definitionError } = await client.from('form_definitions')
      .insert({ institution_id: institutionId, code, name: name.trim(), is_active: true })
      .select('form_definition_id').single()
    if (definitionError) throw definitionError
    const { data: version, error: versionError } = await client.from('form_versions')
      .insert({ form_definition_id: definition.form_definition_id, version_number: 1, status: 'published', published_at: new Date().toISOString() })
      .select('form_version_id').single()
    if (versionError) throw versionError
    return { id: definition.form_definition_id as string, code, versionId: version.form_version_id as string, name: name.trim() }
  }

  async function deactivateFormTemplate(definitionId: string) {
    const { data: definition, error: readError } = await client.from('form_definitions').select('code').eq('form_definition_id', definitionId).single()
    if (readError) throw readError
    if (definition.code === 'general' || definition.code === 'authorization') throw new Error('Las fichas base no se pueden retirar.')
    const { error } = await client.from('form_definitions').update({ is_active: false, updated_at: new Date().toISOString() }).eq('form_definition_id', definitionId)
    if (error) throw error
  }

  async function resetDefaultTemplates(institutionId: string) {
    await ensureStandardForms(institutionId)
    for (const [code, defaults] of Object.entries(standardQuestions)) {
      const { data: definition, error: definitionError } = await client.from('form_definitions').select('form_definition_id')
        .eq('institution_id', institutionId).eq('code', code).single()
      if (definitionError) throw definitionError
      const { data: versions, error: versionError } = await client.from('form_versions').select('form_version_id, version_number, status')
        .eq('form_definition_id', definition.form_definition_id).eq('status', 'published').order('version_number', { ascending: false }).limit(1)
      if (versionError) throw versionError
      const currentVersion = versions?.[0]
      if (!currentVersion) continue
      const { data: currentQuestions, error: questionsError } = await client.from('form_questions')
        .select('code, label, help_text, data_type, source_field, is_required, is_system, position, display_config')
        .eq('form_version_id', currentVersion.form_version_id).eq('is_system', true).eq('is_active', true)
      if (questionsError) throw questionsError
      const { error: retireError } = await client.from('form_versions').update({ status: 'retired' }).eq('form_version_id', currentVersion.form_version_id)
      if (retireError) throw retireError
      const { data: newVersion, error: createVersionError } = await client.from('form_versions').insert({
        form_definition_id: definition.form_definition_id,
        version_number: currentVersion.version_number + 1,
        status: 'published',
        published_at: new Date().toISOString(),
      }).select('form_version_id').single()
      if (createVersionError) throw createVersionError
      const systemRows = (currentQuestions ?? []).map(question => ({ ...question, form_version_id: newVersion.form_version_id }))
      const defaultRows = defaults.map((question, index) => ({
        form_version_id: newVersion.form_version_id, code: question.code, label: question.label,
        help_text: question.help ?? null, data_type: question.type, source_field: null,
        is_required: question.required ?? false, is_system: false, is_active: true,
        position: systemRows.length + index + 1, display_config: { section: question.section },
      }))
      if (systemRows.length) {
        const { error } = await client.from('form_questions').insert(systemRows)
        if (error) throw error
      }
      const { data: insertedDefaults, error: defaultsError } = await client.from('form_questions').insert(defaultRows).select('form_question_id, code')
      if (defaultsError) throw defaultsError
      const questionIds = new Map((insertedDefaults ?? []).map(question => [question.code, question.form_question_id]))
      for (const question of defaults) {
        const questionId = questionIds.get(question.code)
        if (!questionId || !question.options?.length) continue
        const { error } = await client.from('form_question_options').insert(question.options.map((label, index) => ({
          form_question_id: questionId, value: label, label, position: index + 1,
        })))
        if (error) throw error
      }
    }
  }

  async function loadForm(institutionId: string, code: string, studentId: string, allowDraft = true) {
    const { data: definition, error: definitionError } = await client
      .from('form_definitions')
      .select('form_definition_id, name, form_versions(form_version_id, version_number, status, created_at)')
      .eq('institution_id', institutionId)
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (definitionError) throw definitionError
    if (!definition) throw new Error('No tienes permiso para ver esta ficha o todavía no se ha publicado en tu institución.')

    const versions = (definition.form_versions ?? []) as Array<{
      form_version_id: string
      version_number: number
      status: 'draft' | 'published' | 'retired'
      created_at: string
    }>
    const version = versions
      .filter(item => item.status === 'published' || (allowDraft && item.status === 'draft'))
      .sort((left, right) => right.version_number - left.version_number)[0]

    if (!version) throw new Error('La institución todavía no ha publicado esta ficha.')

    const { data: questionRows, error: questionsError } = await client
      .from('form_questions')
      .select('form_question_id, form_version_id, code, label, help_text, data_type, source_field, is_required, is_system, position, display_config, form_question_options(question_option_id, value, label, position)')
      .eq('form_version_id', version.form_version_id)
      .eq('is_active', true)
      .order('position')

    if (questionsError) throw questionsError

    const { data: submission, error: submissionError } = await client
      .from('form_submissions')
      .select('form_submission_id, form_version_id, status')
      .eq('form_version_id', version.form_version_id)
      .eq('student_id', studentId)
      .maybeSingle()

    if (submissionError) throw submissionError

    let answers: Record<string, FormAnswerValue> = {}
    if (submission) {
      const { data: answerRows, error: answersError } = await client
        .from('form_answers')
        .select('form_question_id, value_text, value_number, value_boolean, value_date, selected_option_id, form_question_options!form_answer_selected_option_question_fk(value), form_answer_options(question_option_id)')
        .eq('form_submission_id', submission.form_submission_id)

      if (answersError) throw answersError
      const questionsById = new Map((questionRows ?? []).map(question => [question.form_question_id, question as FormQuestion]))
      answers = Object.fromEntries((answerRows ?? []).map(row => {
        const value = row.value_text ?? row.value_number ?? row.value_boolean ?? row.value_date
        const question = questionsById.get(row.form_question_id)
        if (question?.data_type === 'multi_select') {
          const selectedIds = ((row.form_answer_options ?? []) as Array<{ question_option_id: string }>).map(option => option.question_option_id)
          return [row.form_question_id, question.form_question_options.filter(option => selectedIds.includes(option.question_option_id)).map(option => option.value)]
        }
        const selected = row.form_question_options as { value: string } | Array<{ value: string }> | null
        const selectedValue = Array.isArray(selected) ? selected[0]?.value : selected?.value
        return [row.form_question_id, selectedValue ?? value ?? null]
      }))
    }

    return {
      definitionId: definition.form_definition_id,
      versionId: version.form_version_id,
      versionNumber: version.version_number,
      status: version.status as FormRuntime['status'],
      name: definition.name,
      questions: (questionRows ?? []) as FormQuestion[],
      submission: submission as FormSubmission | null,
      answers,
    } satisfies FormRuntime
  }

  async function saveDraft(
    studentId: string,
    versionId: string,
    submissionId: string | null,
    answers: Record<string, FormAnswerValue>,
    questions: FormQuestion[],
  ) {
    const validationError = validateFormAnswers(questions, answers)
    if (validationError) throw new Error(validationError)
    let currentSubmissionId = submissionId

    if (currentSubmissionId) {
      const { data: existing, error: statusError } = await client.from('form_submissions')
        .select('status').eq('form_submission_id', currentSubmissionId).single()
      if (statusError) throw statusError
      if (existing.status !== 'draft') throw new Error('La ficha está bloqueada. Comunícate con DECE para solicitar una corrección.')
    }

    if (!currentSubmissionId) {
      const { data, error } = await client
        .from('form_submissions')
        .upsert({ form_version_id: versionId, student_id: studentId, status: 'draft' }, {
          onConflict: 'student_id,form_version_id',
        })
        .select('form_submission_id')
        .single()
      if (error) throw error
      currentSubmissionId = data.form_submission_id
    }

    const entries = Object.entries(answers)
    for (const [questionId, value] of entries) {
      const question = questions.find(item => item.form_question_id === questionId)
      if (!question || question.is_system) continue
      const optionId = question.data_type === 'single_select' && typeof value === 'string'
        ? question.form_question_options.find(option => option.value === value)?.question_option_id ?? null
        : null
      const row = {
        form_submission_id: currentSubmissionId,
        form_version_id: versionId,
        form_question_id: questionId,
        value_text: typeof value === 'string' && question.data_type !== 'date' && !optionId ? value : null,
        value_number: typeof value === 'number' ? value : null,
        value_boolean: typeof value === 'boolean' ? value : null,
        value_date: question.data_type === 'date' && typeof value === 'string' ? value : null,
        selected_option_id: optionId,
      }

      const { data: savedAnswer, error } = await client.from('form_answers').upsert(row, {
        onConflict: 'form_submission_id,form_question_id',
      }).select('form_answer_id').single()
      if (error) throw error

      if (question.data_type === 'multi_select') {
        const { error: deleteError } = await client.from('form_answer_options')
          .delete().eq('form_answer_id', savedAnswer.form_answer_id)
        if (deleteError) throw deleteError
        const selectedValues = Array.isArray(value) ? value : []
        const selectedOptions = question.form_question_options
          .filter(option => selectedValues.includes(option.value))
          .map(option => ({ form_answer_id: savedAnswer.form_answer_id, form_question_id: questionId, question_option_id: option.question_option_id }))
        if (selectedOptions.length) {
          const { error: optionsError } = await client.from('form_answer_options').insert(selectedOptions)
          if (optionsError) throw optionsError
        }
      }
    }

    const { data: updatedSubmission, error: submissionError } = await client
      .from('form_submissions')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('form_submission_id', currentSubmissionId)
      .eq('student_id', studentId)
      .eq('status', 'draft')
      .select('form_submission_id')
      .maybeSingle()

    if (submissionError) throw submissionError
    if (!updatedSubmission) throw new Error('Sin permiso para guardar esta ficha o la ficha ya fue enviada.')
    if (!currentSubmissionId) throw new Error('No se pudo crear la ficha.')
    return currentSubmissionId
  }

  async function submit(submissionId: string) {
    const { data, error } = await client.from('form_submissions')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('form_submission_id', submissionId).eq('status', 'draft')
      .select('form_submission_id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Sin permiso para enviar esta ficha o el borrador ya no está disponible.')
  }

  async function markReviewed(submissionId: string) {
    const { data, error } = await client.from('form_submissions')
      .update({ status: 'reviewed', updated_at: new Date().toISOString() })
      .eq('form_submission_id', submissionId).eq('status', 'submitted')
      .select('form_submission_id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Sin permiso para revisar esta ficha o ya fue revisada.')
  }

  async function reopenSubmission(submissionId: string) {
    const { data, error } = await client.from('form_submissions')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('form_submission_id', submissionId).eq('status', 'reviewed')
      .select('form_submission_id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('No se pudo reabrir la ficha: debe estar revisada y visible para DECE.')
  }

  async function loadOwnSubmission(submissionId: string, studentId: string) {
    const { data: submission, error: submissionError } = await client.from('form_submissions')
      .select('form_submission_id, student_id, form_version_id, status, updated_at')
      .eq('form_submission_id', submissionId).eq('student_id', studentId).maybeSingle()
    if (submissionError) throw submissionError
    if (!submission) throw new Error('No tienes permiso para consultar este envío.')

    const { data: version, error: versionError } = await client.from('form_versions')
      .select('form_version_id, form_definition_id, version_number')
      .eq('form_version_id', submission.form_version_id).maybeSingle()
    if (versionError) throw versionError
    if (!version) throw new Error('No tienes permiso para consultar la versión de esta ficha.')

    const { data: definition, error: definitionError } = await client.from('form_definitions')
      .select('name, code').eq('form_definition_id', version.form_definition_id).maybeSingle()
    if (definitionError) throw definitionError
    if (!definition) throw new Error('No tienes permiso para consultar esta ficha.')

    const { data: questionRows, error: questionsError } = await client.from('form_questions')
      .select('form_question_id, form_version_id, code, label, help_text, data_type, source_field, is_required, is_system, position, display_config, form_question_options(question_option_id, value, label, position)')
      .eq('form_version_id', submission.form_version_id).order('position')
    if (questionsError) throw questionsError

    const { data: answerRows, error: answersError } = await client.from('form_answers')
      .select('form_question_id, value_text, value_number, value_boolean, value_date, form_question_options!form_answer_selected_option_question_fk(value), form_answer_options(question_option_id)')
      .eq('form_submission_id', submissionId)
    if (answersError) throw answersError
    const questions = (questionRows ?? []) as FormQuestion[]
    const questionsById = new Map(questions.map(question => [question.form_question_id, question]))
    const answers = Object.fromEntries((answerRows ?? []).map(row => {
      const question = questionsById.get(row.form_question_id)
      if (question?.data_type === 'multi_select') {
        const ids = ((row.form_answer_options ?? []) as Array<{ question_option_id: string }>).map(option => option.question_option_id)
        return [row.form_question_id, question.form_question_options.filter(option => ids.includes(option.question_option_id)).map(option => option.label)]
      }
      const selected = row.form_question_options as { value: string } | Array<{ value: string }> | null
      const selectedValue = Array.isArray(selected) ? selected[0]?.value : selected?.value
      return [row.form_question_id, selectedValue ?? row.value_text ?? row.value_number ?? row.value_boolean ?? row.value_date ?? null]
    })) as Record<string, FormAnswerValue>

    return {
      submissionId: submission.form_submission_id,
      status: submission.status as FormSubmission['status'],
      updatedAt: submission.updated_at as string,
      name: definition.name as string,
      code: definition.code as string,
      versionNumber: version.version_number as number,
      questions,
      answers,
    }
  }

  async function addQuestion(
    versionId: string,
    input: Pick<FormQuestion, 'code' | 'label' | 'help_text' | 'data_type' | 'is_required' | 'display_config'>,
    optionLabels: string[] = [],
  ) {
    const { data: current, error: readError } = await client
      .from('form_questions')
      .select('position')
      .eq('form_version_id', versionId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (readError) throw readError

    const { data, error } = await client
      .from('form_questions')
      .insert({
        form_version_id: versionId,
        code: input.code,
        label: input.label,
        help_text: input.help_text,
        data_type: input.data_type,
        is_required: input.is_required,
        is_system: false,
        is_active: true,
        position: (current?.position ?? 0) + 1,
        display_config: input.display_config,
      })
      .select('form_question_id')
      .single()
    if (error) throw error
    const options = optionLabels.filter(label => label.trim()).map(label => label.trim())
    let insertedOptions: Array<{ question_option_id: string; value: string; label: string; position: number }> = []
    if (options.length) {
      const { data: optionRows, error: optionError } = await client.from('form_question_options').insert(options.map((label, index) => ({
        form_question_id: data.form_question_id, value: label, label, position: index + 1,
      }))).select('question_option_id, value, label, position')
      if (optionError) throw optionError
      insertedOptions = optionRows ?? []
    }
    return { id: data.form_question_id as string, options: insertedOptions }
  }

  async function removeQuestion(versionId: string, questionId: string) {
    const { data: question, error: readError } = await client
      .from('form_questions')
      .select('is_system')
      .eq('form_version_id', versionId)
      .eq('form_question_id', questionId)
      .single()
    if (readError) throw readError
    if (question.is_system) throw new Error('Las preguntas vinculadas al estudiante no se pueden eliminar.')

    const { error } = await client
      .from('form_questions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('form_version_id', versionId)
      .eq('form_question_id', questionId)
      .eq('is_system', false)
    if (error) throw error
  }

  return { ensureStandardForms, listFormTemplates, createFormTemplate, deactivateFormTemplate, resetDefaultTemplates, loadForm, saveDraft, submit, markReviewed, reopenSubmission, loadOwnSubmission, addQuestion, removeQuestion }
}
