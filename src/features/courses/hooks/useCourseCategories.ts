import { useCallback, useEffect, useState } from 'react'
import { useTenant } from '../../../core/TenantContext'
import type { SchoolModule } from '../types/courseCatalog.types'
import { getCourseCategories, subscribeToCourseCategories } from '../services/courseCategoriesStore'

export function useCourseCategories() {
  const { activeInstitution } = useTenant()
  const institutionId = activeInstitution?.institution_id
  const [categories, setCategories] = useState<SchoolModule[]>([])
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    if (!institutionId) { setCategories([]); return }
    try { setCategories(await getCourseCategories(institutionId)); setError(null) }
    catch { setError('No se pudieron cargar las categorías desde la base de datos.') }
  }, [institutionId])

  useEffect(() => {
    void reload()
    return subscribeToCourseCategories(() => { void reload() })
  }, [reload])

  return { categories, loading: Boolean(institutionId) && !error && categories.length === 0, error, reload, institutionId }
}
