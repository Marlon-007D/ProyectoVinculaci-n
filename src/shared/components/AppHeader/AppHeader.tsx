import { CircleUserRound } from 'lucide-react'
import './AppHeader.css'

export function AppHeader() {
  return <header className="topbar">
    <div className="student-chip"><CircleUserRound className="profile-icon" size={25} aria-hidden="true" /><p><b>Brigitte Rodríguez</b><small>Administradora</small></p></div>
  </header>
}
