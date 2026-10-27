import test from 'node:test';
import assert from 'node:assert/strict';
import { canAssignTenantRole, canManageTenantMember, resolveAssignedAccess } from './accessPolicy.ts';
import { authProviderHarness } from './mocks/authProviderHarness.mjs';

test('Super Admin assigns Admin; Admin assigns internal roles only', () => {
  for (const alias of ['super_admin','superadmin']) {
    assert.equal(canAssignTenantRole(alias,'admin'),true);
    assert.equal(canAssignTenantRole(alias,'institution_admin'),true);
    for (const internal of ['teacher','secretary','staff','student']) assert.equal(canAssignTenantRole(alias,internal),false);
  }
  for (const alias of ['admin','institution_admin']) {
    for (const internal of ['teacher','docente','secretary','secretaria','staff','personal','dece_staff','editor','project_manager']) assert.equal(canAssignTenantRole(alias,internal),true);
    assert.equal(canAssignTenantRole(alias,'super_admin'),false);
    assert.equal(canAssignTenantRole(alias,'institution_admin'),false);
  }
});

test('hierarchy rejects self changes and cross-tenant operations even for Super Admin', () => {
  const actor = { profileId:'actor',institutionId:'a',role:'super_admin' };
  assert.equal(canManageTenantMember(actor,{profileId:'other',institutionId:'b',role:'institution_admin'}),false);
  assert.equal(canManageTenantMember(actor,{profileId:'actor',institutionId:'a',role:'institution_admin'}),false);
  assert.equal(canManageTenantMember(actor,{profileId:'other',institutionId:'a',role:'institution_admin'}),true);
  assert.equal(canManageTenantMember(actor,{profileId:'other',institutionId:'a',role:'superadmin'}),false);
});

test('the same person can be Super Admin in A and staff in B without inheriting A privileges', async t => {
  const app = authProviderHarness(t,{user:{id:'profile',app_metadata:{role:'super_admin'}},access_token:'test-token'});
  app.setQuery(async table => {
    if (table==='memberships') return [{institution_id:'a',role_id:'super'},{institution_id:'b',role_id:'staff'}];
    if (table==='roles') return [{role_id:'super',name:'super_admin'},{role_id:'staff',name:'staff'}];
    return [{institution_id:'a',slug:'school-a',is_active:true},{institution_id:'b',slug:'school-b',is_active:true}];
  });
  await app.until(value => !value.loading && value.role==='super_admin');
  assert.equal(app.value.institutionId,'a');
  app.scope('?institution=b&slug=school-b');
  await app.until(value => !value.loading && value.role==='staff');
  assert.equal(app.value.institutionId,'b');
  app.scope('?institution=c&slug=school-c');
  await app.until(value => !value.loading && value.roleIssue==='membership-required');
  assert.equal(app.value.role,null);
  assert.equal(app.value.institutionId,null);
});

test('a Super Admin role in an inactive institution cannot authorize another institution', () => {
  assert.equal(resolveAssignedAccess([{institutionId:'a',slug:'school-a',role:'super_admin',active:false}],{institution:'a'}).status,'unassigned');
});
