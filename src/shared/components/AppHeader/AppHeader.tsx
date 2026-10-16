import { ChevronRight, CircleUserRound } from 'lucide-react'
import './AppHeader.css'

export interface BreadcrumbItem { label: string; onClick?: () => void }
interface Props { breadcrumbs?: BreadcrumbItem[] }

export function AppHeader({ breadcrumbs = [] }: Props) {
  return <header className="topbar">
    {breadcrumbs.length > 0 && <nav className="topbar-breadcrumbs" aria-label="Migas de pan">{breadcrumbs.map((item, index) => <span className="topbar-breadcrumb-item" key={`${item.label}-${index}`}>{index > 0 && <ChevronRight size={15} aria-hidden="true" />}{item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}</span>)}</nav>}
    <div className="student-chip"><CircleUserRound className="profile-icon" size={25} aria-hidden="true" /><p><b>Brigitte Rodríguez</b><small>Administradora</small></p></div>
  </header>
}
