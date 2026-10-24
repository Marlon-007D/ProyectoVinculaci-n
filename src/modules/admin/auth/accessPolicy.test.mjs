import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAssignedAccess } from './accessPolicy.ts';

const membership = { institutionId: 'institution-a', slug: 'school-a', role: 'institution_admin', active: true };

for (const role of ['super_admin', 'superadmin']) {
  test(`${role} ignores tenant selection`, () => {
    assert.deepEqual(resolveAssignedAccess([{ ...membership, role }], { institution: 'other', slug: 'other' }),
      { status: 'authorized', role: 'super_admin', institutionId: null });
  });
}

for (const role of ['institution_admin', 'dece', 'dece_staff', 'projects_manager', 'project_manager', 'content_editor', 'editor', 'student']) {
  test(`${role} grants access only to the assigned active institution`, () => {
    const items = [{ ...membership, role }];
    assert.equal(resolveAssignedAccess(items, { institution: 'institution-a', slug: 'school-a' }).status, 'authorized');
    assert.equal(resolveAssignedAccess(items, { institution: 'SCHOOL-A' }).status, 'authorized');
    assert.equal(resolveAssignedAccess(items, { institution: 'institution-b' }).status, 'unassigned');
    assert.equal(resolveAssignedAccess(items, { institution: 'institution-a', slug: 'school-b' }).status, 'unassigned');
    assert.equal(resolveAssignedAccess([{ ...membership, role, active: false }], {}).status, 'unassigned');
  });
}

test('a pending row cannot mask an approved role or a role in another institution', () => {
  const items = [{ ...membership, role: 'pending' }, membership,
    { ...membership, institutionId: 'institution-b', slug: 'school-b', role: 'student' }];
  assert.equal(resolveAssignedAccess(items, {}).role, 'institution_admin');
  assert.equal(resolveAssignedAccess(items, { slug: 'school-b' }).role, 'student');
});

test('unverified roles are errors; empty or pending memberships allow requesting access', () => {
  assert.equal(resolveAssignedAccess([], {}).status, 'unassigned');
  for (const role of ['pending', 'viewer', 'guest', 'invitado']) {
    assert.equal(resolveAssignedAccess([{ ...membership, role }], {}).status, 'unassigned');
  }
  for (const role of [null, 'unknown']) {
    assert.equal(resolveAssignedAccess([{ ...membership, role }], {}).status, 'verification-failed');
  }
});
