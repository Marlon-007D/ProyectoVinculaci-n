import test from 'node:test';
import assert from 'node:assert/strict';
import { canAssignRole, canonicalRole } from '../../src/core/auth/institutionalRoles.ts';

test('superadmin assigns institutional administrators exclusively', () => {
  assert.equal(canAssignRole('super_admin', 'institution_admin'), true);
  for (const role of ['dece', 'dece_staff', 'projects_manager', 'project_manager', 'content_editor', 'editor', 'student', 'guest', 'pending', 'super_admin']) {
    assert.equal(canAssignRole('super_admin', role), false);
  }
});
test('institutional administrators assign operational roles and cannot promote administrators', () => {
  for (const role of ['dece', 'dece_staff', 'projects_manager', 'project_manager', 'content_editor', 'editor', 'student']) {
    assert.equal(canAssignRole('institution_admin', role), true);
  }
  for (const role of ['super_admin', 'institution_admin', 'guest', 'pending', 'viewer', 'unknown']) {
    assert.equal(canAssignRole('institution_admin', role), false);
  }
});
test('pending and operational accounts cannot manage roles', () => {
  for (const actor of [null, 'guest', 'pending', 'viewer', 'student', 'dece_staff', 'dece', 'projects_manager', 'content_editor']) {
    assert.equal(canAssignRole(actor, 'student'), false);
    assert.equal(canAssignRole(actor, 'institution_admin'), false);
  }
  assert.equal(canonicalRole('viewer'), 'pending');
  assert.equal(canonicalRole('dece_staff'), 'dece');
});
