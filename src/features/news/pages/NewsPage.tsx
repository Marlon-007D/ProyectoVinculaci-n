import { AcademicContentManager } from '../../academic-content/components/AcademicContentManager'
import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'

export function NewsPage({ onPreview }: { onPreview: (entry: AcademicContentEntry) => void }) {
  return <AcademicContentManager kind="news" title="Noticias" singular="Noticia" onPreview={onPreview} />
}
