import { supabase } from './supabaseClient';

export interface AuditLogData {
  action: string;          // Ej: 'CREATE_INSTITUTION', 'TOGGLE_MODULE'
  entity: string;          // Ej: 'institutions', 'module_settings'
  entityId?: string;
  details?: Record<string, any>;
  institutionId?: string;
}

export const logAuditEvent = async ({
  action,
  entity,
  entityId,
  details,
  institutionId,
}: AuditLogData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('audit_events').insert({
      user_id: user?.id || null,
      institution_id: institutionId || null,
      action,
      entity,
      entity_id: entityId || null,
      payload: details || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error al registrar evento de auditoría:', error.message);
    }
  } catch (err) {
    console.error('Error en auditLogger:', err);
  }
};