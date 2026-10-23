export const operationalRoles = ['dece', 'projects_manager', 'content_editor', 'student'] as const;
export function canonicalRole(role: string): string {
  const aliases: Record<string, string> = { dece_staff: 'dece', project_manager: 'projects_manager', editor: 'content_editor', invitado: 'pending', viewer: 'pending', guest: 'pending' };
  return aliases[role] ?? role;
}
export function canAssignRole(actor: string | null, target: string): boolean {
  if (actor === 'super_admin') return target === 'institution_admin';
  return actor === 'institution_admin' && operationalRoles.some(role => role === canonicalRole(target));
}
