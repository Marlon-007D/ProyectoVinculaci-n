export type AcademicContentKind = 'news' | 'event' | 'honor' | 'period'
export type AcademicPublicationStatus = 'draft' | 'published'
export type HonorCategory = 'official' | 'institutional'

export interface AcademicContentEntry {
  id: string
  institutionId: string
  kind: AcademicContentKind
  title: string
  description: string
  periodId: string
  status: AcademicPublicationStatus
  date: string
  location: string
  studentName: string
  grade: string
  distinction: string
  honorCategory?: HonorCategory
  officialOrder?: number
  schedule?: string
  modality?: string
  campus?: string
  isDemo?: boolean
  startDate: string
  endDate: string
  isCurrent: boolean
  sourceName?: string
  sourceUrl?: string
  imageUrl?: string
  author?: string
  updatedAt: string
}
