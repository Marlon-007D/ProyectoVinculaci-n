import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdminAccess, resolveLoginIssue } from './adminAccess.ts';
import { authFormReducer } from '../../../features/auth/utils/authFormState.ts';

const assigned = { loading: false, hasUser: true, role: 'institution_admin', roleIssue: null,
  mfaPending: false, loadingTenant: false, hasInstitution: true, tenantError: null };

test('the callback waits for session validation and returns unassigned accounts to the request flow', () => {
  assert.equal(resolveAdminAccess({ ...assigned, loading: true }).status,'loading');
  assert.deepEqual(resolveAdminAccess({ ...assigned, role: null, roleIssue: 'membership-required' }), { status: 'login', issue: 'membership-required' });
  assert.deepEqual(resolveAdminAccess({ ...assigned, hasUser: false }), { status: 'login', issue: null });
  assert.equal(resolveAdminAccess(assigned).status,'authorized');
});

test('MFA remains ahead of membership checks and transport errors are not missing memberships', () => {
  assert.equal(resolveAdminAccess({ ...assigned, role: null, mfaPending: true }).status,'mfa');
  assert.deepEqual(resolveAdminAccess({ ...assigned, role: null, roleIssue: 'verification-failed' }), { status: 'login', issue: 'verification-failed' });
});

test('OAuth pending state prevents repeat submissions and supports error recovery', () => {
  const pending=authFormReducer({ status: 'idle' }, { type: 'start', method: 'google' });
  assert.equal(authFormReducer(pending,{ type: 'start', method: 'credentials' }),pending);
  assert.equal(authFormReducer(pending,{ type: 'authenticated' }),pending);
  const failed=authFormReducer(pending,{ type: 'failed', message: 'Connection failed' });
  assert.deepEqual(failed,{ status: 'error', message: 'Connection failed' });
  assert.deepEqual(authFormReducer(failed,{ type: 'start', method: 'google' }),pending);
});

for (const role of ['super_admin', 'superadmin']) {
  test(role + ' requires its own verified tenant', () => {
    assert.equal(resolveAdminAccess({ ...assigned, role, loadingTenant: true, hasInstitution: false,
      roleIssue: 'membership-required', tenantError: 'Unavailable' }).status, 'loading');
    assert.equal(resolveAdminAccess({ ...assigned, role, mfaPending: true }).status, 'mfa');
    assert.equal(resolveAdminAccess({ ...assigned, role, hasUser: false }).status, 'login');
    assert.equal(resolveAdminAccess({ ...assigned, role, loading: true }).status, 'loading');
  });
}

test('ordinary administrators still require a verified tenant', () => {
  assert.equal(resolveAdminAccess({ ...assigned, loadingTenant: true }).status, 'loading');
  assert.deepEqual(resolveAdminAccess({ ...assigned, hasInstitution: false }), { status: 'login', issue: 'membership-required' });
  assert.deepEqual(resolveAdminAccess({ ...assigned, hasInstitution: false, tenantError: 'Offline' }), { status: 'login', issue: 'verification-failed' });
});

test('login ignores stale route issues for verified sessions but reports actual tenant failures', () => {
  const input = { hasUser: true, role: 'super_admin', roleIssue: 'membership-required', mfaPending: false,
    loadingTenant: true, hasInstitution: false, tenantError: 'Offline' };
  assert.equal(resolveLoginIssue(input), 'membership-required');
  assert.equal(resolveLoginIssue({ ...input, role: 'superadmin' }), 'membership-required');
  assert.equal(resolveLoginIssue({ ...input, hasUser: false }), null);
  assert.equal(resolveLoginIssue({ ...input, role: null, mfaPending: true }), null);
  assert.equal(resolveLoginIssue({ ...input, role: null }), 'membership-required');
  assert.equal(resolveLoginIssue({ ...input, role: 'institution_admin', roleIssue: null, loadingTenant: false }), 'verification-failed');
  assert.equal(resolveLoginIssue({ ...input, role: 'institution_admin', roleIssue: null, hasInstitution: true }), null);
});
