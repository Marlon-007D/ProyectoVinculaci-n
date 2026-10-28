import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function createAdminEdgeBundle() {
  const files = ['../auth/accessPolicy.ts', '../auth/canonicalSlug.ts', '../auth/contactValidation.ts', './deleteTenantMember.ts', './completeInvitationPassword.ts', './requestInvitationEmail.ts', './notifyTenantAccess.ts', './inviteTenantUser.ts'];
  const sources = await Promise.all(files.map(path => readFile(new URL(path, import.meta.url), 'utf8')));
  const combined = sources.map(source => source.replace(/^import .*;\r?\n/gm, '')).join('\n\n');
  return combined + `
// Single-file entry point for the EXISTING admin-tenant-invite function.
Deno.serve(request => handleTenantInvitation(request, {
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  publicKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  allowedOrigins: (Deno.env.get('ADMIN_ALLOWED_ORIGINS') ?? '')
    .split(',').map(value => value.trim()).filter(Boolean),
}));
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeFile(new URL('./admin-tenant-invite.deploy.txt', import.meta.url), await createAdminEdgeBundle(), 'utf8');
  process.stdout.write('Paquete local actualizado: src/modules/admin/backend/admin-tenant-invite.deploy.txt\n');
}
