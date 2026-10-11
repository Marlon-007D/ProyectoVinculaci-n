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
  display_config: { section?: string }
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

/**
 * Servicio del módulo. Recibe el cliente autenticado del contenedor de la app
 * y nunca crea una sesión propia; así reutiliza la autenticación del equipo.
 */
export function createDeceFormService(client: SupabaseClient) {
  async function loadForm(institutionId: string, code: string, studentId: string) {
    const { data: definition, error: definitionError } = await client
      .from('form_definitions')
      .select('form_definition_id, name, form_versions(form_version_id, version_number, status, created_at)')
      .eq('institution_id', institutionId)
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (definitionError) throw definitionError
    if (!definition) throw new Error(`No existe la ficha activa «${code}» para esta institución.`)

    const versions = (definition.form_versions ?? []) as Array<{
      form_version_id: string
      version_number: number
      status: 'draft' | 'published' | 'retired'
      created_at: string
    }>
    const version = versions
      .filter(item => item.status === 'published' || item.status === 'draft')
      .sort((left, right) => right.version_number - left.version_number)[0]

    if (!version) throw new Error(`La ficha «${code}» todavía no tiene una versión publicada.`)

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
        const selected = row.form_question_options as { value: string } | null
        return [row.form_question_id, selected?.value ?? value ?? null]
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
    let currentSubmissionId = submissionId

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

    const { error: submissionError } = await client
      .from('form_submissions')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('form_submission_id', currentSubmissionId)
      .eq('student_id', studentId)

    if (submissionError) throw submissionError
    return currentSubmissionId
  }

  async function addQuestion(
    versionId: string,
    input: Pick<FormQuestion, 'code' | 'label' | 'help_text' | 'data_type' | 'is_required' | 'display_config'>,
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
    return data.form_question_id as string
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

  return { loadForm, saveDraft, addQuestion, removeQuestion }
}
