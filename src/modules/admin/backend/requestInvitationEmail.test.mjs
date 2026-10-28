import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTenantInvitation } from './inviteTenantUser.ts';

const env = { supabaseUrl: 'https://project.test', publicKey: 'public', serviceRoleKey: 'server-only', allowedOrigins: ['http://localhost:5173', 'https://school.test'] };
function setup(email, { pending = true, status = 200, origin = env.allowedOrigins[0] } = {}) {
  const calls = [];
  const request = () => new Request('https://function.test', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'request_invitation_email', email, institutionId: 'school' }) });
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/profiles?')) return Response.json([{ profile_id: 'person' }]);
    if (url.includes('/admin_tenant_invitations?')) {
      assert.equal(new URL(url).searchParams.get('institution_id'), 'eq.school');
      assert.equal(new URL(url).searchParams.get('profile_id'), 'eq.person');
      return Response.json(pending ? [{ profile_id: 'person' }] : []);
    }
    if (url.includes('/institutions?')) return Response.json([{ slug: 'ue-lúz-de-américa' }]);
    if (url.endsWith('/admin/users/person')) return Response.json({ email, email_confirmed_at: 'confirmed' });
    if (url.includes('/otp?')) {
      const redirect = new URL(new URL(url).searchParams.get('redirect_to'));
      assert.equal(redirect.origin, origin);
      assert.equal(redirect.searchParams.get('slug'), 'ue-luz-de-america');
      assert.deepEqual(JSON.parse(options.body), { email, create_user: false });
      return Response.json({}, { status });
    }
    throw new Error(`Unexpected ${url}`);
  };
  return { calls, request, fetcher };
}

test('expired-link recovery works without a session using stored pending identity on either origin', async () => {
  for (const [index, origin] of env.allowedOrigins.entries()) {
    const f = setup(`recover${index}@example.test`, { origin });
    const response = await handleTenantInvitation(f.request(), env, f.fetcher);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).accepted, true);
    assert(!f.calls.some(call => ['PUT', 'DELETE'].includes(call.options.method)));
    const repeated = await handleTenantInvitation(f.request(), env, f.fetcher);
    assert.equal(repeated.status, 429);
  }
});

test('no pending invitation returns the same private acceptance without sending email', async () => {
  const f = setup('notpending@example.test', { pending: false });
  const response = await handleTenantInvitation(f.request(), env, f.fetcher);
  assert.deepEqual(await response.json(), { accepted: true, retryAfter: 60 });
  assert(!f.calls.some(call => call.url.includes('/otp?')));
});

test('provider throttling exposes cooldown without creating or activating a membership', async () => {
  const f = setup('limited@example.test', { status: 429 });
  const response = await handleTenantInvitation(f.request(), env, f.fetcher);
  assert.equal(response.status, 429);
  assert.equal((await response.json()).retryAfter, 60);
  assert(!f.calls.some(call => call.url.includes('/rpc/')));
});

test('unapproved origins cannot use public recovery', async () => {
  const f = setup('blocked@example.test', { origin: 'https://other.test' });
  const response = await handleTenantInvitation(f.request(), env, f.fetcher);
  assert.equal(response.status, 403);
  assert.equal(f.calls.length, 0);
});
