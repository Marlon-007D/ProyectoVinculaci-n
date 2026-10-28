import { Link } from 'react-router-dom';
import { assignedModuleLinks } from './assignedModuleLinks';
import styles from './AssignedModulesPanel.module.css';

export function AssignedModulesPanel({ institution }: { institution: {
  institution_id: string; slug: string; name: string; module_permissions: Partial<Record<string, boolean>>;
} }) {
  const links = assignedModuleLinks(institution);
  return <section className={styles.panel} aria-labelledby="assigned-modules-title">
    <h1 id="assigned-modules-title">Mi acceso en {institution.name}</h1>
    <p>Accede a los módulos asignados en tu institución.</p>
    {links.length ? <nav aria-label="Módulos asignados" className={styles.links}>
      {links.map(link => <Link key={link.key} to={link.destination}>{link.label}</Link>)}
    </nav> : <p>Tu membresía está activa. Solicita al administrador de tu institución la asignación de módulos.</p>}
  </section>;
}
