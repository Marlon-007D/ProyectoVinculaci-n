import { ChevronRight, FileText, HeartHandshake, Home, Inbox, LogOut, PanelLeftClose, PanelLeftOpen, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { DeceScreen } from '../../types/screen'

type Props = {
  screen: DeceScreen
  onNavigate: (screen: DeceScreen) => void
  accountEmail: string
  onSignOut: () => void
  children: ReactNode
}

export default function ProvisionalShell({ screen, onNavigate, accountEmail, onSignOut, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const initials = accountEmail.trim().charAt(0).toUpperCase() || 'D'

  return (
    <>
      <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="sidebar-heading">
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(value => !value)}
          >
            {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="dece-workspace-navigation"
            onClick={() => setMenuOpen(open => !open)}
          >
            <span>Secciones DECE</span>
            <ChevronRight className={menuOpen ? 'is-open' : ''} size={18} aria-hidden="true" />
          </button>
        </div>
        <nav id="dece-workspace-navigation" className={`workspace-nav${menuOpen ? ' open' : ''}`} aria-label="Secciones DECE">
          <button
            type="button"
            className={`nav-item ${screen === 'home' ? 'active' : ''}`}
            data-tone="home"
            aria-current={screen === 'home' ? 'page' : undefined}
            onClick={() => onNavigate('home')}
          >
            <Home size={20} aria-hidden="true" />
            <span>Inicio DECE</span>
          </button>
          <button type="button" className={`nav-item ${screen === 'students' ? 'active' : ''}`} data-tone="students" aria-current={screen === 'students' ? 'page' : undefined} onClick={() => onNavigate('students')}>
            <Users size={20} aria-hidden="true" />
            <span>Estudiantes</span>
          </button>
          <button type="button" className={`nav-item ${screen === 'cases' ? 'active' : ''}`} data-tone="cases" aria-current={screen === 'cases' ? 'page' : undefined} onClick={() => onNavigate('cases')}>
            <HeartHandshake size={20} aria-hidden="true" />
            <span>Casos</span>
          </button>
          <button type="button" className={`nav-item ${screen === 'forms' ? 'active' : ''}`} data-tone="forms" aria-current={screen === 'forms' ? 'page' : undefined} onClick={() => onNavigate('forms')}>
            <FileText size={20} aria-hidden="true" />
            <span>Plantillas de fichas</span>
          </button>
          <button type="button" className={`nav-item ${screen === 'submissions' ? 'active' : ''}`} data-tone="submissions" aria-current={screen === 'submissions' ? 'page' : undefined} onClick={() => onNavigate('submissions')}>
            <Inbox size={20} aria-hidden="true" />
            <span>Revisión de fichas</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="profile" title={accountEmail || 'Personal DECE'}>
            <div className="avatar">{initials}</div>
            <div className="profile-copy">
              <b>{accountEmail || 'Personal DECE'}</b>
              <small>Equipo DECE</small>
            </div>
          </div>
          <button type="button" className="sidebar-logout" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="crumb">
            Unidad Educativa <span>/</span> <b>DECE</b>
          </div>
          <div className="top-actions">
            <span className="today">Año lectivo 2025–2026</span>
            <div className="avatar small">{initials}</div>
          </div>
        </header>
        {children}
      </main>
    </>
  )
}
