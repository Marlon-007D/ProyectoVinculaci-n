import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEllipsis,
  faHeartPulse,
  faHouse,
  faUsers,
  faFileLines,
  faInbox,
  faHeart,
} from '@fortawesome/free-solid-svg-icons'
import type { ReactNode } from 'react'
import type { DeceScreen } from '../../types/screen'

type Props = {
  screen: DeceScreen
  onNavigate: (screen: DeceScreen) => void
  children: ReactNode
}

export default function ProvisionalShell({ screen, onNavigate, children }: Props) {
  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <b>DECE</b>
            <small>Bienestar estudiantil</small>
          </div>
        </div>
        <nav aria-label="Navegación principal">
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
        <div className="profile">
          <div className="avatar">DE</div>
          <div>
            <b>Equipo DECE</b>
            <small>Unidad educativa</small>
          </div>
          <span className="profile-dots">
            <FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
          </span>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="crumb">
            Unidad Educativa <span>/</span> <b>DECE</b>
          </div>
          <div className="top-actions">
            <span className="today">Año lectivo 2025–2026</span>
            <div className="avatar small">DE</div>
          </div>
        </header>
        {children}
      </main>
    </>
  )
}
