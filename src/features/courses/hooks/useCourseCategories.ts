import { useCallback, useEffect, useState } from 'react'
import { useTenant } from '../../../core/TenantContext'
import type { SchoolModule } from '../types/courseCatalog.types'
import { getCourseCategories, subscribeToCourseCategories } from '../services/courseCategoriesStore'

export function useCourseCategories(publicInstitutionId?: string) {
  const { activeInstitution } = useTenant()
  const institutionId = publicInstitutionId ?? activeInstitution?.institution_id
  const [categories, setCategories] = useState<SchoolModule[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    if (!institutionId) { setCategories([]); setError(null); setLoading(false); return }
    setLoading(true)
    try { setCategories(await getCourseCategories(institutionId)); setError(null) }
    catch { setError('No se pudieron cargar las categorías desde la base de datos.') }
    finally { setLoading(false) }
  }, [institutionId])

  useEffect(() => {
    void reload()
    return subscribeToCourseCategories(() => { void reload() })
  }, [reload])

  return { categories, loading, error, reload, institutionId }
}
