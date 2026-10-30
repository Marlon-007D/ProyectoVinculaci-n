import test from 'node:test';
import assert from 'node:assert/strict';
import { institutionSwitchSearch } from './institutionSwitch.ts';
import { resolveTenantIdentity } from './tenantUrl.ts';

const tenants = [
  { institution_id: 'id-luz', slug: 'ue-luz-de-america', name: 'Luz' },
  { institution_id: 'id-esfuerzo', slug: 'ue-el-esfuerzo', name: 'Esfuerzo' },
];

test('switching replaces institution and slug and keeps the other parameters', () => {
  const search = institutionSwitchSearch('?institution=id-luz&slug=ue-luz-de-america&q=ana', tenants[1]);
  const params = new URLSearchParams(search);
  assert.equal(params.get('institution'), 'id-esfuerzo');
  assert.equal(params.get('slug'), 'ue-el-esfuerzo');
  assert.equal(params.get('q'), 'ana');
});

test('the chosen institution is the one the tenant URL resolves, and it stays chosen', () => {
  const search = institutionSwitchSearch('?institution=id-luz&slug=ue-luz-de-america', tenants[1]);
  assert.equal(resolveTenantIdentity(tenants, search)?.institution_id, 'id-esfuerzo');
  assert.equal(resolveTenantIdentity(tenants, institutionSwitchSearch(search, tenants[0]))?.institution_id, 'id-luz');
});
