import test from 'node:test';
import assert from 'node:assert/strict';
import { resumePasswordSession } from './temporaryPasswordSession.ts';

function preference(initial) {
  const values = new Map(initial === null ? [] : [['auth-login-method', initial]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('overlapping Admin mounts share one real token refresh instead of rotating it twice', async () => {
  const storage = preference(null);
  let finish;
  let calls = 0;
  const refresh = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const first = resumePasswordSession(refresh, storage);
  const second = resumePasswordSession(refresh, storage);
  assert.equal(first, second);
  assert.equal(calls, 1);
  finish({ error: null });
  await Promise.all([first, second]);
  assert.equal(storage.getItem('auth-login-method'), 'password');
});

test('temporary Admin policy refreshes the real session using the existing password flow', async () => {
  const storage = preference(null);
  let refreshed = 0;
  await resumePasswordSession(async () => {
    assert.equal(storage.getItem('auth-login-method'), 'password');
    refreshed++;
    return { error: null };
  }, storage);
  assert.equal(refreshed, 1);
  assert.equal(storage.getItem('auth-login-method'), 'password');
});

test('failed refresh restores the previous preference instead of pretending authentication succeeded', async () => {
  for (const initial of [null, 'email_totp']) {
    const storage = preference(initial);
    await assert.rejects(resumePasswordSession(async () => ({ error: { message: 'Expired session' } }), storage), /Expired session/);
    assert.equal(storage.getItem('auth-login-method'), initial);
    await assert.rejects(resumePasswordSession(async () => { throw new Error('Network unavailable'); }, storage), /Network unavailable/);
    assert.equal(storage.getItem('auth-login-method'), initial);
  }
});
