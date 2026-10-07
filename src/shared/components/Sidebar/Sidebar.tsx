import { ArrowLeftRight, Award, CalendarDays, CalendarRange, Calculator, ChevronDown, Newspaper, PanelLeftClose, PanelLeftOpen, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import type { AppRoute, SimulatorRoute } from '../../../app/router/AppRouter'
import { ThemeUser } from '../../../features/themeUser/components/ThemeUser'
import type { ThemeName } from '../../../features/themeUser/types/themeUser.types'
import './Sidebar.css'

interface Props { active: AppRoute; collapsed: boolean; theme: ThemeName; onThemeChange: (theme: ThemeName) => void; onSelect: (route: AppRoute) => void; onToggle: () => void }
const items: { id: SimulatorRoute; label: string; Icon: typeof ReceiptText }[] = [
  { id: 'invoice', label: 'Facturación electrónica', Icon: ReceiptText },
  { id: 'converter', label: 'Unidades y monedas', Icon: ArrowLeftRight },
  { id: 'interest', label: 'Interés financiero', Icon: Calculator },
]
const publications: { id: Exclude<AppRoute, SimulatorRoute>; label: string; Icon: typeof ReceiptText }[] = [
  { id: 'news', label: 'Noticias', Icon: Newspaper },
  { id: 'events', label: 'Eventos', Icon: CalendarDays },
  { id: 'honors', label: 'Cuadro de honor', Icon: Award },
  { id: 'academic-periods', label: 'Período académico', Icon: CalendarRange },
]

export function Sidebar({ active, collapsed, theme, onThemeChange, onSelect, onToggle }: Props) {
  const [openGroup, setOpenGroup] = useState<'simulators' | 'publications' | null>('simulators')
  const [themeOpen, setThemeOpen] = useState(false)
  const toggleGroup = (group: 'simulators' | 'publications') => {
    if (collapsed) onToggle()
    setThemeOpen(false)
    setOpenGroup(current => current === group ? null : group)
  }
  const toggleTheme = () => {
    setOpenGroup(null)
    setThemeOpen(open => !open)
  }

  return <aside className={collapsed ? 'sidebar is-collapsed' : 'sidebar'} aria-label="Navegación principal">
    <div className="brand">{!collapsed && <><div className="brand-mark"><ReceiptText size={21} /></div><span>SimulaEdu</span></>}<button className="icon-button collapse-button" onClick={onToggle} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button></div>
    <nav className="sidebar-navigation" aria-label="Secciones">
      <div className={`nav-group${openGroup === 'simulators' ? ' is-open' : ''}`}>
        <button className="nav-group-toggle" type="button" aria-expanded={openGroup === 'simulators'} onClick={() => toggleGroup('simulators')}>
          <Calculator size={20} />{!collapsed && <><span>Simuladores</span><ChevronDown className="nav-group-chevron" size={17} /></>}
        </button>
        {openGroup === 'simulators' && <div className="nav-group-items">{items.map(({ id, label, Icon }) => <button key={id} data-tooltip={label} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => onSelect(id)} aria-label={label}><Icon size={19} />{!collapsed && <span>{label}</span>}</button>)}</div>}
      </div>
      <div className={`nav-group publications-group${openGroup === 'publications' ? ' is-open' : ''}`}>
        <button className="nav-group-toggle" type="button" aria-expanded={openGroup === 'publications'} onClick={() => toggleGroup('publications')}>
          <Newspaper size={20} />{!collapsed && <><span>Publicaciones</span><ChevronDown className="nav-group-chevron" size={17} /></>}
        </button>
        {openGroup === 'publications' && <div className="nav-group-items publication-items">{publications.map(({ id, label, Icon }) => <button key={id} data-tooltip={label} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => onSelect(id)} aria-label={label}><Icon size={19} />{!collapsed && <span>{label}</span>}</button>)}</div>}
      </div>
      <ThemeUser theme={theme} collapsed={collapsed} open={themeOpen} onChange={onThemeChange} onToggle={toggleTheme} />
    </nav>
  </aside>
}
