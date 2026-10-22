import type { AcademicContentEntry, AcademicContentSection } from '../types/academicContent.types'

export function getAcademicContentSections(entry: AcademicContentEntry): AcademicContentSection[] {
  if (entry.sections !== undefined) return entry.sections

  const [, ...bodyParagraphs] = entry.description.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean)
  if (!bodyParagraphs.length) return []

  return [{
    id: `legacy-section-${entry.id}`,
    title: 'Contenido',
    blocks: bodyParagraphs.map((text, index) => ({ id: `legacy-paragraph-${index}`, type: 'paragraph', text })),
  }]
}
