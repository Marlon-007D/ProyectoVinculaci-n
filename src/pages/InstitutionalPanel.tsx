import { Link } from 'react-router-dom';
import { useTenant, type InstitutionModuleName } from '../core/TenantContext';
import styles from './InstitutionalPanel.module.css';

const modules: { id: InstitutionModuleName; title: string; path: string; description: string }[] = [
  { id: 'projects', title: 'Proyectos de Vinculación', path: '/panel/proyectos', description: 'Organiza proyectos comunitarios, equipos de trabajo y actividades institucionales.' },
  { id: 'portal', title: 'Portal Web', path: '/panel/portal', description: 'Administra los contenidos y publicaciones del portal educativo.' },
  { id: 'dece', title: 'Departamento DECE', path: '/panel/dece', description: 'Gestiona fichas, estudiantes y casos de acompañamiento.' },
  { id: 'simuladores', title: 'Simuladores Académicos', path: '/panel/simuladores', description: 'Accede a herramientas prácticas para el aprendizaje.' },
  { id: 'inicio', title: 'Administración y Seguridad', path: '/panel/admin', description: 'Consulta los accesos y permisos disponibles para tu cuenta.' },
];

export function InstitutionalPanel() {
  const { activeInstitution, hasModuleAccess } = useTenant();
  const visibleModules = modules.filter(module => module.id === 'inicio' ? Boolean(activeInstitution) : hasModuleAccess(module.id));

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <h1>{activeInstitution?.name || 'Plataforma Institucional Educativa'}</h1>
        <p>Accede a los espacios de trabajo habilitados para tu institución.</p>
      </section>
      <section aria-labelledby="institutional-modules-title">
        <h2 id="institutional-modules-title">Módulos del sistema</h2>
        <div className={styles.grid}>
          {visibleModules.map(module => <article className={styles.card} key={module.id}>
            <div><h3>{module.title}</h3><p>{module.description}</p></div>
            <Link to={module.path}>Ingresar</Link>
          </article>)}
        </div>
        {!visibleModules.length && <p>No hay módulos habilitados para esta institución.</p>}
      </section>
    </div>
  );
}
