
import test from 'node:test';
import assert from 'node:assert/strict';
import { performInstitutionalRegistration, registrationError } from '../../src/core/auth/registrationFlow.ts';
const input = { email: ' Ana@Example.ec ', password: 'a-long-test-password', firstName: ' Ana ', lastName: ' Ruiz ', institutionId: 'tenant-test' };
test('registration invokes only the pending-registration endpoint without Auth email or login calls', async () => {
  let calls = 0;
  const result = await performInstitutionalRegistration({
    async invoke(name, options) {
      calls++;
      assert.equal(name, 'register-institution-user');
      assert.deepEqual(options.body, { email: 'ana@example.ec', password: input.password, firstName: 'Ana', lastName: 'Ruiz', institutionId: 'tenant-test' });
      return { data: { registered: true }, error: null };
    },
  }, input);
  assert.equal(calls, 1);
  assert.equal(result.error, null);
  assert.deepEqual(Object.keys(result), ['error']);
});
test('registration does not claim success if pending membership was not persisted', async () => {
  const result = await performInstitutionalRegistration({ async invoke() { return { data: { registered: false }, error: null }; } }, input);
  assert.ok(result.error);
});
test('registration preserves the actual Supabase error message', async () => {
  const result = await performInstitutionalRegistration({ async invoke() { return { data: null, error: new Error('User already registered') }; } }, input);
  assert.ok(result.error);
  assert.equal(result.error.message, 'User already registered');
});
test('registration extracts the server error from FunctionsHttpError context', async () => {
  const response = new Response(JSON.stringify({ error: 'Email address is invalid' }), { status: 400 });
  const result = await registrationError({ message: 'Edge Function returned a non-2xx status code', context: response });
  assert.equal(result.message, 'Email address is invalid');
  assert.equal(response.bodyUsed, false);
});
test('registration preserves transport errors when the response is not JSON', async () => {
  const result = await registrationError({ message: 'Failed to fetch', context: new Response('Bad gateway') });
  assert.equal(result.message, 'Failed to fetch');
});
