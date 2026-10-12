export type AcademicContentKind = 'news' | 'event' | 'honor' | 'period'
export type AcademicPublicationStatus = 'draft' | 'published'

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
  startDate: string
  endDate: string
  isCurrent: boolean
  sourceName?: string
  sourceUrl?: string
  updatedAt: string
}
