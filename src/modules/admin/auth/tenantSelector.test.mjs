import test from 'node:test';
import assert from 'node:assert/strict';
import { selectableAdminTenants, tenantSelectionDestination } from '../superadmin/tenantSelection.ts';
import { assignedTenants } from '../superadmin/mocks/assignedTenants.mjs';
import { authProviderHarness } from './mocks/authProviderHarness.mjs';
import { currentAdminScope } from './institutionNavigation.ts';

test('selector lists assigned active Super Admin institutions and rejects other roles or unknown tenants', () => {
  const institutions = [...assignedTenants, assignedTenants[0],
    { ...assignedTenants[0], institution_id: 'inactive', is_active: false },
    { ...assignedTenants[0], institution_id: 'admin', role: 'institution_admin' }];
  assert.deepEqual(selectableAdminTenants(institutions).map(item => item.institution_id), ['a', 'b', 'c', 'd']);
  assert.equal(tenantSelectionDestination(institutions, 'unknown', '', ''), null);
  assert.equal(tenantSelectionDestination(institutions, 'inactive', '', ''), null);
  assert.equal(tenantSelectionDestination(institutions, 'admin', '', ''), null);
});

test('switching all four institutions resolves the same authenticated account without signing in again', async t => {
  const app = authProviderHarness(t, { user: { id: 'profile' }, access_token: 'existing-session' });
  app.setQuery(async table => {
    if (table === 'memberships') return assignedTenants.map(item => ({ institution_id: item.institution_id, role_id: 'super' }));
    if (table === 'roles') return [{ role_id: 'super', name: 'super_admin' }];
    return assignedTenants;
  });
  await app.until(value => !value.loading && value.role === 'super_admin');
  for (const tenant of [...assignedTenants, assignedTenants[0]]) {
    const destination = tenantSelectionDestination(assignedTenants, tenant.institution_id, '?institution=old&slug=old&tab=users', '#members');
    const url = new URL(destination, 'https://proyectovinculaci-n.onrender.com');
    assert.equal(url.pathname, '/panel/admin');
    assert.equal(url.searchParams.get('tab'), 'users');
    assert.equal(url.hash, '#members');
    app.scope(url.search);
    await app.until(value => !value.loading && value.institutionId === tenant.institution_id);
    assert.equal(app.value.role, 'super_admin');
    assert.equal(app.value.user.id, 'profile');
    assert.deepEqual(currentAdminScope(''), { institution: tenant.institution_id, slug: tenant.slug });
  }
});
