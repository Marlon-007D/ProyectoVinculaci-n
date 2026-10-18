import { useEffect, useState } from 'react'
import { getCourseCategories, subscribeToCourseCategories } from '../services/courseCategoriesStore'

export function useCourseCategories() {
  const [categories, setCategories] = useState(getCourseCategories)

  useEffect(() => subscribeToCourseCategories(() => setCategories(getCourseCategories())), [])

  return categories
}
