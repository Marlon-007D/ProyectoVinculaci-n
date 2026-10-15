import { AcademicContentManager } from '../../academic-content/components/AcademicContentManager'
import type { AcademicContentEntry } from '../../academic-content/types/academicContent.types'

export function EventsPage({ onPreview }: { onPreview: (entry: AcademicContentEntry) => void }) {
  return <AcademicContentManager kind="event" title="Eventos" singular="Evento" onPreview={onPreview} />
}
