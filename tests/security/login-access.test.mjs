import test from 'node:test';
import assert from 'node:assert/strict';
import { institutionMatches, loginDestination, resolveLoginAccess } from '../../src/core/auth/loginAccess.ts';

const effort = { institution_id: 'effort-id', slug: 'ue-el-esfuerzo', role: 'institution_admin', is_active: true };
const light = { institution_id: 'light-id', slug: 'ue-luz-de-america', role: 'student', is_active: true };

test('login accepts either slug or ID from verified memberships', () => {
  for (const reference of ['ue-el-esfuerzo', 'effort-id', 'EFFORT-ID']) {
    assert.equal(resolveLoginAccess([effort, light], [reference]).destination, '/panel/admin?institution=effort-id');
  }
  assert.equal(resolveLoginAccess([effort, light], ['outdated-slug', 'light-id']).destination, '/ue-luz-de-america/mi-ficha?institution=light-id');
  assert.equal(resolveLoginAccess([effort, light], ['ue-el-esfuerzo', 'light-id']).destination, '/panel/admin?institution=effort-id');
});

test('a stale URL does not reject a user with one active membership or grant the requested institution', () => {
  assert.deepEqual(resolveLoginAccess([effort], ['foreign-institution']), {
    status: 'redirect', destination: '/panel/admin?institution=effort-id',
  });
});

test('multiple memberships require selection when the requested institution is unavailable', () => {
  assert.deepEqual(resolveLoginAccess([effort, light], ['foreign-institution']), { status: 'select', institutions: [effort, light] });
});

test('inactive and absent memberships cannot authorize login destinations', () => {
  assert.deepEqual(resolveLoginAccess([{ ...effort, is_active: false }], ['effort-id']), { status: 'unassigned' });
  assert.deepEqual(resolveLoginAccess([], ['effort-id']), { status: 'unassigned' });
  assert.equal(resolveLoginAccess([{ ...effort, is_active: false }, light], ['effort-id']).destination, loginDestination(light));
});

test('role destinations preserve team routes and support existing role aliases', () => {
  for (const [role, path] of [
    ['super_admin', '/panel/superadmin'], ['institution_admin', '/panel/admin'],
    ['dece', '/ue-el-esfuerzo/dece'], ['dece_staff', '/ue-el-esfuerzo/dece'],
    ['student', '/ue-el-esfuerzo/mi-ficha'], ['project_manager', '/panel/proyectos'],
    ['projects_manager', '/panel/proyectos'], ['editor', '/panel/portal'],
    ['content_editor', '/panel/portal'], ['unknown', '/ue-el-esfuerzo/sin-modulos'],
  ]) assert.equal(loginDestination({ ...effort, role }), path + '?institution=effort-id');
  assert.equal(loginDestination({ ...effort, role: 'viewer' }), '/proyectos?transparency=1&institution=ue-el-esfuerzo');
});

test('registration can match a public institution reference without inventing an ID', () => {
  assert.equal(institutionMatches(effort, 'ue-el-esfuerzo'), true);
  assert.equal(institutionMatches(effort, 'effort-id'), true);
  assert.equal(institutionMatches({ institution_id: 'effort-id' }, ''), false);
});
