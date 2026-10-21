import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationReducer } from '../../src/modules/auth/registration.types.ts';

const institutions = [{ institution_id: '11111111-1111-4111-8111-111111111111', name: 'Unidad Educativa' }];

test('registration can submit only after loading an available institution', () => {
  const loading = { status: 'loading' };
  assert.equal(registrationReducer(loading, { type: 'submit' }), loading);
  const empty = registrationReducer(loading, { type: 'loaded', institutions: [] });
  assert.equal(registrationReducer(empty, { type: 'submit' }), empty);
  const ready = registrationReducer(loading, { type: 'loaded', institutions });
  const submitting = registrationReducer(ready, { type: 'submit' });
  assert.equal(submitting.status, 'submitting');
  assert.equal(registrationReducer(submitting, { type: 'submit' }), submitting);
});

test('registration failure preserves institutions and allows retry', () => {
  const submitting = { status: 'submitting', institutions };
  const ready = registrationReducer(submitting, { type: 'failed', message: 'No se pudo completar el registro.' });
  assert.deepEqual(ready, { status: 'ready', institutions, error: 'No se pudo completar el registro.' });
  assert.equal(registrationReducer(ready, { type: 'submit' }).status, 'submitting');
  const failedLoad = registrationReducer({ status: 'loading' }, { type: 'loadFailed' });
  assert.equal(failedLoad.status, 'loadError');
  assert.equal(registrationReducer(failedLoad, { type: 'retry' }).status, 'loading');
});

test('registration success is terminal and invalid completion events are ignored', () => {
  const ready = { status: 'ready', institutions };
  assert.equal(registrationReducer(ready, { type: 'succeeded' }), ready);
  const success = registrationReducer({ status: 'submitting', institutions }, { type: 'succeeded' });
  for (const event of [{ type: 'submit' }, { type: 'retry' }, { type: 'failed', message: 'Error' }, { type: 'loaded', institutions }]) {
    assert.equal(registrationReducer(success, event), success);
  }
});
