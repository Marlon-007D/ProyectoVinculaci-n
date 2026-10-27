import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTenantInvitation } from './inviteTenantUser.ts';

const origin = 'https://proyectovinculaci-n.onrender.com';
const env = { supabaseUrl: 'https://backend.test', publicKey: 'public', serviceRoleKey: 'server', allowedOrigins: [origin] };
function scenario({ slug = 'ue-puerto-limon', role = 'teacher', confirmed = true, active = true, actor = 'institution_admin', mailStatus = 200 } = {}) {
  const calls = [];
  const request = new Request('https://edge.test', { method: 'POST', headers: { origin, authorization: 'Bearer caller' },
    body: JSON.stringify({ action: 'notify_access', institutionId: 'school', profileId: 'person', redirect_to: `${origin}/panel/admin?institution=school&slug=${slug}` }) });
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'actor' });
    if (url.endsWith('/admin_tenant_snapshot_v3')) return Response.json({ institution_id: 'school', actor_role: actor,
      members: [{ profile_id: 'person', institution_id: 'school', is_active: active, role_name: role, email: 'person@example.test', first_name: 'Ana', last_name: 'Torres', phone: '0991234567' }] });
    if (url.includes('/institutions?')) return Response.json([{ slug, is_active: true }]);
    if (url.endsWith('/admin/users/person')) return Response.json({ email: 'person@example.test', email_confirmed_at: confirmed ? 'verified' : null });
    if (url.includes('/otp?') || url.includes('/invite?')) return Response.json({}, { status: mailStatus });
    throw new Error('Unexpected endpoint');
  };
  return { request, fetcher, calls };
}

test('notifications cover all assignable roles in four schools without changing membership or modules', async () => {
  for (const slug of ['ue-la-concordia', 'ue-luz-de-america', 'ue-el-esfuerzo', 'ue-puerto-limon']) {
    for (const role of ['institution_admin', 'teacher', 'secretary', 'staff', 'dece', 'projects_manager', 'content_editor', 'student', 'guest']) {
      const f = scenario({ slug, role, actor: role === 'institution_admin' ? 'super_admin' : 'institution_admin' });
      const response = await handleTenantInvitation(f.request, env, f.fetcher);
      assert.equal((await response.json()).notificationSent, true);
      const email = f.calls.find(call => call.url.includes('/otp?'));
      assert(email);
      assert.equal(new URL(new URL(email.url).searchParams.get('redirect_to')).searchParams.get('slug'), slug);
      assert(!f.calls.some(call => ['PATCH', 'DELETE', 'PUT'].includes(call.options.method)));
    }
  }
});

test('unconfirmed accounts receive Auth invitation links and preloaded personal metadata', async () => {
  const f = scenario({ confirmed: false });
  const response = await handleTenantInvitation(f.request, env, f.fetcher);
  assert.equal((await response.json()).notificationSent, true);
  const email = f.calls.find(call => call.url.includes('/invite?'));
  assert.equal(JSON.parse(email.options.body).data.phone, '0991234567');
});

test('unauthorized role, inactive member and protected authority never reach privileged email requests', async () => {
  for (const input of [{ actor: 'student' }, { active: false }, { role: 'super_admin' }]) {
    const f = scenario(input);
    assert.equal((await handleTenantInvitation(f.request, env, f.fetcher)).status, 403);
    assert(!f.calls.some(call => call.options.headers.Authorization === 'Bearer server'));
  }
});

test('rate limits do not report delivery or undo saved access', async () => {
  const f = scenario({ mailStatus: 429 });
  const response = await handleTenantInvitation(f.request, env, f.fetcher);
  assert.deepEqual(await response.json(), { notificationSent: false, rateLimited: true });
});
