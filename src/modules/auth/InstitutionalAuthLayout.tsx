import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import styles from './InstitutionalAuthLayout.module.css';

export function InstitutionalAuthLayout({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  return <main className={styles.page}>
    <aside className={styles.visual} aria-labelledby="institutional-message">
      <div className={styles.identity}><span className={styles.logo}>UE</span><span>Plataforma Institucional<span className={styles.identityDetail}>Educación • Vinculación</span></span></div>
      <div className={styles.message}><span className={styles.eyebrow}>UNA COMUNIDAD, MÁS POSIBILIDADES</span><h2 id="institutional-message">Conecta la gestión educativa con cada comunidad.</h2><p>Accede a las herramientas de tu institución con permisos claros, una experiencia unificada y protección para cada cuenta.</p></div>
      <div className={styles.indicators}><span><ShieldCheck size={15} aria-hidden="true" />Acceso protegido por roles</span>{['Instituciones', 'Usuarios', 'Roles', 'Auditoría'].map(label => <span key={label}>{label}</span>)}</div>
    </aside>
    <section className={styles.formPanel} aria-labelledby={labelledBy}>{children}</section>
  </main>;
}
