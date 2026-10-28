import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialPrivateLoadRegistry } from './initialPrivateLoad.ts';

test('private panels claim their initial loading once across remounts', () => {
  const registry = createInitialPrivateLoadRegistry();
  assert.equal(registry.claim('person', 'panel'), true);
  assert.equal(registry.claim('person', 'panel'), false);
  assert.equal(registry.claim('person', 'members'), true);
  assert.equal(registry.claim('person', 'members'), false);
});

test('logout and account changes start a new visual session without retaining records', () => {
  const registry = createInitialPrivateLoadRegistry();
  registry.claim('first', 'panel');
  assert.equal(registry.claim('second', 'panel'), true);
  registry.clear();
  assert.equal(registry.claim('second', 'panel'), true);
});
