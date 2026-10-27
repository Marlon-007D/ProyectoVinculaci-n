interface PasswordEnvironment {
  supabaseUrl: string; publicKey: string; serviceRoleKey: string;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Called only by the existing Edge handler after CORS/method checks. */
export async function completeInvitationPassword(request: Request, env: PasswordEnvironment,
  fetcher: typeof fetch = fetch): Promise<{ status: number; body: Record<string, unknown> }> {
  const fail = (error: string, status = 403) => ({ status, body: { error } });
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ') || !env.serviceRoleKey) return fail('Sesión o configuración no disponible.', 401);
    const input: unknown = await request.json();
    if (!object(input) || typeof input.institutionId !== 'string' || !input.institutionId
      || typeof input.password !== 'string' || input.password.length < 6 || input.password.length > 256
      || 'profile_id' in input || 'userId' in input) return fail('Datos de aceptación no válidos.', 400);
    const callerHeaders = { apikey: env.publicKey, Authorization: authorization, 'Content-Type': 'application/json' };
    // Validate the JWT with Auth BEFORE inspecting its signed claims. Never trust a supplied user ID.
    const identityResponse = await fetcher(`${env.supabaseUrl}/auth/v1/user`, { headers: callerHeaders });
    const identity: unknown = identityResponse.ok ? await identityResponse.json() : null;
    if (!object(identity) || typeof identity.id !== 'string' || !identity.email_confirmed_at
      || typeof identity.email !== 'string') return fail('Confirma el correo e inicia una sesión válida.', 401);
    const encoded = authorization.slice(7).split('.')[1];
    const claims: unknown = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    const now = Date.now() / 1000;
    if (!object(claims) || claims.sub !== identity.id || !Array.isArray(claims.amr)
      || !claims.amr.some(item => object(item) && ['otp', 'invite', 'recovery'].includes(String(item.method))
        && typeof item.timestamp === 'number' && item.timestamp <= now + 30 && now - item.timestamp <= 600)) {
      return fail('Abre un nuevo enlace del correo: se requiere una confirmación reciente para guardar la contraseña.');
    }
    const own = await fetcher(`${env.supabaseUrl}/rest/v1/rpc/admin_tenant_own_invitation`, {
      method: 'POST', headers: callerHeaders, body: JSON.stringify({ target_institution_id: input.institutionId }),
    });
    const invitation: unknown = own.ok ? await own.json() : null;
    if (!object(invitation) || invitation.pending !== true || invitation.email !== identity.email
      || !object(invitation.membership) || invitation.membership.institution_id !== input.institutionId
      || invitation.membership.is_active !== false) return fail('No hay una invitación pendiente para tu cuenta en esta institución.');
    const result = await fetcher(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(identity.id)}`, {
      method: 'PUT', headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: input.password }),
    });
    if (!result.ok) return fail('Auth no permitió guardar la contraseña. Revisa la política de contraseñas e inténtalo nuevamente.', 409);
    return { status: 200, body: { passwordSaved: true } };
  } catch {
    return fail('No se pudo verificar o guardar la contraseña de la invitación.', 400);
  }
}
