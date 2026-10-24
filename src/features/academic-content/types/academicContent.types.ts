export type AcademicContentKind = 'news' | 'event' | 'honor' | 'period'
export type AcademicPublicationStatus = 'draft' | 'published'
export type HonorCategory = 'official' | 'institutional'
export type AcademicContentBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'image'; src: string; alt: string; caption: string }

export interface AcademicContentSection {
  id: string
  title: string
  blocks: AcademicContentBlock[]
}

export interface AcademicContentEntry {
  id: string
  institutionId: string
  kind: AcademicContentKind
  title: string
  description: string
  periodId: string
  status: AcademicPublicationStatus
  date: string
  time?: string
  location: string
  studentId?: string
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
  sections?: AcademicContentSection[]
  updatedAt: string
}
