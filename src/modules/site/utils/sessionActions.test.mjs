import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSessionActions } from './sessionActions.ts';

const school = { institution_id: 'id-1', slug: 'ue-luz' };

test('signed out: only the login link', () => {
  assert.deepEqual(publicSessionActions(false, school), [{ kind: 'login', label: 'Iniciar sesión', to: '/ue-luz/login?institution=id-1' }]);
});

test('signed in: only sign-out, never the login link or a panel shortcut', () => {
  assert.deepEqual(publicSessionActions(true, school), [{ kind: 'logout', label: 'Salir' }]);
});

test('without an institution there is nothing to offer', () => {
  assert.deepEqual(publicSessionActions(true), []);
  assert.deepEqual(publicSessionActions(false), []);
});
