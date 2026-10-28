import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSuperAdminAccess, isSuperAdmin } from './superAdmin.ts';

for (const role of ['super_admin', 'superadmin']) {
  test(role + ' is resolved without checking tenant authority', async () => {
    let checks = 0;
    const granted = await hasSuperAdminAccess('profile', {
      getVerifiedRole: async profileId => { assert.equal(profileId, 'profile'); return role; },
      hasGlobalRole: async () => { checks++; throw new Error('Tenant unavailable'); },
    });
    assert.equal(granted, true);
    assert.equal(checks, 0);
  });
}

test('the backend authority supports membership-based global roles', async () => {
  assert.equal(await hasSuperAdminAccess('profile', {
    getVerifiedRole: async () => null, hasGlobalRole: async () => true,
  }), true);
});

test('unknown roles and user-editable metadata cannot grant global access', async () => {
  for (const value of ['institution_admin', 'viewer', null, undefined, { user_metadata: { role: 'super_admin' } }]) {
    assert.equal(isSuperAdmin(value), false);
    assert.equal(await hasSuperAdminAccess('profile', {
      getVerifiedRole: async () => value, hasGlobalRole: async () => false,
    }), false);
  }
});
