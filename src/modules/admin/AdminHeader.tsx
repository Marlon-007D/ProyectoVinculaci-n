import { GraduationCap, LogOut, ShieldCheck } from 'lucide-react';
import styles from './AdminHeader.module.css';

interface Props {
  scope: 'global' | 'institution';
  onLogout: () => void;
}

export function AdminHeader({ scope, onLogout }: Props) {
  const global = scope === 'global';
  return <header className={styles.header}>
    <div className={styles.inner}>
      <div className={styles.identity}>
        <span className={styles.mark}><GraduationCap size={22} aria-hidden="true" /></span>
        <div><span className={styles.platform}>Plataforma Institucional</span><strong>{global ? 'Administración global' : 'Administración institucional'}</strong></div>
      </div>
      <div className={styles.actions}>
        <span className={styles.role}><ShieldCheck size={14} aria-hidden="true" />{global ? 'Superadministrador' : 'Administrador institucional'}</span>
        <button type="button" className={styles.logout} onClick={onLogout}><LogOut size={16} aria-hidden="true" /><span>Cerrar sesión</span></button>
      </div>
    </div>
  </header>;
}
