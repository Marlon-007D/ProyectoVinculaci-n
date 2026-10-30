import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSlug } from './canonicalSlug.ts';

test('canonicalSlug removes accents and trims separators', () => {
  assert.equal(canonicalSlug('  UE Luz de América '), 'ue-luz-de-america');
  assert.equal(canonicalSlug('--a!!b--'), 'a-b');
  assert.equal(canonicalSlug('!!!'), '');
  assert.equal(canonicalSlug('-'.repeat(50000) + 'x'), 'x');
});
