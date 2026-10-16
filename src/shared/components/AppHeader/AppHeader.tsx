import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import './AppHeader.css'

export interface BreadcrumbItem { label: string; onClick?: () => void }
interface Props { breadcrumbs?: BreadcrumbItem[]; navigation?: ReactNode; mobileVisible?: boolean }

export function AppHeader({ breadcrumbs = [], navigation, mobileVisible = true }: Props) {
  return <header className={`topbar${mobileVisible ? '' : ' is-hidden-mobile'}`}>
    {breadcrumbs.length > 0 && <nav className="topbar-breadcrumbs" aria-label="Migas de pan">{breadcrumbs.map((item, index) => <span className="topbar-breadcrumb-item" key={`${item.label}-${index}`}>{index > 0 && <ChevronRight size={15} aria-hidden="true" />}{item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}</span>)}</nav>}
    {navigation}
  </header>
}
