import { useEffect, useState } from 'react'
import type { AcademicContentEntry } from '../types/academicContent.types'
import { deleteAcademicContent, getAcademicContent, saveAcademicContent } from '../services/academicContentStorage'

export function useAcademicContent() {
  const [entries, setEntries] = useState<AcademicContentEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setEntries(getAcademicContent())
    setLoading(false)
  }, [])

  const save = (entry: AcademicContentEntry) => setEntries(saveAcademicContent(entry))
  const remove = (id: string) => setEntries(deleteAcademicContent(id))

  return { entries, loading, save, remove }
}
