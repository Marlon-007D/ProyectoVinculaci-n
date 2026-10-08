import { Building2, CircleUserRound } from 'lucide-react'
import { tenantInstitution } from '../../../core/config/tenant'
import './AppHeader.css'

export function AppHeader() {
  return <header className="topbar">
    <div className="tenant-chip"><Building2 className="tenant-icon" size={20} aria-hidden="true" /><span>{tenantInstitution.name}</span></div>
    <div className="student-chip"><CircleUserRound className="profile-icon" size={25} aria-hidden="true" /><p><b>Brigitte Rodríguez</b><small>Administradora</small></p></div>
  </header>
}
