import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);

  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !supabaseUrl || !serviceRoleKey) {
    return respond({ error: 'Falta una sesión válida o la configuración del servidor.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const inviter = authData.user;
    if (authError || !inviter) return respond({ error: 'Inicia sesión nuevamente para continuar.' }, 401);

    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const roleId = String(body.roleId ?? '');
    const institutionId = String(body.institutionId ?? '');
    if (!firstName || !lastName) {
      return respond({ error: 'Los nombres y apellidos son obligatorios para crear el perfil.' }, 400);
    }
    if (!email || !roleId || !institutionId) {
      return respond({ error: 'Correo, rol e institución son obligatorios.' }, 400);
    }

    const [{ data: inviterMemberships, error: membershipError }, { data: targetRole, error: roleError }, { data: institution, error: institutionError }] = await Promise.all([
      admin.from('memberships').select('institution_id, role_id').eq('profile_id', inviter.id),
      admin.from('roles').select('role_id, name').eq('role_id', roleId).maybeSingle(),
      admin.from('institutions').select('institution_id, name, is_active').eq('institution_id', institutionId).maybeSingle(),
    ]);

    if (membershipError || roleError || institutionError) {
      const failedCheck = membershipError ? 'membresías del usuario' : roleError ? 'rol seleccionado' : 'institución seleccionada';
      const validationError = membershipError ?? roleError ?? institutionError;
      console.error(`Falló la consulta de ${failedCheck}:`, validationError);
      return respond({ error: `Supabase no pudo consultar ${failedCheck}. Código: ${validationError?.code ?? 'sin código'}.` }, 500);
    }

    const inviterRoleIds = [...new Set((inviterMemberships ?? []).map((membership: any) => membership.role_id))];
    const { data: inviterRoles, error: inviterRolesError } = inviterRoleIds.length
      ? await admin.from('roles').select('role_id, name').in('role_id', inviterRoleIds)
      : { data: [], error: null };
    if (inviterRolesError) {
      console.error('Falló la consulta de roles del usuario solicitante:', inviterRolesError);
      return respond({ error: `Supabase no pudo consultar los roles de tu cuenta. Código: ${inviterRolesError.code ?? 'sin código'}.` }, 500);
    }

    const inviterRoleNames = new Map((inviterRoles ?? []).map((role: any) => [role.role_id, role.name]));
    const isGlobalAdmin = (inviterMemberships ?? []).some((membership: any) => inviterRoleNames.get(membership.role_id) === 'super_admin');
    const isInstitutionAdmin = (inviterMemberships ?? []).some((membership: any) =>
      membership.institution_id === institutionId && inviterRoleNames.get(membership.role_id) === 'institution_admin');
    if (!isGlobalAdmin && !isInstitutionAdmin) {
      return respond({ error: 'No tienes permisos para asignar roles en esa institución.' }, 403);
    }
    if (!targetRole || targetRole.name === 'super_admin') {
      return respond({ error: 'El rol global no se puede asignar desde este formulario.' }, 400);
    }
    if (!isGlobalAdmin && targetRole.name === 'institution_admin') {
      return respond({ error: 'Solo un superadministrador global puede invitar administradores institucionales.' }, 403);
    }
    if (!institution?.is_active) {
      return respond({ error: 'La institución no existe o está inactiva.' }, 400);
    }

    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { first_name: firstName, last_name: lastName },
    });
    if (inviteError || !invitation.user) {
      console.error('No se pudo crear la invitación:', inviteError);
      return respond({ error: inviteError?.message ?? 'No se pudo crear la cuenta invitada.' }, 400);
    }

    const invitedUser = invitation.user;
    const { error: profileError } = await admin.from('profiles').upsert({
      profile_id: invitedUser.id,
      first_name: firstName,
      last_name: lastName,
      email,
      mfa_required: true,
    }, { onConflict: 'profile_id' });

    if (profileError) {
      await admin.auth.admin.deleteUser(invitedUser.id);
      console.error('No se pudo crear el perfil invitado:', profileError);
      return respond({ error: 'La invitación se creó, pero no se pudo preparar el perfil. Vuelve a intentarlo.' }, 500);
    }

    const { error: assignmentError } = await admin.from('memberships').upsert({
      institution_id: institutionId,
      profile_id: invitedUser.id,
      role_id: roleId,
    }, { onConflict: 'institution_id,profile_id' });

    if (assignmentError) {
      await admin.auth.admin.deleteUser(invitedUser.id);
      console.error('No se pudo asignar el rol al usuario invitado:', assignmentError);
      return respond({ error: 'No se pudo asignar el rol. Revisa la configuración de memberships y vuelve a intentarlo.' }, 500);
    }

    return respond({ message: `Invitación enviada a ${email}; el rol ya quedó asignado a ${institution.name}. Al iniciar sesión, deberá configurar la verificación en dos pasos.` });
  } catch (error) {
    console.error('Error inesperado al invitar usuario:', error);
    return respond({ error: 'Ocurrió un error al invitar al usuario. Inténtalo nuevamente.' }, 500);
  }
});
