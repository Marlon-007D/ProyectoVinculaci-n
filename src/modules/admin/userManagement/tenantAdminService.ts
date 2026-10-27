import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantAdminService, TenantSnapshot } from './tenantAdmin.types';


export function validateTenantSnapshot(data: unknown, institutionId: string): TenantSnapshot {
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1
    || !('institution_id' in data) || data.institution_id !== institutionId
    || !('actor_role' in data) || typeof data.actor_role !== 'string'
    || !('members' in data) || !Array.isArray(data.members)
    || !('requests' in data) || !Array.isArray(data.requests)
    || !('roles' in data) || !Array.isArray(data.roles)
    || !('modules' in data) || !Array.isArray(data.modules)) {
    throw new Error('No se pudo verificar el contrato de administración institucional.');
  }
  for (const row of [...data.members, ...data.requests]) {
    if (!row || typeof row !== 'object' || row.institution_id !== institutionId
      || !['profile_id', 'email', 'first_name', 'last_name', 'phone'].every(key => typeof row[key] === 'string')) {
      throw new Error('La respuesta contiene registros ajenos a la institución activa.');
    }
  }
  if (!data.members.every(row => typeof row.role_name === 'string' && typeof row.is_active === 'boolean'
    && Array.isArray(row.modules) && row.modules.every((name: unknown) => typeof name === 'string'))
    || !data.requests.every(row => typeof row.request_id === 'string')
    || !data.roles.every(row => row && typeof row.role_id === 'string' && typeof row.name === 'string')
    || !data.modules.every(name => typeof name === 'string')) {
    throw new Error('La respuesta institucional contiene datos incompletos.');
  }
  return data as TenantSnapshot;
}

export function createTenantAdminService(client: Pick<SupabaseClient, 'rpc' | 'functions' | 'from'>): TenantAdminService {
  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const { data, error } = await client.rpc(name, args);
      if (error) throw new Error(error.message);
      return data;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('No se pudo completar la operación institucional.', { cause });
    }
  }
  return {
    async load(institutionId) {
      if (!institutionId) throw new Error('Selecciona una institución autorizada.');
      const newest = await client.rpc('admin_tenant_snapshot_v3', { target_institution_id: institutionId });
      if (!newest.error) return validateTenantSnapshot(newest.data, institutionId);
      if (newest.error.code !== 'PGRST202') throw new Error(newest.error.message);
      const result = await client.rpc('admin_tenant_snapshot_v2', { target_institution_id: institutionId });
      if (result.error?.code === 'PGRST202') return validateTenantSnapshot(await rpc('admin_tenant_snapshot', { target_institution_id: institutionId }), institutionId);
      if (result.error) throw new Error(result.error.message);
      return validateTenantSnapshot(result.data, institutionId);
    },
    async approve(input) {
      await rpc('admin_tenant_approve_registration', { target_institution_id: input.institutionId,
        target_profile_id: input.profileId, target_request_id: input.requestId, target_role_id: input.roleId,
        target_first_name: input.firstName, target_last_name: input.lastName, target_phone: input.phone, target_modules: input.modules });
    },
    async invite(input) {
      try {
        const contract = await client.functions.invoke<{ invitationContract?: string }>('admin-tenant-invite', { body: { action: 'capabilities' } });
        if (contract.error || contract.data?.invitationContract !== 'pending-v1') throw new Error('Actualiza admin-tenant-invite al contrato de invitaciones pendientes antes de enviar invitaciones.');
        const { data, error } = await client.functions.invoke<{ assigned?: boolean; pending?: boolean; notificationSent?: boolean }>('admin-tenant-invite', { body: { ...input, action: 'invite' } });
        if (error) {
          let message = 'No se pudo enviar la invitación. Revisa la conexión y los permisos de tu cuenta.';
          if (error.context instanceof Response) {
            try {
              const body: unknown = await error.context.clone().json();
              if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') message = body.error;
            } catch { /* Preserve the default message if the server did not return JSON. */ }
          }
          throw new Error(message);
        }
        if (data?.assigned !== true || data.pending !== true) throw new Error('No se pudo preparar la invitación pendiente. Verifica la actualización de admin-tenant-invite y el script 006.');
        return { notificationSent: data.notificationSent === true };
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('No se pudo crear la cuenta institucional.', { cause });
      }
    },
    async remove(institutionId, profileId) {
      await rpc('admin_tenant_remove_role', { target_institution_id: institutionId, target_profile_id: profileId });
    },
    async deleteMember(institutionId, profileId) {
      if (!institutionId || !profileId) throw new Error('Selecciona un miembro de la institución activa.');
      try {
        const { data, error } = await client.from('memberships').delete()
          .eq('institution_id', institutionId).eq('profile_id', profileId)
          .select('institution_id,profile_id');
        if (error) {
          if (error.code === '42501') throw new Error('El servidor no autoriza el DELETE. Debe aplicarse 005_membership_delete_permissions.sql en Supabase; no necesitas redesplegar Edge Functions.');
          throw new Error(`No se pudo eliminar la membresía: ${error.message}`);
        }
        if (!data || data.length !== 1 || data[0].institution_id !== institutionId || data[0].profile_id !== profileId) {
          throw new Error('No se confirmó el borrado. Revisa la membresía y los permisos RLS del script 005_membership_delete_permissions.sql.');
        }
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('No se pudo retirar la membresía. Revisa los permisos institucionales y la conexión.', { cause });
      }
    },
  };
}
