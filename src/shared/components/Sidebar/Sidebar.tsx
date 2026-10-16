import { ArrowLeftRight, Atom, Award, BarChart3, BookOpen, CalendarDays, CalendarRange, Calculator, ChevronDown, GraduationCap, Laptop, Languages, Newspaper, Palette, PanelLeftClose, PanelLeftOpen, ReceiptText, Search, Sigma, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppRoute, SimulatorRoute } from '../../../app/router/AppRouter'
import { schoolModulesMock } from '../../../features/courses/mocks/schoolModulesMock'
import './Sidebar.css'

interface Props { active: AppRoute; activeModuleId: string | null; collapsed: boolean; onSelect: (route: AppRoute) => void; onSelectModule: (moduleId: string) => void; onToggle: () => void }
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
const moduleIcons = {
  matematica: Sigma,
  tecnologia: Laptop,
  'lengua-comunicacion': Languages,
  'ciencias-sociedad': Atom,
  'arte-desarrollo': Palette,
}
type Group = 'courses' | 'reports'
type Subgroup = 'school-courses' | 'simulators' | 'publications' | null

export function Sidebar({ active, activeModuleId, collapsed, onSelect, onSelectModule, onToggle }: Props) {
  const [openGroup, setOpenGroup] = useState<Group | null>(null)
  const [openSubgroup, setOpenSubgroup] = useState<Subgroup>(null)
  const [searchQuery, setSearchQuery] = useState('')
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
    if (collapsed) {
      onToggle()
      setOpenGroup(group)
      setOpenSubgroup(null)
      return
    }
    setOpenSubgroup(null)
    setOpenGroup(current => current === group ? null : group)
  }
  const toggleSubgroup = (group: Subgroup) => {
    if (collapsed) onToggle()
    setOpenSubgroup(current => current === group ? null : group)
  }
  const normalizeSearchText = (value: string) => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const normalizedQuery = normalizeSearchText(searchQuery.trim())
  const matches = (label: string) => normalizeSearchText(label).includes(normalizedQuery)
  const searching = normalizedQuery.length > 0
  const moduleMatchesLabel = matches('módulos') || matches('submódulos') || matches('cursos')
  const simulatorMatchesLabel = matches('simuladores')
  const publicationMatchesLabel = matches('publicaciones') || matches('reportes')
  const filteredModules = schoolModulesMock.filter(module => !searching || moduleMatchesLabel || matches(module.name))
  const filteredSimulators = items.filter(item => !searching || simulatorMatchesLabel || matches(item.label))
  const filteredPublications = publications.filter(item => !searching || publicationMatchesLabel || matches(item.label))
  const showModules = openSubgroup === 'school-courses' || (searching && filteredModules.length > 0)
  const showSimulators = openSubgroup === 'simulators' || (searching && filteredSimulators.length > 0)
  const showPublications = openSubgroup === 'publications' || (searching && filteredPublications.length > 0)
  const renderNavGroup = (group: Group, label: string, Icon: typeof ReceiptText, children: ReactNode, searchHasMatches: boolean) => {
    if (searching && !searchHasMatches) return null
    const isOpen = searching ? searchHasMatches : openGroup === group
    return <div className={`nav-group${isOpen ? ' is-open' : ''}`}>
    <button className="nav-group-toggle" type="button" aria-expanded={isOpen} onClick={() => toggleGroup(group)}>
      <Icon size={20} />{!collapsed && <><span>{label}</span><ChevronDown className="nav-group-chevron" size={17} /></>}
    </button>
    <div className={`nav-group-panel${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen} inert={!isOpen}>
      <div className="nav-group-panel-inner"><div className="nav-group-items">{children}</div></div>
    </div>
  </div>
  }

  const selectRoute = (route: AppRoute) => {
    onSelect(route)
  }
  const openCoursesPage = () => {
    onSelect('school-courses')
  }
  const activeMobileTab = active === 'school-courses' ? 'courses' : (['simulator-hub', 'invoice', 'converter', 'interest'] as AppRoute[]).includes(active) ? 'simulators' : (['reports-hub', 'news', 'events', 'honors', 'academic-periods'] as AppRoute[]).includes(active) ? 'reports' : null
  return <>
  <aside className={collapsed ? 'sidebar is-collapsed' : 'sidebar'} aria-label="Navegación principal">
    <div className="sidebar-search-row">
      {!collapsed ? <div className="sidebar-search"><Search size={18} aria-hidden="true" /><input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Buscar módulos" aria-label="Buscar módulos" />{searchQuery && <button className="sidebar-search-clear" type="button" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda"><X size={17} aria-hidden="true" /></button>}</div> : <button className="icon-button sidebar-search-expand" type="button" onClick={onToggle} aria-label="Expandir menú para buscar"><Search size={20} /></button>}
      <button className="icon-button collapse-button" onClick={onToggle} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button>
    </div>
    <nav className="sidebar-navigation" aria-label="Secciones">
      {renderNavGroup('courses', 'Cursos', BookOpen, <>
        {(!searching || filteredModules.length > 0) && <div className={`nav-group nested-nav-group${openSubgroup === 'school-courses' ? ' is-open' : ''}`}>
          <button className="nav-group-toggle" type="button" aria-expanded={showModules} onClick={() => toggleSubgroup('school-courses')}><GraduationCap size={19} />{!collapsed && <><span>Módulos</span><ChevronDown className="nav-group-chevron" size={16} /></>}</button>
      <div className={`nav-group-panel${showModules ? ' is-open' : ''}`} aria-hidden={!showModules} inert={!showModules}><div className="nav-group-panel-inner"><div className="nav-group-items sidebar-course-list">{filteredModules.map(module => { const ModuleIcon = moduleIcons[module.id as keyof typeof moduleIcons] ?? BookOpen; return <button key={module.id} data-tooltip={module.name} className={activeModuleId === module.id ? 'nav-item active' : 'nav-item'} onClick={() => onSelectModule(module.id)} aria-label={module.name}><ModuleIcon size={17} />{!collapsed && <span>{module.name}</span>}</button> })}</div></div></div>
        </div>}
        {(!searching || filteredSimulators.length > 0) && <div className={`nav-group nested-nav-group${showSimulators ? ' is-open' : ''}`}>
        <button className="nav-group-toggle" type="button" aria-expanded={showSimulators} onClick={() => toggleSubgroup('simulators')}><Calculator size={19} />{!collapsed && <><span>Simuladores</span><ChevronDown className="nav-group-chevron" size={16} /></>}</button>
        <div className={`nav-group-panel${showSimulators ? ' is-open' : ''}`} aria-hidden={!showSimulators} inert={!showSimulators}><div className="nav-group-panel-inner"><div className="nav-group-items">{filteredSimulators.map(({ id, label, Icon: ItemIcon }) => <button key={id} data-tooltip={label} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => selectRoute(id)} aria-label={label}><ItemIcon size={19} />{!collapsed && <span>{label}</span>}</button>)}</div></div></div>
      </div>}</>, filteredModules.length > 0 || filteredSimulators.length > 0)}
      {renderNavGroup('reports', 'Reportes', BarChart3, <>{(!searching || filteredPublications.length > 0) && <div className={`nav-group nested-nav-group${showPublications ? ' is-open' : ''}`}>
        <button className="nav-group-toggle" type="button" aria-expanded={showPublications} onClick={() => toggleSubgroup('publications')}><Newspaper size={19} />{!collapsed && <><span>Publicaciones</span><ChevronDown className="nav-group-chevron" size={16} /></>}</button>
        <div className={`nav-group-panel${showPublications ? ' is-open' : ''}`} aria-hidden={!showPublications} inert={!showPublications}><div className="nav-group-panel-inner"><div className="nav-group-items publication-items">{filteredPublications.map(({ id, label, Icon: ItemIcon }) => <button key={id} data-tooltip={label} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => selectRoute(id)} aria-label={label}><ItemIcon size={19} />{!collapsed && <span>{label}</span>}</button>)}</div></div></div>
      </div>}</>, filteredPublications.length > 0)}
      {searching && filteredModules.length === 0 && filteredSimulators.length === 0 && filteredPublications.length === 0 && <p className="sidebar-search-empty">No se encontraron módulos ni submódulos.</p>}
    </nav>
  </aside>
  <nav className="mobile-bottom-navigation" aria-label="Navegación principal móvil">
    <button type="button" className={activeMobileTab === 'courses' ? 'is-active' : ''} onClick={openCoursesPage}><BookOpen size={18} /><span>Cursos</span></button>
    <button type="button" className={activeMobileTab === 'simulators' ? 'is-active' : ''} onClick={() => selectRoute('simulator-hub')}><Calculator size={18} /><span>Simuladores</span></button>
    <button type="button" className={activeMobileTab === 'reports' ? 'is-active' : ''} onClick={() => selectRoute('reports-hub')}><BarChart3 size={18} /><span>Reportes</span></button>
  </nav>
  </>
}
