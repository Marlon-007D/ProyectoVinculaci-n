import type { SupabaseClient } from '@supabase/supabase-js'
import { publicSupabase } from '../../../core/supabase/publicClient'
import type { AcademicContentEntry, HonorCategory } from '../../academic-content/types/academicContent.types'

export interface HonorStudentOption {
  id: string
  name: string
  grade: string
}

interface HonorRow {
  honor_id: string
  institution_id: string
  academic_period_id: string
  student_id: string
  achievement: string
  score: number | string | null
  photo_url: string | null
  schedule: string | null
  honor_category: HonorCategory
  official_order: number | null
  modality: string | null
  campus: string | null
  status: 'draft' | 'published'
  updated_at: string
}

interface PeriodRow {
  academic_period_id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  updated_at: string
}

interface StudentRow {
  student_id: string
  first_name: string
  last_name: string
  grade_level: string | null
}

interface PublicHonorRow {
  honor_id: string
  institution_id: string
  academic_period_id: string
  achievement: string
  photo_url: string | null
  student_name: string
  grade_level: string | null
  schedule: string | null
  honor_category: HonorCategory
  official_order: number | null
  modality: string | null
  campus: string | null
}

export function createOfficialDistinctionsRepository(client: SupabaseClient) {
  return {
    async list(institutionId: string) {
      const [honorsResult, periodsResult, studentsResult, publicHonorsResult] = await Promise.all([
        client.from('honors').select('honor_id,institution_id,academic_period_id,student_id,achievement,score,photo_url,schedule,honor_category,official_order,modality,campus,status,updated_at').eq('institution_id', institutionId).order('official_order', { ascending: true, nullsFirst: false }).order('updated_at', { ascending: false }),
        client.from('academic_periods').select('academic_period_id,name,start_date,end_date,is_active,updated_at').eq('institution_id', institutionId).order('start_date', { ascending: false }),
        client.from('students').select('student_id,first_name,last_name,grade_level').eq('institution_id', institutionId).order('last_name', { ascending: true }).order('first_name', { ascending: true }).limit(2000),
        publicSupabase.from('public_honors').select('honor_id,institution_id,academic_period_id,achievement,photo_url,student_name,grade_level,schedule,honor_category,official_order,modality,campus').eq('institution_id', institutionId).eq('honor_category', 'official').order('official_order', { ascending: true, nullsFirst: false }),
      ])
      if (periodsResult.error) throw periodsResult.error
      if (studentsResult.error) throw studentsResult.error
      // A failed query must never look like an empty board: log the real message and report it to the caller.
      const errors = ([['honors', honorsResult.error], ['public_honors', publicHonorsResult.error]] as const)
        .flatMap(([source, error]) => error ? [`${source}: ${error.message}`] : [])
      errors.forEach(message => console.error('[cuadro de honor]', message))
      if (honorsResult.error && publicHonorsResult.error) throw honorsResult.error

      const students = (studentsResult.data ?? []) as StudentRow[]
      const studentById = new Map(students.map(student => [student.student_id, student]))
      const honors = (honorsResult.data ?? []) as HonorRow[]
      const publicHonors = (publicHonorsResult.data ?? []) as PublicHonorRow[]
      const honorEntries = honors.length > 0
        ? honors.map(row => toHonorEntry(row, studentById.get(row.student_id)))
        : publicHonors.map(row => toPublicHonorEntry(row, students))
      const periods = (periodsResult.data ?? []) as PeriodRow[]
      return {
        entries: honorEntries,
        periods: periods.map(row => toPeriodEntry(row, institutionId)),
        students: students.map(toStudentOption),
        diagnostics: { institutionId, honors: honors.length, publicHonors: publicHonors.length, periods: periods.length, students: students.length, errors },
      }
    },

    async save(entry: AcademicContentEntry, institutionId: string) {
      if (!entry.studentId) throw new Error('Selecciona un estudiante registrado en la institución.')
      if (!entry.periodId) throw new Error('Selecciona un período lectivo registrado.')
      const payload = {
        honor_id: entry.id,
        institution_id: institutionId,
        academic_period_id: entry.periodId,
        student_id: entry.studentId,
        achievement: entry.distinction.trim(),
        score: null,
        photo_url: entry.imageUrl ?? null,
        schedule: entry.schedule?.trim() || null,
        honor_category: entry.honorCategory ?? 'institutional',
        official_order: entry.honorCategory === 'official' ? entry.officialOrder ?? null : null,
        modality: entry.honorCategory === 'official' ? entry.modality?.trim() || null : null,
        campus: entry.honorCategory === 'official' ? entry.campus?.trim() || null : null,
        // The honor board has no draft workflow: everything saved is published, as the public view requires.
        status: 'published' as const,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await client.from('honors').upsert(payload, { onConflict: 'honor_id' }).select('honor_id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No se guardó la distinción. Verifica el permiso para editar reconocimientos de esta institución.')
      return { ...entry, institutionId, title: 'Distinción oficial', status: 'published' as const, updatedAt: payload.updated_at }
    },

    async remove(id: string, institutionId: string) {
      const { data, error } = await client.from('honors').delete().eq('honor_id', id).eq('institution_id', institutionId).select('honor_id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('No se encontró la distinción o no tienes permiso para eliminarla.')
    },
  }
}

function toPublicHonorEntry(row: PublicHonorRow, students: StudentRow[]): AcademicContentEntry {
  const matchingStudent = students.find(student => `${student.first_name} ${student.last_name}`.trim().localeCompare(row.student_name.trim(), 'es', { sensitivity: 'base' }) === 0)
  return {
    id: row.honor_id,
    institutionId: row.institution_id,
    kind: 'honor',
    title: 'Distinción oficial',
    description: '',
    periodId: row.academic_period_id,
    status: 'published',
    date: '',
    location: '',
    studentId: matchingStudent?.student_id,
    studentName: row.student_name,
    grade: row.grade_level ?? 'Tercero de Bachillerato',
    distinction: row.achievement,
    honorCategory: row.honor_category,
    officialOrder: row.official_order ?? undefined,
    schedule: row.schedule ?? undefined,
    modality: row.modality ?? undefined,
    campus: row.campus ?? undefined,
    imageUrl: row.photo_url ?? undefined,
    startDate: '',
    endDate: '',
    isCurrent: false,
    updatedAt: '',
  }
}

function toHonorEntry(row: HonorRow, student?: StudentRow): AcademicContentEntry {
  const category = row.honor_category ?? 'institutional'
  return {
    id: row.honor_id,
    institutionId: row.institution_id,
    kind: 'honor',
    title: 'Distinción oficial',
    description: '',
    periodId: row.academic_period_id,
    status: row.status,
    date: '',
    location: '',
    studentId: row.student_id,
    studentName: student ? `${student.first_name} ${student.last_name}`.trim() : 'Estudiante no disponible',
    grade: category === 'official' ? 'Tercero de Bachillerato' : student?.grade_level ?? '',
    distinction: row.achievement,
    honorCategory: category,
    officialOrder: row.official_order ?? undefined,
    schedule: row.schedule ?? undefined,
    modality: row.modality ?? undefined,
    campus: row.campus ?? undefined,
    imageUrl: row.photo_url ?? undefined,
    startDate: '',
    endDate: '',
    isCurrent: false,
    updatedAt: row.updated_at,
  }
}

function toPeriodEntry(row: PeriodRow, institutionId: string): AcademicContentEntry {
  return {
    id: row.academic_period_id,
    institutionId,
    kind: 'period',
    title: row.name,
    description: '',
    periodId: row.academic_period_id,
    status: 'published',
    date: '',
    location: '',
    studentName: '',
    grade: '',
    distinction: '',
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_active,
    updatedAt: row.updated_at,
  }
}

function toStudentOption(student: StudentRow): HonorStudentOption {
  return { id: student.student_id, name: `${student.first_name} ${student.last_name}`.trim(), grade: student.grade_level ?? '' }
}
