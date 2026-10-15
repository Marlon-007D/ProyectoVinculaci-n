import { createContext, useContext, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Student } from '../types/student'

export type DeceDataIntegration = {
  client: SupabaseClient
  institutionId: string
  getStudentId: (student: Student) => string | null
}

const DeceDataContext = createContext<DeceDataIntegration | null>(null)

export function DeceDataProvider({
  value,
  children,
}: {
  value: DeceDataIntegration
  children: ReactNode
}) {
  return <DeceDataContext.Provider value={value}>{children}</DeceDataContext.Provider>
}

export function useDeceData() {
  return useContext(DeceDataContext)
}
