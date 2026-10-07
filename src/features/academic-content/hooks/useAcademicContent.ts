import { useState } from 'react'
import type { AcademicContentEntry } from '../types/academicContent.types'
import { deleteAcademicContent, getAcademicContent, saveAcademicContent } from '../services/academicContentStorage'

export function useAcademicContent() {
  const [entries, setEntries] = useState<AcademicContentEntry[]>(getAcademicContent)

  const save = (entry: AcademicContentEntry) => setEntries(saveAcademicContent(entry))
  const remove = (id: string) => setEntries(deleteAcademicContent(id))

  return { entries, save, remove }
}
