import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticatedDestination } from './authenticatedDestination.ts';

test('verified sessions use private destinations with a clean tenant pair in four schools', () => {
  for (const institution_id of ['a','b','c','d']) {
    for (const [role, module, path] of [['super_admin',null,'admin'],['institution_admin',null,''],['dece','dece','dece'],['projects_manager','projects','proyectos'],['content_editor','portal','portal'],['student','simuladores','simuladores'],['teacher',null,''],['secretary',null,''],['staff',null,'']]) {
      const institution = { institution_id, slug: 'school-'+institution_id, role, is_active: true, module_permissions: module ? { [module]: true } : {} };
      const destination = authenticatedDestination(institution, institution_id, role, `?institution=${institution_id}&slug=school-${institution_id}&accept_invitation=1&error=stale`);
      assert.equal(destination, `/panel${path ? '/' + path : ''}?institution=${institution_id}&slug=school-${institution_id}`);
    }
  }
});

test('missing, stale and cross-tenant permissions cannot redirect authenticated users to another school', () => {
  const institution = { institution_id: 'a', slug: 'school-a', role: 'dece', is_active: true, module_permissions: {} };
  assert.equal(authenticatedDestination(institution, 'a', 'dece_staff', '?institution=a'), '/panel?institution=a&slug=school-a');
  for (const [id,role,search] of [['b','dece',''],['a',null,''],['a','student',''],['a','dece','?institution=b'],['a','dece','?slug=school-b']]) {
    assert.equal(authenticatedDestination(institution,id,role,search),null);
  }
  assert.equal(authenticatedDestination({...institution,is_active:false},'a','dece',''),null);
});
