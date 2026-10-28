import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTenantInvitation } from './inviteTenantUser.ts';

const env = { supabaseUrl: 'https://project.test', publicKey: 'public', serviceRoleKey: 'server-only', allowedOrigins: ['http://localhost:5173'] };
function setup({ method = 'otp', age = 0, pending = true, institution = 'school', identity = true, passwordOk = true } = {}) {
  const calls = [];
  const token = `header.${Buffer.from(JSON.stringify({ sub: 'person', amr: [{ method, timestamp: Date.now() / 1000 - age }] })).toString('base64url')}.signature`;
  const request = new Request('https://edge.test', { method: 'POST', headers: { origin: env.allowedOrigins[0], authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'complete_invitation_password', institutionId: 'school', password: 'abcdef' }) });
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'person', email: 'person@example.test', email_confirmed_at: 'confirmed' }, { status: identity ? 200 : 401 });
    if (url.endsWith('/admin_tenant_own_invitation')) return Response.json({ pending, email: 'person@example.test', membership: { institution_id: institution, is_active: false } });
    if (url.endsWith('/admin/users/person')) return Response.json({ id: 'person' }, { status: passwordOk ? 200 : 422 });
    throw new Error('Unexpected request');
  };
  return { request, fetcher, calls };
}

test('recent verified email and scoped pending invitation update only the callers password with server credentials', async () => {
  const f = setup();
  const response = await handleTenantInvitation(f.request, env, f.fetcher);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { passwordSaved: true });
  assert.equal(f.calls.length, 3);
  const write = f.calls.at(-1);
  assert.equal(write.options.method, 'PUT');
  assert.equal(write.options.headers.Authorization, 'Bearer server-only');
  assert.deepEqual(JSON.parse(write.options.body), { password: 'abcdef' });
});

test('invalid sessions, password-only sessions, stale emails and other institutions never reach the privileged write', async () => {
  for (const scenario of [{ identity: false }, { method: 'password' }, { age: 601 }, { pending: false }, { institution: 'other' }]) {
    const f = setup(scenario);
    const response = await handleTenantInvitation(f.request, env, f.fetcher);
    assert(response.status >= 400);
    assert(!f.calls.some(call => call.options.method === 'PUT'));
  }
});

test('Auth password policy rejection never claims a successful save or activates membership', async () => {
  const f = setup({ passwordOk: false });
  const response = await handleTenantInvitation(f.request, env, f.fetcher);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).passwordSaved, undefined);
  assert(!f.calls.some(call => call.url.includes('accept_invitation')));
});
