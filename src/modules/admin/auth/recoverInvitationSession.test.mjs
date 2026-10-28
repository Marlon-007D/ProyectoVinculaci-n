import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverInvitationSession } from './recoverInvitationSession.ts';

function client({ session = true, valid = true, school = 'a', slug = 'school-a', pending = true } = {}) {
  const calls = [];
  return { calls, auth: {
    getSession: async () => { calls.push('session'); return { data: { session: session ? { user: { id: 'person' } } : null } }; },
    getUser: async () => ({ error: valid ? null : {}, data: { user: { id: 'person', email: 'person@example.test', email_confirmed_at: 'verified' } } }),
  }, rpc: async name => ({ error: null, data: (name === 'admin_tenant_own_invitation') !== pending ? null : {
    pending, email: 'person@example.test', membership: { institution_id: school, is_active: !pending, institutions: { slug } },
  } }) };
}

test('consumed links recover only after session and scoped identity verification in all four institutions', async () => {
  for (const school of ['a','b','c','d']) {
    for (const pending of [true, false]) {
      const source = client({ school, slug: `school-${school}`, pending });
      assert.equal(await recoverInvitationSession(source, `?institution=${school}&slug=school-${school}`), true);
      assert.equal(source.calls[0], 'session');
    }
  }
});

test('expired links without a verified matching session remain errors', async () => {
  for (const options of [{ session: false }, { valid: false }, { school: 'b' }, { slug: 'school-b' }]) {
    assert.equal(await recoverInvitationSession(client(options), '?institution=a&slug=school-a'), false);
  }
  assert.equal(await recoverInvitationSession(client(), ''), false);
});
