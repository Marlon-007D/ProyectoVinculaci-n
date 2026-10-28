import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialPrivateLoadRegistry } from './initialPrivateLoad.ts';

test('session and member panels share a single skeleton claim across remounts', () => {
  const registry = createInitialPrivateLoadRegistry();
  assert.equal(registry.claim('person'), true);
  assert.equal(registry.claim('person'), false);
  assert.equal(registry.claim('person'), false);
  assert.equal(registry.claim('person'), false);
});

test('logout and account changes start a new visual session without retaining records', () => {
  const registry = createInitialPrivateLoadRegistry();
  registry.claim('first');
  assert.equal(registry.claim('second'), true);
  registry.clear();
  assert.equal(registry.claim('second'), true);
});

test('secondary URL resolutions and every private role cannot start another skeleton in the same session', () => {
  for (const school of ['a','b','c','d']) {
    for (const role of ['super_admin','institution_admin','dece','student','projects_manager','content_editor','teacher','secretary','staff']) {
      const registry=createInitialPrivateLoadRegistry();
      const session=school+':'+role+':sign-in-time';
      assert.equal(registry.claim(session),true);
      for (const stage of ['members','canonical-url','token-refresh','return-to-panel']) {
        assert.equal(registry.claim(session),false,stage);
      }
    }
  }
});
