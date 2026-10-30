import test from 'node:test';
import assert from 'node:assert/strict';
import { authProviderHarness } from './mocks/authProviderHarness.mjs';

const session = role => ({ user: { id: 'profile', app_metadata: { role } }, access_token: 'test-token' });

test('logout overrides an awaiting legacy sidebar redirect and then releases public navigation', async t => {
  const app = authProviderHarness(t, session('admin'));
  app.scope('?institution=a&slug=school-a');
  await app.until(value => !value.loading && value.role === 'institution_admin');
  const logoutStart = app.snapshots.length;
  await app.value.logout();
  // The existing sidebar continues after await logout and navigates to a guard.
  app.navigate('/login?institution=a&slug=school-a');
  await app.until(() => app.location.pathname === '/');
  assert.equal(app.location.search, '?institution=a');
  assert.equal(app.value.user, null);
  await new Promise(resolve => setTimeout(resolve, 15));
  const transition = app.snapshots.slice(logoutStart);
  assert(transition.some(snapshot => snapshot.hidden));
  assert(!transition.some(snapshot => snapshot.loading && !snapshot.hidden));
  app.navigate('/login?institution=a&slug=school-a');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(app.location.pathname, '/login');
});

test('Google sessions expose the DECE workspace role only for a verified active membership in the selected school', async t => {
  const app = authProviderHarness(t);
  await app.until(value => !value.loading);
  app.setQuery(async table => {
    if (table === 'memberships') return [{ institution_id: 'a', role_id: 'dece-role' }];
    if (table === 'roles') return [{ role_id: 'dece-role', name: 'dece' }];
    if (table === 'institutions') return [{ institution_id: 'a', slug: 'school-a', is_active: true }];
    throw new Error('Unexpected table');
  });
  app.emit('SIGNED_IN', session('google'));
  await app.until(value => !value.loading && value.role === 'dece_staff');
  assert.equal(app.value.institutionId, 'a');
  app.scope('?institution=b&slug=school-b');
  await app.until(value => !value.loading && value.roleIssue === 'membership-required');
  assert.equal(app.value.role, null);
});

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

const mfaAccount = { accountHasMfa: true, enrollmentRequired: true };
const signInMethods = [['password', 'password'], ['Google', null], ['enlace por correo', 'email_totp'], ['otra pestaña', null]];

for (const [name, loginMethod] of signInMethods) {
  test(`with MFA switched off, ${name} sign-in never asks for a code or enrollment`, async t => {
    const app = authProviderHarness(t, session('admin'), { ...mfaAccount, mfaEnabled: false, loginMethod });
    await app.until(value => !value.loading && value.role === 'institution_admin');
    assert.equal(app.value.mfaRequired, false);
    assert.equal(app.value.mfaEnrollmentRequired, false);
    assert.equal(app.value.mfaChallengeReady, false);
  });
}

test('with MFA switched on, non-password sign-ins still ask for the code and the enrollment', async t => {
  const challenged = authProviderHarness(t, session('admin'), { accountHasMfa: true, loginMethod: null });
  await challenged.until(value => value.mfaRequired);
  assert.equal(challenged.value.mfaChallengeReady, true);
  const enrolling = authProviderHarness(t, session('admin'), { enrollmentRequired: true, loginMethod: 'email_totp' });
  await enrolling.until(value => !value.loading && value.mfaEnrollmentRequired);
  assert.equal(enrolling.value.mfaRequired, false);
});

test('with MFA switched on, a password sign-in keeps skipping the second factor', async t => {
  const app = authProviderHarness(t, session('admin'), { ...mfaAccount, loginMethod: 'password' });
  await app.until(value => !value.loading && value.role === 'institution_admin');
  assert.equal(app.value.mfaRequired, false);
  assert.equal(app.value.mfaEnrollmentRequired, false);
});

const twoSchools = async table => {
  if (table === 'memberships') return [{ institution_id: 'a', role_id: 'admin' }, { institution_id: 'b', role_id: 'admin' }];
  if (table === 'roles') return [{ role_id: 'admin', name: 'institution_admin' }];
  if (table === 'institutions') return [{ institution_id: 'a', slug: 'school-a', is_active: true }, { institution_id: 'b', slug: 'school-b', is_active: true }];
  throw new Error(`Unexpected table: ${table}`);
};

test('choosing another institution waits for its own access and the choice is kept', async t => {
  const app = authProviderHarness(t, session('admin'));
  app.setQuery(twoSchools);
  app.scope('?institution=a&slug=school-a');
  await app.until(value => !value.loading && value.institutionId === 'a');
  const before = app.snapshots.length;
  app.scope('?institution=b&slug=school-b');
  await app.until(value => !value.loading && value.institutionId === 'b');
  assert(app.snapshots.slice(before).some(snapshot => snapshot.loading), 'the page must not show institution A data as B');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(app.value.institutionId, 'b');
  assert.equal(app.value.role, 'institution_admin');
  app.scope('?institution=a&slug=school-a');
  await app.until(value => !value.loading && value.institutionId === 'a');
  assert.equal(app.value.institutionId, 'a');
});

test('adding the already-resolved institution to the URL does not raise loading', async t => {
  const app = authProviderHarness(t, session('admin'));
  app.setQuery(twoSchools);
  app.scope('');
  await app.until(value => !value.loading && value.institutionId === 'a');
  const before = app.snapshots.length;
  app.scope('?institution=a&slug=school-a');
  await new Promise(resolve => setTimeout(resolve, 40));
  assert(app.snapshots.slice(before).every(snapshot => !snapshot.loading));
  assert.equal(app.value.institutionId, 'a');
});
