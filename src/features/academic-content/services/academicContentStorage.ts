import { sampleAcademicContent } from '../mocks/academicContentMock'
import type { AcademicContentEntry } from '../types/academicContent.types'

const storageKey = 'simulaedu.academic-content.v1'
const newsSeedMigrationKey = `${storageKey}.news-sources-v3`

export function getAcademicContent(): AcademicContentEntry[] {
  try {
    const value = localStorage.getItem(storageKey)
    if (!value) return sampleAcademicContent.map(entry => ({ ...entry }))
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return sampleAcademicContent.map(entry => ({ ...entry }))
    let entries = parsed as AcademicContentEntry[]
    if (!localStorage.getItem(newsSeedMigrationKey)) {
      const puertoLimonSeeds = sampleAcademicContent.filter(entry => entry.institutionId === 'ue-rio-guayas' && (entry.kind === 'news' || entry.kind === 'period'))
      const seedById = new Map(puertoLimonSeeds.map(entry => [entry.id, entry]))
      entries = entries
        .filter(entry => !['news-pl-tutoring', 'news-pl-polling-place-2023'].includes(entry.id))
        .map(entry => {
          const seed = seedById.get(entry.id)
          return seed?.kind === 'news' && entry.kind === 'news'
            ? { ...entry, date: seed.date, periodId: seed.periodId }
            : entry
        })
      const existingIds = new Set(entries.map(entry => entry.id))
      entries = [...puertoLimonSeeds.filter(entry => !existingIds.has(entry.id)), ...entries]
      localStorage.setItem(storageKey, JSON.stringify(entries))
      localStorage.setItem(newsSeedMigrationKey, 'complete')
    }
    return entries
  } catch {
    return sampleAcademicContent.map(entry => ({ ...entry }))
  }
}

export function saveAcademicContent(entry: AcademicContentEntry): AcademicContentEntry[] {
  const entries = getAcademicContent()
  const updatedAt = new Date().toISOString()
  const saved = { ...entry, updatedAt }
  const next = entries.map(current => current.id === entry.id ? saved : current)
  if (!entries.some(current => current.id === entry.id)) next.unshift(saved)

  if (entry.kind === 'period' && entry.isCurrent) {
    return persist(next.map(current => current.kind === 'period' && current.institutionId === entry.institutionId && current.id !== entry.id
      ? { ...current, isCurrent: false }
      : current))
  }
  return persist(next)
}

export function deleteAcademicContent(id: string): AcademicContentEntry[] {
  const entry = getAcademicContent().find(current => current.id === id)
  if (entry?.kind === 'period' && entry.isCurrent) throw new Error('Cambia el período vigente antes de eliminarlo.')
  return persist(getAcademicContent().filter(current => current.id !== id))
}

function persist(entries: AcademicContentEntry[]): AcademicContentEntry[] {
  localStorage.setItem(storageKey, JSON.stringify(entries))
  return entries
}
