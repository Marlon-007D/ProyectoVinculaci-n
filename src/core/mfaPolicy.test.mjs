import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMfaEnabled } from './mfaPolicy.ts';

test('MFA stays off unless VITE_MFA_ENABLED is explicitly true', () => {
  for (const value of [undefined, '', 'false', '0', 'no', 'yes', 1, null]) assert.equal(parseMfaEnabled(value), false, String(value));
  for (const value of [true, 'true', ' TRUE ', 'True']) assert.equal(parseMfaEnabled(value), true, String(value));
});
