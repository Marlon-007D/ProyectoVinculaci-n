import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { ThemeUser } from '../../../features/themeUser/components/ThemeUser'
import type { ThemeName } from '../../../features/themeUser/types/themeUser.types'
import './AppHeader.css'

export interface BreadcrumbItem { label: string; onClick?: () => void }
interface Props { breadcrumbs?: BreadcrumbItem[]; navigation?: ReactNode; mobileVisible?: boolean; theme: ThemeName; onThemeChange: (theme: ThemeName, origin: { x: number; y: number }) => void }

export function AppHeader({ breadcrumbs = [], navigation, mobileVisible = true, theme, onThemeChange }: Props) {
  const [themeOpen, setThemeOpen] = useState(false)
  return <header className={`topbar${mobileVisible ? '' : ' is-hidden-mobile'}`}>
    {breadcrumbs.length > 0 && <nav className="topbar-breadcrumbs" aria-label="Migas de pan">{breadcrumbs.map((item, index) => <span className="topbar-breadcrumb-item" key={`${item.label}-${index}`}>{index > 0 && <ChevronRight size={15} aria-hidden="true" />}{item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}</span>)}</nav>}
    {navigation}
    <ThemeUser placement="topbar" theme={theme} collapsed={false} open={themeOpen} onChange={(nextTheme, origin) => { onThemeChange(nextTheme, origin); setThemeOpen(false) }} onToggle={() => setThemeOpen(open => !open)} />
  </header>
}
