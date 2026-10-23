import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHeartPulse,
  faHouse,
  faUsers,
  faFileLines,
  faInbox,
  faHeart,
  faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { DeceScreen } from '../../types/screen'

type Props = {
  screen: DeceScreen
  onNavigate: (screen: DeceScreen) => void
  onLogout: () => Promise<void>
  children: ReactNode
}

export default function ProvisionalShell({ screen, onNavigate, onLogout, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-heading">
          <div className="brand">
            <div className="brand-mark">D</div>
            <div>
              <b>DECE</b>
              <small>Bienestar estudiantil</small>
            </div>
          </div>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="dece-workspace-navigation"
            onClick={() => setMenuOpen(open => !open)}
          >
            <span>Menú DECE</span>
            <span aria-hidden="true">{menuOpen ? '−' : '+'}</span>
          </button>
        </div>
        <nav id="dece-workspace-navigation" className={`workspace-nav ${menuOpen ? 'open' : ''}`} aria-label="Navegación principal">
          <div className="nav-caption">ESPACIO DE TRABAJO</div>
          <button
            type="button"
            className={`nav-item ${screen === 'home' ? 'active' : ''}`}
            aria-current={screen === 'home' ? 'page' : undefined}
            onClick={() => onNavigate('home')}
          >
            <FontAwesomeIcon icon={faHouse} aria-hidden="true" />
            Panel principal
          </button>
          <button type="button" className={`nav-item ${screen === 'forms' ? 'active' : ''}`} aria-current={screen === 'forms' ? 'page' : undefined} onClick={() => onNavigate('forms')}>
            <FontAwesomeIcon icon={faFileLines} aria-hidden="true" />
            Plantillas de fichas
          </button>
          <button type="button" className={`nav-item ${screen === 'submissions' ? 'active' : ''}`} aria-current={screen === 'submissions' ? 'page' : undefined} onClick={() => onNavigate('submissions')}>
            <FontAwesomeIcon icon={faInbox} aria-hidden="true" />
            Envíos de fichas
          </button>
          <button
            type="button"
            className={`nav-item ${screen === 'students' ? 'active' : ''}`}
            aria-current={screen === 'students' ? 'page' : undefined}
            onClick={() => onNavigate('students')}
          >
            <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
            Estudiantes
          </button>
          <button type="button" className={`nav-item ${screen === 'cases' ? 'active' : ''}`} aria-current={screen === 'cases' ? 'page' : undefined} onClick={() => onNavigate('cases')}>
            <FontAwesomeIcon icon={faHeart} aria-hidden="true" />
            Casos de acompañamiento
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <FontAwesomeIcon icon={faHeartPulse} aria-hidden="true" />
          </div>
          <b>Un espacio para acompañar</b>
          <p>Información y seguimiento para el bienestar de cada estudiante.</p>
        </div>
        <div className="sidebar-footer">
          <div className="profile" aria-label="Perfil: Equipo DECE, Unidad educativa">
            <div className="avatar">DE</div>
            <div>
              <b>Equipo DECE</b>
              <small>Unidad educativa</small>
            </div>
          </div>
          <button type="button" className="sidebar-logout" onClick={() => void onLogout()}>
            <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
            Salir
          </button>
        </div>
      </aside>
      <main className="main-area">
        {children}
      </main>
    </>
  )
}
