import { sampleAcademicContent } from '../mocks/academicContentMock'
import type { AcademicContentEntry } from '../types/academicContent.types'
import { tenantInstitution } from '../../../core/config/tenant'
import { getHonorCategory, getOfficialProcessKey, OFFICIAL_DISTINCTIONS } from '../../honors/utils/honorRules'

const storageKey = 'simulaedu.academic-content.v1'
const tenantMigrationKey = tenantInstitution.id === 'ue-rio-guayas' ? '' : `:${tenantInstitution.id}`
const newsSeedMigrationKey = `${storageKey}.news-sources-v3${tenantMigrationKey}`
const draftSeedMigrationKey = `${storageKey}.publication-drafts-v2${tenantMigrationKey}`
const legacyHonorCleanupKey = `${storageKey}.legacy-honor-cleanup-v1${tenantMigrationKey}`
const officialHonorDemoSeedKey = `${storageKey}.official-honor-demo-v1${tenantMigrationKey}`
const legacyHonorSeedIds = new Set([
  'honor-pl-sofia', 'honor-pl-mateo', 'honor-pl-valentina', 'honor-pl-joaquin',
  'honor-pl-camila', 'honor-pl-andres', 'honor-pl-isabella', 'honor-pl-david', 'honor-pl-luciana',
])

export function getAcademicContent(): AcademicContentEntry[] {
  try {
    const value = localStorage.getItem(storageKey)
    if (!value) {
      localStorage.setItem(officialHonorDemoSeedKey, 'complete')
      return sampleAcademicContent.map(entry => ({ ...entry }))
    }
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return sampleAcademicContent.map(entry => ({ ...entry }))
    let entries = (parsed as AcademicContentEntry[]).filter(entry => entry.institutionId === tenantInstitution.id)
    if (!localStorage.getItem(legacyHonorCleanupKey)) {
      // Remove only known demonstration rows; preserve all manually registered honors.
      entries = entries.filter(entry => !legacyHonorSeedIds.has(entry.id))
      persist(entries)
      localStorage.setItem(legacyHonorCleanupKey, 'complete')
    }
    if (!localStorage.getItem(officialHonorDemoSeedKey)) {
      const demoHonors = sampleAcademicContent.filter(entry => entry.kind === 'honor' && entry.isDemo)
      const existingIds = new Set(entries.map(entry => entry.id))
      entries = [...entries, ...demoHonors.filter(entry => !existingIds.has(entry.id))]
      persist(entries)
      localStorage.setItem(officialHonorDemoSeedKey, 'complete')
    }
    if (!localStorage.getItem(newsSeedMigrationKey)) {
      const puertoLimonSeeds = sampleAcademicContent.filter(entry => entry.institutionId === tenantInstitution.id && (entry.kind === 'news' || entry.kind === 'period'))
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
      persist(entries)
      localStorage.setItem(newsSeedMigrationKey, 'complete')
    }
    if (!localStorage.getItem(draftSeedMigrationKey)) {
      const draftSeeds = sampleAcademicContent.filter(entry => entry.institutionId === tenantInstitution.id && (entry.kind === 'news' || entry.kind === 'event') && entry.status === 'draft')
      const existingIds = new Set(entries.map(entry => entry.id))
      entries = [...draftSeeds.filter(entry => !existingIds.has(entry.id)), ...entries]
      persist(entries)
      localStorage.setItem(draftSeedMigrationKey, 'complete')
    }
    return entries
  } catch {
    return sampleAcademicContent.map(entry => ({ ...entry }))
  }
}

export function saveAcademicContent(entry: AcademicContentEntry): AcademicContentEntry[] {
  const entries = getAcademicContent()
  const updatedAt = new Date().toISOString()
  const saved = { ...entry, institutionId: tenantInstitution.id, updatedAt }
  if (saved.kind === 'honor') validateHonor(saved, entries)
  const next = entries.map(current => current.id === entry.id ? saved : current)
  if (!entries.some(current => current.id === entry.id)) next.unshift(saved)

  if (saved.kind === 'period' && saved.isCurrent) {
    return persist(next.map(current => current.kind === 'period' && current.institutionId === tenantInstitution.id && current.id !== saved.id
      ? { ...current, isCurrent: false }
      : current))
  }
  return persist(next)
}

function validateHonor(entry: AcademicContentEntry, entries: AcademicContentEntry[]) {
  if (getHonorCategory(entry) !== 'official') return
  if (!OFFICIAL_DISTINCTIONS.includes(entry.distinction as typeof OFFICIAL_DISTINCTIONS[number])) throw new Error('Selecciona una de las nueve distinciones oficiales.')
  if (entry.grade.trim().toLocaleLowerCase() !== 'tercero de bachillerato') throw new Error('Las distinciones oficiales solo se asignan a estudiantes de tercero de Bachillerato.')
  if (!entry.periodId || !entry.schedule?.trim() || !entry.modality?.trim()) throw new Error('Completa el período lectivo, la jornada y la modalidad.')

  const duplicate = entries.find(current => current.kind === 'honor' && current.id !== entry.id && getHonorCategory(current) === 'official' && getOfficialProcessKey(current) === getOfficialProcessKey(entry) && (current.distinction === entry.distinction || current.studentName.trim().toLocaleLowerCase() === entry.studentName.trim().toLocaleLowerCase()))
  if (duplicate) {
    const reason = duplicate.distinction === entry.distinction ? 'Esta distinción ya está asignada en el mismo proceso.' : 'Este estudiante ya tiene una distinción oficial en el mismo proceso.'
    throw new Error(reason)
  }
}

export function deleteAcademicContent(id: string): AcademicContentEntry[] {
  const entry = getAcademicContent().find(current => current.id === id)
  if (entry?.kind === 'period' && entry.isCurrent) throw new Error('Cambia el período vigente antes de eliminarlo.')
  return persist(getAcademicContent().filter(current => current.id !== id))
}

function persist(entries: AcademicContentEntry[]): AcademicContentEntry[] {
  const value = localStorage.getItem(storageKey)
  const stored: unknown = value ? JSON.parse(value) : []
  const otherTenantEntries = Array.isArray(stored)
    ? (stored as AcademicContentEntry[]).filter(entry => entry.institutionId !== tenantInstitution.id)
    : []
  const tenantEntries = entries.filter(entry => entry.institutionId === tenantInstitution.id)
  localStorage.setItem(storageKey, JSON.stringify([...otherTenantEntries, ...tenantEntries]))
  window.dispatchEvent(new CustomEvent('academic-content-updated'))
  return tenantEntries
}
