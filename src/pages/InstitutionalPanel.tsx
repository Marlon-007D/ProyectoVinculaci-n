import { ArrowUpRight, BriefcaseBusiness, Calculator, HeartHandshake, PanelsTopLeft, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../core/AuthContext';
import { roleCanOpenModule } from '../modules/admin/auth/roleModules';
import { useTenant, type InstitutionModuleName } from '../core/TenantContext';
import styles from './InstitutionalPanel.module.css';

type ModuleItem = {
  id: string;
  permission?: InstitutionModuleName;
  title: string;
  path: string;
  description: string;
  group: string;
  icon: LucideIcon;
};

const modules: ModuleItem[] = [
  { id: 'projects', permission: 'projects', title: 'Proyectos de Vinculación', path: '/panel/proyectos', description: 'Organiza proyectos comunitarios, equipos de trabajo y actividades institucionales.', group: 'Comunidad', icon: BriefcaseBusiness },
  { id: 'dece', permission: 'dece', title: 'Departamento DECE', path: '/panel/dece', description: 'Gestiona fichas, estudiantes y casos de acompañamiento.', group: 'Comunidad', icon: HeartHandshake },
  { id: 'simuladores', permission: 'simuladores', title: 'Simuladores Académicos', path: '/panel/simuladores', description: 'Practica con herramientas académicas de cálculo y conversión.', group: 'Herramientas', icon: Calculator },
  { id: 'portal', permission: 'portal', title: 'Portal Web', path: '/panel/portal', description: 'Administra los contenidos y publicaciones del portal educativo.', group: 'Herramientas', icon: PanelsTopLeft },
  { id: 'admin', title: 'Administración y Seguridad', path: '/panel/admin', description: 'Consulta los accesos y permisos disponibles para tu cuenta.', group: 'Administración', icon: ShieldCheck },
];

export function InstitutionalPanel() {
  const { activeInstitution, hasModuleAccess } = useTenant();
  const { role } = useAuth();
  const availableModules = modules.filter(module => module.id === 'admin'
    ? Boolean(activeInstitution)
    : Boolean(module.permission && hasModuleAccess(module.permission) && roleCanOpenModule(role, module.permission)));

  return (
    <div className={styles.workspace}>
      <main className={styles.main}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>PANEL INSTITUCIONAL</p>
          <h1>{activeInstitution?.name || 'Plataforma Institucional Educativa'}</h1>
          <p>Accede a los espacios de trabajo habilitados para tu institución.</p>
        </header>
        <section aria-labelledby="institutional-modules-title" className={styles.modulesSection}>
          <div className={styles.sectionHeading}><div><h2 id="institutional-modules-title">Módulos disponibles</h2><p>Elige un espacio para continuar tu trabajo.</p></div><span>{availableModules.length} {availableModules.length === 1 ? 'módulo' : 'módulos'}</span></div>
          <div className={styles.grid}>
            {availableModules.map(module => {
              const Icon = module.icon;
              return <article className={styles.card} key={module.id}>
                <span className={styles.cardIcon}><Icon size={21} aria-hidden="true" /></span>
                <div className={styles.cardText}><h3>{module.title}</h3><p>{module.description}</p></div>
                <Link to={module.path} className={styles.cardLink}>Abrir módulo<ArrowUpRight size={17} aria-hidden="true" /></Link>
              </article>;
            })}
          </div>
          {availableModules.length === 0 && <p className={styles.empty}>No hay módulos habilitados para esta institución.</p>}
        </section>
      </main>
    </div>
  );
}
