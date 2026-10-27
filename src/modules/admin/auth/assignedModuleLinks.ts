import { adminDestination } from './institutionNavigation.ts';

export function assignedModuleLinks(institution: { institution_id: string; slug: string; module_permissions: Partial<Record<string, boolean>> }) {
  const modules = [
    { key: 'inicio', label: 'Inicio', path: '/panel' },
    { key: 'projects', label: 'Proyectos', path: '/panel/proyectos' },
    { key: 'dece', label: 'DECE', path: '/panel/dece' },
    { key: 'simuladores', label: 'Simuladores', path: '/panel/simuladores' },
    { key: 'portal', label: 'Portal web', path: '/panel/portal' },
  ];
  return modules.filter(module => institution.module_permissions[module.key] === true).map(module => ({
    key: module.key, label: module.label,
    destination: adminDestination(module.path, '', { institution: institution.institution_id, slug: institution.slug }),
  }));
}
