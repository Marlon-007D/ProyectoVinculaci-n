import test from 'node:test';
import assert from 'node:assert/strict';
import { canRemoveMembership, institutionalRoleOptions, membershipTab, visibleInstitutionMemberships } from './membershipVisibility.ts';

test('assignment options include both operational roles without allowing global role assignment', () => {
  const roles = ['super_admin', 'institution_admin', 'dece_staff', 'project_manager', 'editor', 'student'].map(name => ({ name }));
  assert.deepEqual(institutionalRoleOptions(roles, false).map(role => role.name), ['dece_staff', 'project_manager', 'editor', 'student']);
  assert.equal(institutionalRoleOptions(roles, true).some(role => role.name === 'super_admin'), false);
  assert.equal(institutionalRoleOptions(roles, true).some(role => role.name === 'institution_admin'), true);
});

test('assigning an operational role moves an unassigned account into the team count', () => {
  const members = [
    { profile_id: 'manager', institution_id: 'a', role_name: 'project_manager' },
    { profile_id: 'editor', institution_id: 'a', role_name: 'editor' },
    { profile_id: 'guest', institution_id: 'a', role_name: null },
    { profile_id: 'student', institution_id: 'a', role_name: 'student' },
  ];
  const count = tab => visibleInstitutionMemberships(members, 'a', false).filter(member => membershipTab(member.role_name) === tab).length;
  assert.equal(count('team'), 2);
  assert.equal(count('registered'), 1);
  assert.equal(count('students'), 1);
  members[2].role_name = 'editor';
  assert.equal(count('team'), 3);
  assert.equal(count('registered'), 0);
  assert.equal(count('students'), 1);
});

test('tabs include only their explicit role categories', () => {
  assert.equal(membershipTab('institution_admin'), 'team');
  assert.equal(membershipTab('dece_staff'), 'team');
  assert.equal(membershipTab('project_manager'), 'team');
  assert.equal(membershipTab('editor'), 'team');
  assert.equal(membershipTab('student'), 'students');
  assert.equal(membershipTab(null), 'registered');
  for (const role of ['super_admin', 'viewer', 'unknown']) assert.equal(membershipTab(role), null);
});

test('removing roles rejects the session owner and unauthenticated actors', () => {
  assert.equal(canRemoveMembership('self', 'self', 'institution_admin'), false);
  assert.equal(canRemoveMembership(undefined, 'other', 'dece_staff'), false);
  assert.equal(canRemoveMembership('self', 'other', 'institution_admin'), true);
  assert.equal(canRemoveMembership('self', 'other', 'dece_staff'), true);
  assert.equal(canRemoveMembership('self', 'other', null), false);
});

test('institution changes recalculate memberships without leaking global accounts', () => {
  const members = [
    { profile_id: 'global', institution_id: 'a', role_name: 'super_admin' },
    { profile_id: 'global', institution_id: 'a', role_name: 'institution_admin' },
    { profile_id: 'local', institution_id: 'a', role_name: 'institution_admin' },
    { profile_id: 'registered', institution_id: 'a', role_name: null },
    { profile_id: 'student', institution_id: 'b', role_name: 'student' },
  ];
  assert.deepEqual(visibleInstitutionMemberships(members, 'a', false).map(item => item.profile_id), ['local', 'registered']);
  assert.deepEqual(visibleInstitutionMemberships(members, 'b', false).map(item => item.profile_id), ['student']);
  assert.deepEqual(visibleInstitutionMemberships(members, null, false), []);
  assert.equal(visibleInstitutionMemberships(members, 'a', true).some(item => item.role_name === 'super_admin'), false);
});

test('an account with a special role is not also counted as an unassigned account', () => {
  const members = [
    { profile_id: 'staff', institution_id: 'a', role_name: null },
    { profile_id: 'staff', institution_id: 'a', role_name: 'dece_staff' },
  ];
  assert.deepEqual(visibleInstitutionMemberships(members, 'a', false).map(item => membershipTab(item.role_name)), ['team']);
});

test('destination branch role aliases remain in Personal y Equipo', () => {
  for (const role of ['dece','projects_manager','content_editor']) assert.equal(membershipTab(role),'team');
  for (const role of ['pending','guest','invitado']) assert.equal(membershipTab(role),'registered');
});
