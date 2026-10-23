import type { AcademicContentSection } from '../types/academicContent.types'

const CONTENT_PREFIX = '__academic_content_v1__\n'

interface StoredNewsContent {
  description: string
  sections: AcademicContentSection[]
  periodId?: string
}

export function serializeNewsContent(description: string, sections: AcademicContentSection[] | undefined, periodId?: string): string {
  return `${CONTENT_PREFIX}${JSON.stringify({ description, sections: sections ?? [], periodId } satisfies StoredNewsContent)}`
}

export function parseNewsContent(content: string | null | undefined): StoredNewsContent {
  const fallback = { description: content ?? '', sections: [] }
  if (!content?.startsWith(CONTENT_PREFIX)) return fallback

  try {
    const parsed: unknown = JSON.parse(content.slice(CONTENT_PREFIX.length))
    if (!parsed || typeof parsed !== 'object') return fallback
    const value = parsed as Partial<StoredNewsContent>
    return {
      description: typeof value.description === 'string' ? value.description : '',
      sections: Array.isArray(value.sections) ? value.sections : [],
      periodId: typeof value.periodId === 'string' ? value.periodId : undefined,
    }
  } catch {
    return fallback
  }
}
