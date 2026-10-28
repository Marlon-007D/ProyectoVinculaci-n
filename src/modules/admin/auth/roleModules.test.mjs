import test from 'node:test';
import assert from 'node:assert/strict';
import { assignedRoleModules } from './roleModules.ts';

test('canonical roles and aliases automatically add their module without losing selected grants', () => {
  for (const [role, module] of [['dece','dece'],['dece_staff','dece'],['projects_manager','projects'],['project_manager','projects'],['content_editor','portal'],['editor','portal']]) {
    assert.deepEqual(assignedRoleModules(role, ['inicio','inicio'], ['inicio',module]), ['inicio',module]);
    assert.deepEqual(assignedRoleModules(role, [], [module]), [module]);
    assert.throws(() => assignedRoleModules(role, [], ['inicio']), /habilitado/);
  }
});

test('student, teacher, secretary, staff and guest keep only the explicitly selected enabled modules', () => {
  for (const role of ['teacher','secretary','staff','guest']) {
    assert.deepEqual(assignedRoleModules(role, ['simuladores','portal'], ['simuladores']), ['simuladores']);
    assert.deepEqual(assignedRoleModules(role, [], ['simuladores']), []);
  }
});

test('student receives enabled learning modules without enabling disabled or administrative modules', () => {
 assert.deepEqual(assignedRoleModules('student', [], ['inicio','projects','simuladores','dece','portal']), ['inicio','projects','simuladores']);
 assert.deepEqual(assignedRoleModules('student', [], ['inicio']), ['inicio']);
});
