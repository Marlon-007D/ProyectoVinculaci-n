import { ArrowLeftRight, Award, BarChart3, BookOpen, CalendarDays, CalendarRange, Calculator, ChevronDown, GraduationCap, Newspaper, PanelLeftClose, PanelLeftOpen, ReceiptText } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppRoute, SimulatorRoute } from '../../../app/router/AppRouter'
import { ThemeUser } from '../../../features/themeUser/components/ThemeUser'
import { schoolModulesMock } from '../../../features/courses/mocks/schoolModulesMock'
import type { ThemeName } from '../../../features/themeUser/types/themeUser.types'
import './Sidebar.css'

interface Props { active: AppRoute; activeModuleId: string | null; collapsed: boolean; theme: ThemeName; onThemeChange: (theme: ThemeName, origin: { x: number; y: number }) => void; onSelect: (route: AppRoute) => void; onSelectModule: (moduleId: string) => void; onToggle: () => void }
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
type Group = 'courses' | 'reports'
type Subgroup = 'school-courses' | 'simulators' | 'publications' | null

export function Sidebar({ active, activeModuleId, collapsed, theme, onThemeChange, onSelect, onSelectModule, onToggle }: Props) {
  const [openGroup, setOpenGroup] = useState<Group | null>(null)
  const [openSubgroup, setOpenSubgroup] = useState<Subgroup>(null)
  const [themeOpen, setThemeOpen] = useState(false)
  useEffect(() => {
    if (active === 'invoice' || active === 'converter' || active === 'interest') {
      setOpenGroup('courses')
      setOpenSubgroup('simulators')
      return
    }
    if (active === 'school-courses') {
      setOpenGroup('courses')
      return
    }
    if (active === 'news' || active === 'events' || active === 'honors' || active === 'academic-periods') {
      setOpenGroup('reports')
      setOpenSubgroup('publications')
      return
    }
    setOpenSubgroup(null)
  }, [active])
  const toggleGroup = (group: Group) => {
    if (collapsed) onToggle()
    setThemeOpen(false)
    setOpenSubgroup(null)
    setOpenGroup(current => current === group ? null : group)
  }
  const toggleSubgroup = (group: Subgroup) => {
    if (collapsed) onToggle()
    setThemeOpen(false)
    setOpenSubgroup(current => current === group ? null : group)
  }
  const toggleTheme = () => {
    setOpenSubgroup(null)
    setThemeOpen(open => !open)
  }
  const renderNavGroup = (group: Group, label: string, Icon: typeof ReceiptText, children: ReactNode) => <div className={`nav-group${openGroup === group ? ' is-open' : ''}`}>
    <button className="nav-group-toggle" type="button" aria-expanded={openGroup === group} onClick={() => toggleGroup(group)}>
      <Icon size={20} />{!collapsed && <><span>{label}</span><ChevronDown className="nav-group-chevron" size={17} /></>}
    </button>
    {openGroup === group && <div className="nav-group-items">{children}</div>}
  </div>

  const selectRoute = (route: AppRoute) => {
    onSelect(route)
  }
  const openCoursesPage = () => {
    onSelect('school-courses')
  }
  const activeMobileTab = active === 'school-courses' ? 'courses' : (['simulator-hub', 'invoice', 'converter', 'interest'] as AppRoute[]).includes(active) ? 'simulators' : (['reports-hub', 'news', 'events', 'honors', 'academic-periods'] as AppRoute[]).includes(active) ? 'reports' : null
  return <>
  <aside className={collapsed ? 'sidebar is-collapsed' : 'sidebar'} aria-label="Navegación principal">
    <div className="brand">{!collapsed && <><div className="brand-mark"><ReceiptText size={21} /></div><span>SimulaEdu</span></>}<button className="icon-button collapse-button" onClick={onToggle} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button></div>
    <nav className="sidebar-navigation" aria-label="Secciones">
      {renderNavGroup('courses', 'Cursos', BookOpen, <>
        <div className={`nav-group nested-nav-group${openSubgroup === 'school-courses' ? ' is-open' : ''}`}>
          <button className="nav-group-toggle" type="button" aria-expanded={openSubgroup === 'school-courses'} onClick={() => toggleSubgroup('school-courses')}><GraduationCap size={19} />{!collapsed && <><span>Módulos</span><ChevronDown className="nav-group-chevron" size={16} /></>}</button>
      {openSubgroup === 'school-courses' && <div className="nav-group-items sidebar-course-list">{schoolModulesMock.map(module => <button key={module.id} data-tooltip={module.name} className={activeModuleId === module.id ? 'nav-item active' : 'nav-item'} onClick={() => onSelectModule(module.id)} aria-label={module.name}><BookOpen size={17} />{!collapsed && <span>{module.name}</span>}</button>)}</div>}
        </div>
        <div className={`nav-group nested-nav-group${openSubgroup === 'simulators' ? ' is-open' : ''}`}>
        <button className="nav-group-toggle" type="button" aria-expanded={openSubgroup === 'simulators'} onClick={() => toggleSubgroup('simulators')}><Calculator size={19} />{!collapsed && <><span>Simuladores</span><ChevronDown className="nav-group-chevron" size={16} /></>}</button>
        {openSubgroup === 'simulators' && <div className="nav-group-items">{items.map(({ id, label, Icon: ItemIcon }) => <button key={id} data-tooltip={label} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => selectRoute(id)} aria-label={label}><ItemIcon size={19} />{!collapsed && <span>{label}</span>}</button>)}</div>}
      </div></>)}
      {renderNavGroup('reports', 'Reportes', BarChart3, <div className={`nav-group nested-nav-group${openSubgroup === 'publications' ? ' is-open' : ''}`}>
        <button className="nav-group-toggle" type="button" aria-expanded={openSubgroup === 'publications'} onClick={() => toggleSubgroup('publications')}><Newspaper size={19} />{!collapsed && <><span>Publicaciones</span><ChevronDown className="nav-group-chevron" size={16} /></>}</button>
        {openSubgroup === 'publications' && <div className="nav-group-items publication-items">{publications.map(({ id, label, Icon: ItemIcon }) => <button key={id} data-tooltip={label} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => selectRoute(id)} aria-label={label}><ItemIcon size={19} />{!collapsed && <span>{label}</span>}</button>)}</div>}
      </div>)}
    </nav>
    <ThemeUser theme={theme} collapsed={collapsed} open={themeOpen} onChange={onThemeChange} onToggle={toggleTheme} />
  </aside>
  <nav className="mobile-bottom-navigation" aria-label="Navegación principal móvil">
    <button type="button" className={activeMobileTab === 'courses' ? 'is-active' : ''} onClick={openCoursesPage}><BookOpen size={18} /><span>Cursos</span></button>
    <button type="button" className={activeMobileTab === 'simulators' ? 'is-active' : ''} onClick={() => selectRoute('simulator-hub')}><Calculator size={18} /><span>Simuladores</span></button>
    <button type="button" className={activeMobileTab === 'reports' ? 'is-active' : ''} onClick={() => selectRoute('reports-hub')}><BarChart3 size={18} /><span>Reportes</span></button>
  </nav>
  </>
}
