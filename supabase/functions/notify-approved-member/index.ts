import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return respond({ error: 'Inicia sesión para continuar.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: identity, error: authError } = await caller.auth.getUser();
    if (authError || !identity.user) return respond({ error: 'Inicia sesión para continuar.' }, 401);
    const { institutionId, profileId } = await request.json();
    // This RPC independently enforces tenant scope and the Superadmin boundary.
    const { data: managed, error: scopeError } = await caller.rpc('list_managed_memberships', { target_institution_id: institutionId });
    const member = managed?.find((item: any) => item.profile_id === profileId && item.institution_id === institutionId && item.is_active && ['institution_admin', 'dece_staff', 'project_manager', 'editor', 'student', 'dece', 'projects_manager', 'content_editor'].includes(item.role_name));
    if (scopeError || !member) return respond({ error: 'No tienes permisos para notificar esta membresía.' }, 403);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: notification, error: notificationError } = await admin.from('membership_approval_notifications').select('*').eq('institution_id', institutionId).eq('profile_id', profileId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (notificationError || !notification) return respond({ error: 'No se encontró la notificación de aprobación.' }, 409);
    if (notification.sent_at) return respond({ notified: true });
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('APPROVAL_EMAIL_FROM');
    const siteUrl = Deno.env.get('APP_SITE_URL');
    if (!apiKey || !from || !siteUrl) return respond({ error: 'La membresía está aprobada. El correo está pendiente de configuración.' }, 503);
    // Confirmation is deferred until the institutional approval, never signup.
    const { data: account, error: confirmError } = await admin.auth.admin.getUserById(profileId);
    if (confirmError || !account.user?.email) return respond({ error: confirmError?.message ?? 'No se pudo consultar la cuenta.' }, 500);
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink', email: account.user.email,
      options: { redirectTo: new URL('/panel/admin', siteUrl).href },
    });
    if (linkError || !link.properties?.action_link) return respond({ error: linkError?.message ?? 'No se pudo generar el enlace de verificación.' }, 500);
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: {
      Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `membership-approval/${notification.notification_id}`,
    }, body: JSON.stringify({ from, to: [account.user.email], subject: 'Tu solicitud institucional fue aprobada',
      text: `Tu Administrador Institucional aprobó tu solicitud y asignó el rol correspondiente. Verifica tu correo y accede a tu cuenta mediante este enlace: ${link.properties.action_link}` }) });
    if (!response.ok) return respond({ error: 'La membresía está aprobada. No se pudo enviar el correo. Puedes reintentar la notificación.' }, 502);
    const { error: saveError } = await admin.from('membership_approval_notifications').update({ sent_at: new Date().toISOString() }).eq('notification_id', notification.notification_id);
    if (saveError) return respond({ error: 'El correo fue enviado. No se pudo actualizar su estado.' }, 500);
    return respond({ notified: true });
  } catch { return respond({ error: 'No se pudo completar la notificación.' }, 500); }
});
