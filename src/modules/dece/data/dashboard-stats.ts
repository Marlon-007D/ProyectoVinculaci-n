import type { SummaryIcon } from '../types/icons'

export type DashboardStat = {
  icon: SummaryIcon
  label: string
  value: string
  hint: string
  tone: string
}

export const dashboardStats: DashboardStat[] = [
  { icon: 'students',
    label: 'Estudiantes registrados',
    value: '128',
    hint: 'En el periodo lectivo',
    tone: 'violet' },
  { icon: 'forms', label: 'Fichas generales', value: '112', hint: '87% completadas', tone: 'green' },
  { icon: 'authorizations', label: 'Autorizaciones', value: '96', hint: '75% completadas', tone: 'orange' },
  { icon: 'follow-ups', label: 'Seguimientos', value: '08', hint: 'Esta semana', tone: 'blue' },
]
