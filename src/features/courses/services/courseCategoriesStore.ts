import { schoolModulesMock, type SchoolModule } from '../mocks/schoolModulesMock'

const storageKey = 'school-course-categories-v1'
const changeEvent = 'school-course-categories-change'

function isSchoolModule(value: unknown): value is SchoolModule {
  if (!value || typeof value !== 'object') return false
  const category = value as Partial<SchoolModule>
  return typeof category.id === 'string'
    && typeof category.name === 'string'
    && typeof category.description === 'string'
    && Array.isArray(category.courseIds)
    && category.courseIds.every(id => typeof id === 'string')
    && typeof category.icon === 'string'
    && typeof category.coverImage === 'string'
}

export function getCourseCategories(): SchoolModule[] {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return schoolModulesMock.map(category => ({ ...category, courseIds: [...category.courseIds] }))
    const parsed: unknown = JSON.parse(stored)
    if (Array.isArray(parsed) && parsed.every(isSchoolModule)) return parsed
  } catch {
    // Keep the public catalog available when browser storage is unavailable or invalid.
  }
  return schoolModulesMock.map(category => ({ ...category, courseIds: [...category.courseIds] }))
}

export function saveCourseCategories(categories: SchoolModule[]): void {
  window.localStorage.setItem(storageKey, JSON.stringify(categories))
  window.dispatchEvent(new Event(changeEvent))
}

export function subscribeToCourseCategories(onChange: () => void): () => void {
  window.addEventListener(changeEvent, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(changeEvent, onChange)
    window.removeEventListener('storage', onChange)
  }
}
