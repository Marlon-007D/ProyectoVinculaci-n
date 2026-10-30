import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSessionActions } from './sessionActions.ts';

const school = { institution_id: 'id-1', slug: 'ue-luz' };

test('signed out: only the login link', () => {
  assert.deepEqual(publicSessionActions(false, school), [{ kind: 'login', label: 'Iniciar sesión', to: '/ue-luz/login?institution=id-1' }]);
});

test('signed in: panel and sign-out, never the login link', () => {
  const actions = publicSessionActions(true, school);
  assert.deepEqual(actions.map(action => action.kind), ['panel', 'logout']);
  assert.equal(actions[0].to, '/panel?institution=id-1&slug=ue-luz');
});

test('without an institution there is nothing to offer', () => {
  assert.deepEqual(publicSessionActions(true), []);
  assert.deepEqual(publicSessionActions(false), []);
});
