import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'

export const OFFICIAL_DISTINCTIONS = [
  'Abanderado del Pabellón Nacional',
  'Portaestandarte de la ciudad o cantón',
  'Portaestandarte del plantel',
  'Primer escolta del Pabellón Nacional',
  'Segundo escolta del Pabellón Nacional',
  'Primer escolta del estandarte de la ciudad o cantón',
  'Segundo escolta del estandarte de la ciudad o cantón',
  'Primer escolta del estandarte del plantel',
  'Segundo escolta del estandarte del plantel',
] as const

export function getHonorCategory(entry: AcademicContentEntry): 'official' | 'institutional' {
  if (entry.honorCategory) return entry.honorCategory
  return OFFICIAL_DISTINCTIONS.includes(entry.distinction as typeof OFFICIAL_DISTINCTIONS[number]) ? 'official' : 'institutional'
}

export function getOfficialProcessKey(entry: Pick<AcademicContentEntry, 'periodId' | 'campus'>) {
  return [entry.periodId, entry.campus?.trim().toLocaleLowerCase() ?? ''].join('|')
}

export function sortOfficialDistinctions<T extends Pick<AcademicContentEntry, 'distinction' | 'officialOrder'>>(entries: T[]) {
  return [...entries].sort((a, b) => {
    const orderA = a.officialOrder ?? OFFICIAL_DISTINCTIONS.indexOf(a.distinction as typeof OFFICIAL_DISTINCTIONS[number]) + 1
    const orderB = b.officialOrder ?? OFFICIAL_DISTINCTIONS.indexOf(b.distinction as typeof OFFICIAL_DISTINCTIONS[number]) + 1
    return (orderA || Number.MAX_SAFE_INTEGER) - (orderB || Number.MAX_SAFE_INTEGER)
  })
}
