import { useCallback, useEffect, useState } from 'react'
import { useTenant } from '../../../core/TenantContext'
import type { SchoolSubject } from '../types/courseCatalog.types'
import { getSchoolCourses, subscribeToSchoolCourses } from '../services/schoolCourseStore'

export function useSchoolCourses() {
  const { activeInstitution } = useTenant()
  const institutionId = activeInstitution?.institution_id
  const [courses, setCourses] = useState<SchoolSubject[]>([])
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    if (!institutionId) { setCourses([]); return }
    try { setCourses(await getSchoolCourses(institutionId)); setError(null) }
    catch { setError('No se pudieron cargar los cursos desde la base de datos.') }
  }, [institutionId])

  useEffect(() => {
    void reload()
    return subscribeToSchoolCourses(() => { void reload() })
  }, [reload])

  return { courses, loading: Boolean(institutionId) && !error && courses.length === 0, error, reload, institutionId }
}
