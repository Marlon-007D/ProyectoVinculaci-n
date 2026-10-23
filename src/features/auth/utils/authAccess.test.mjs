import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdminAccess } from './adminAccess.ts';
import { authFormReducer } from './authFormState.ts';

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
