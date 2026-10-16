import { Award, BarChart3, CalendarDays, CalendarRange, ChevronRight, Newspaper } from 'lucide-react'
import type { AppRoute } from '../../../app/router/AppRouter'
import './ReportsHubPage.css'

interface Props { onSelect?: (route: Extract<AppRoute, 'news' | 'events' | 'honors' | 'academic-periods'>) => void }

const reportOptions = [
  { id: 'news', label: 'Noticias', description: 'Novedades y comunicados institucionales.', Icon: Newspaper },
  { id: 'events', label: 'Eventos', description: 'Actividades y fechas de la comunidad.', Icon: CalendarDays },
  { id: 'honors', label: 'Cuadro de honor', description: 'Reconocimientos al desempeño estudiantil.', Icon: Award },
  { id: 'academic-periods', label: 'Período académico', description: 'Fechas y organización del período lectivo.', Icon: CalendarRange },
] as const

export function ReportsHubPage({ onSelect }: Props) {
  return <section className="page-content reports-hub-page">
    <header className="reports-hub-header"><span><BarChart3 size={18} /> Reportes</span><h1>Elige una sección</h1><p>Consulta la información institucional disponible.</p></header>
    <div className="reports-hub-list" aria-label="Secciones de reportes">{reportOptions.map(({ id, label, description, Icon }) => <button type="button" className="reports-hub-card" key={id} onClick={() => onSelect?.(id)}><span className="reports-hub-icon"><Icon size={21} /></span><span className="reports-hub-info"><strong>{label}</strong><span>{description}</span></span><ChevronRight size={18} /></button>)}</div>
  </section>
}
