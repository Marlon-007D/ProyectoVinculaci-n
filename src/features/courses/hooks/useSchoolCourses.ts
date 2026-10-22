import { useCallback, useEffect, useState } from 'react'
import { useTenant } from '../../../core/TenantContext'
import type { SchoolSubject } from '../types/courseCatalog.types'
import { getSchoolCourses, subscribeToSchoolCourses } from '../services/schoolCourseStore'

export function useSchoolCourses() {
  const { activeInstitution } = useTenant()
  const institutionId = activeInstitution?.institution_id
  const [courses, setCourses] = useState<SchoolSubject[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    if (!institutionId) { setCourses([]); setError(null); setLoading(false); return }
    setLoading(true)
    try { setCourses(await getSchoolCourses(institutionId)); setError(null) }
    catch { setError('No se pudieron cargar los cursos desde la base de datos.') }
    finally { setLoading(false) }
  }, [institutionId])

  useEffect(() => {
    void reload()
    return subscribeToSchoolCourses(() => { void reload() })
  }, [reload])

  return { courses, loading, error, reload, institutionId }
}
