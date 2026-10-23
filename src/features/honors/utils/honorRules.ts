import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'

export const OFFICIAL_DISTINCTIONS = [
  'Abanderado del Pabellón Nacional',
  'Portaestandarte de la ciudad',
  'Portaestandarte del plantel',
  '1er. escolta del Pabellón Nacional',
  '2do. escolta del Pabellón Nacional',
  '1er. escolta del estandarte de la ciudad',
  '2do. escolta del estandarte de la ciudad',
  '1er. escolta del estandarte del plantel',
  '2do. escolta del estandarte del plantel',
] as const

export type OfficialFlagKind = 'national' | 'city' | 'institutional'

export function getOfficialFlagKind(value: string): OfficialFlagKind {
  const distinction = normalizeOfficialDistinction(value).toLocaleLowerCase('es-EC')
  if (distinction.includes('pabellón nacional')) return 'national'
  if (distinction.includes('ciudad')) return 'city'
  return 'institutional'
}

export function normalizeOfficialDistinction(value: string) {
  return value
    .replace(/ ciudad o cantón/gi, ' ciudad')
    .replace(/^primer escolta\b/i, '1er. escolta')
    .replace(/^segundo escolta\b/i, '2do. escolta')
}

export function getHonorCategory(entry: AcademicContentEntry): 'official' | 'institutional' {
  if (entry.honorCategory) return entry.honorCategory
  return OFFICIAL_DISTINCTIONS.includes(normalizeOfficialDistinction(entry.distinction) as typeof OFFICIAL_DISTINCTIONS[number]) ? 'official' : 'institutional'
}

export function getOfficialProcessKey(entry: Pick<AcademicContentEntry, 'periodId' | 'campus'>) {
  return [entry.periodId, entry.campus?.trim().toLocaleLowerCase() ?? ''].join('|')
}

export function sortOfficialDistinctions<T extends Pick<AcademicContentEntry, 'distinction' | 'officialOrder'>>(entries: T[]) {
  return [...entries].sort((a, b) => {
    const orderA = a.officialOrder ?? OFFICIAL_DISTINCTIONS.indexOf(normalizeOfficialDistinction(a.distinction) as typeof OFFICIAL_DISTINCTIONS[number]) + 1
    const orderB = b.officialOrder ?? OFFICIAL_DISTINCTIONS.indexOf(normalizeOfficialDistinction(b.distinction) as typeof OFFICIAL_DISTINCTIONS[number]) + 1
    return (orderA || Number.MAX_SAFE_INTEGER) - (orderB || Number.MAX_SAFE_INTEGER)
  })
}
