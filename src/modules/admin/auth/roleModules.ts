import { canonicalTenantRole } from './accessPolicy.ts';

const roleDefaults: Readonly<Record<string, string>> = { dece: 'dece', projects_manager: 'projects', content_editor: 'portal' };

export function defaultRoleModule(role: string): string | undefined {
  return roleDefaults[canonicalTenantRole(role)];
}

export function assignedRoleModules(role: string, selected: readonly string[], enabled: readonly string[]): string[] {
  const required = defaultRoleModule(role);
  if (required && !enabled.includes(required)) throw new Error(`El módulo ${required} debe estar habilitado en esta institución para asignar este rol.`);
  return [...new Set([...selected.filter(module => enabled.includes(module)), ...(required ? [required] : []), ...(canonicalTenantRole(role) === 'student' ? ['inicio', 'projects', 'simuladores'].filter(module => enabled.includes(module)) : [])])];
}
