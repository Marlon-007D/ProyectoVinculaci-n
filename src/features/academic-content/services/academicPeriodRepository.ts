import type { SupabaseClient } from '@supabase/supabase-js'

export interface AcademicPeriodOption {
  id: string
  title: string
  isCurrent: boolean
}

interface AcademicPeriodRow {
  academic_period_id: string
  name: string
  is_active: boolean
}

export interface AcademicPeriodRepository {
  list(institutionId: string): Promise<AcademicPeriodOption[]>
}

export function createAcademicPeriodRepository(client: SupabaseClient): AcademicPeriodRepository {
  return {
    async list(institutionId) {
      const { data, error } = await client
        .from('academic_periods')
        .select('academic_period_id,name,is_active,start_date')
        .eq('institution_id', institutionId)
        .order('is_active', { ascending: false })
        .order('start_date', { ascending: false })

      if (error) throw error

      return ((data ?? []) as AcademicPeriodRow[]).map(row => ({
        id: row.academic_period_id,
        title: row.name,
        isCurrent: row.is_active,
      }))
    },
  }
}
