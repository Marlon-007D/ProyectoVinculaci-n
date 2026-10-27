import test from 'node:test';
import assert from 'node:assert/strict';
import { authProviderHarness } from './mocks/authProviderHarness.mjs';

const session = role => ({ user: { id: 'profile', app_metadata: { role } }, access_token: 'test-token' });

test('Google OAuth reads the current browser origin at sign-in time for all four institutions', async t => {
  const app = authProviderHarness(t);
  await app.until(value => !value.loading);
  for (const origin of ['http://localhost:5173', 'https://proyectovinculaci-n.onrender.com']) {
    app.setOrigin(origin);
    for (const slug of ['ue-la-concordia', 'ue-luz-de-america', 'ue-el-esfuerzo', 'ue-puerto-limon']) {
      const result = await app.value.loginWithGoogle({ institution: `id-${slug}`, slug });
      assert.equal(result.error, null);
      const request = app.oauthRequests.at(-1);
      assert.equal(request.provider, 'google');
      const callback = new URL(request.options.redirectTo);
      assert.equal(callback.origin, origin);
      assert.equal(callback.pathname, '/panel/admin');
      assert.deepEqual([...callback.searchParams], [['institution', `id-${slug}`], ['slug', slug]]);
      assert.equal(callback.hash, '');
    }
  }
  assert.equal(app.oauthRequests.length, 8);
});

test('a fresh password sign-in resolves the role instead of remaining in loading', async t => {
  const app = authProviderHarness(t);
  await app.until(value => !value.loading);
  app.emit('SIGNED_IN', session('authenticated'));
  await app.until(value => !value.loading && value.role === 'institution_admin');
  assert.equal(app.value.roleIssue, null);
});

for (const role of ['super_admin', 'superadmin']) {
  test(`${role} in metadata cannot replace the institution membership`, async t => {
    const app = authProviderHarness(t, session(role));
    await app.until(value => !value.loading && value.role === 'institution_admin');
    assert.equal(app.calls.includes('memberships'), true);
    assert.equal(app.value.institutionId, 'a');
    assert.equal(app.value.roleIssue, null);
  });
}

test('changing the selected institution resolves its own assigned role', async t => {
  const app = authProviderHarness(t, session('authenticated'));
  await app.until(value => !value.loading && value.role === 'institution_admin');
  app.scope('?institution=b&slug=school-b');
  await app.until(value => !value.loading && value.role === 'student');
  assert.equal(app.value.institutionId, 'b');
  assert.equal(app.value.roleIssue, null);
});

test('a rejected membership query is an error instead of permission to request access', async t => {
  const app = authProviderHarness(t);
  await app.until(value => !value.loading);
  app.setQuery(async () => { throw new Error('Offline'); });
  app.emit('SIGNED_IN', session('authenticated'));
  await app.until(value => !value.loading && value.roleIssue === 'verification-failed');
  assert.equal(app.value.role, null);
});

test('token refresh preserves access and a late response cannot regrant access after sign-out', async t => {
  const app = authProviderHarness(t, session('authenticated'));
  await app.until(value => !value.loading && value.role === 'institution_admin');
  let release;
  let entered = false;
  app.setQuery(async () => { entered = true; return new Promise(resolve => { release = resolve; }); });
  app.emit('TOKEN_REFRESHED', session('authenticated'));
  await app.until(() => entered);
  assert.equal(app.value.role, 'institution_admin');
  assert.equal(app.value.roleIssue, null);
  app.emit('SIGNED_OUT', null);
  release([]);
  await app.until(value => !value.loading && !value.user);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(app.value.role, null);
  assert.equal(app.value.roleIssue, null);
});
