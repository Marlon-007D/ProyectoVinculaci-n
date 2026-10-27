import test from 'node:test';
import assert from 'node:assert/strict';
import { completeInvitationAccount, invitationPasswordIssue } from './completeInvitationAccount.ts';

function fixture() {
  const calls = [];
  const session = { user: { id: 'person' }, expires_at: Date.now() / 1000 + 3600 };
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: session.user }, error: null }),
    updateUser: async () => { calls.push('password'); return { error: null }; },
    refreshSession: async () => { calls.push('refresh'); return { data: { session }, error: null }; },
    signInWithPassword: async () => { calls.push('sign-in'); return { data: { session }, error: null }; },
  };
  const accounts = {
    load: async () => ({ pending: true, slug: 'school' }),
    accept: async id => { calls.push(`accept:${id}`); },
  };
  const input = { userId: 'person', institutionId: 'school-id', slug: 'school', password: 'abcdef' };
  return { auth, accounts, input, calls };
}

test('completion establishes the Admin session preference before emitting metadata or token updates', async () => {
  const f = fixture();
  let prepared = false;
  f.auth.getUser = async () => ({ data: { user: { id: 'person', user_metadata: { admin_tenant_onboarding: true } } }, error: null });
  f.auth.updateUser = async attributes => {
    if (attributes.data) assert.equal(prepared, true);
    return { error: null };
  };
  f.auth.refreshSession = async () => { assert.equal(prepared, true); return { error: null }; };
  await completeInvitationAccount(f.auth, f.accounts, f.input, undefined, () => {
    assert.deepEqual(f.calls, ['accept:school-id']);
    prepared = true;
  });
  assert.equal(prepared, true);
});

test('only an AAL2 rejection on pending access uses the administrative password adapter before acceptance', async () => {
  const f = fixture();
  f.auth.updateUser = async () => ({ error: { code: 'insufficient_aal', message: 'AAL2 session is required' } });
  await completeInvitationAccount(f.auth, f.accounts, f.input, async (institutionId, password) => {
    assert.equal(institutionId, 'school-id'); assert.equal(password, 'abcdef'); f.calls.push('server-password');
  });
  assert.deepEqual(f.calls, ['server-password', 'accept:school-id', 'sign-in']);
});

test('administrative password failure never activates access', async () => {
  const f = fixture();
  f.auth.updateUser = async () => ({ error: { code: 'insufficient_aal', message: 'AAL2 session is required' } });
  await assert.rejects(completeInvitationAccount(f.auth, f.accounts, f.input, async () => { throw new Error('Expired invitation'); }), /Expired invitation/);
  assert.deepEqual(f.calls, []);
});

test('invitation passwords accept simple six to ten character values and reject mismatches', () => {
  for (const password of ['abcdef', '12345678', 'abcdefghij']) assert.equal(invitationPasswordIssue(password, password), null);
  assert.match(invitationPasswordIssue('short', 'short'), /6 caracteres/);
  assert.match(invitationPasswordIssue('abcdef', 'ghijkl'), /no coinciden/);
});

test('password is saved before accepting only the selected institution', async () => {
  const f = fixture();
  assert.equal((await completeInvitationAccount(f.auth, f.accounts, f.input)).synchronized, true);
  assert.deepEqual(f.calls, ['password', 'accept:school-id', 'refresh']);
});

test('missing or switched sessions never update credentials or membership', async () => {
  for (const session of [null, { user: { id: 'other' } }]) {
    const f = fixture(); f.auth.getSession = async () => ({ data: { session }, error: null });
    await assert.rejects(completeInvitationAccount(f.auth, f.accounts, f.input), /sesión/);
    assert.deepEqual(f.calls, []);
  }
});

test('password errors preserve provider details and prevent activation', async () => {
  const f = fixture(); f.auth.updateUser = async () => ({ error: { code: 'weak_password', message: 'Minimum 8 characters' } });
  await assert.rejects(completeInvitationAccount(f.auth, f.accounts, f.input), /Minimum 8 characters/);
  assert.deepEqual(f.calls, []);
});

test('acceptance can be retried with an already saved password', async () => {
  const f = fixture(); f.auth.updateUser = async () => ({ error: { code: 'same_password' } });
  await completeInvitationAccount(f.auth, f.accounts, f.input);
  assert.deepEqual(f.calls, ['accept:school-id', 'refresh']);
});

test('activation failure is distinguished from password failure', async () => {
  const f = fixture(); f.accounts.accept = async () => { throw new Error('Permiso rechazado'); };
  await assert.rejects(completeInvitationAccount(f.auth, f.accounts, f.input), /contraseña se guardó.*Permiso rechazado/);
});

test('post-activation synchronization failure does not report a failed password save', async () => {
  const f = fixture(); f.auth.refreshSession = async () => { throw new Error('Network'); };
  assert.equal((await completeInvitationAccount(f.auth, f.accounts, f.input)).synchronized, false);
});
