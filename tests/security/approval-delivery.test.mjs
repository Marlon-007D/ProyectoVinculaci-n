import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverApprovalEmail } from '../../supabase/functions/notify-approved-member/delivery.ts';

const input = { apiKey: 'test-key', from: 'onboarding@resend.dev', to: 'student@example.ec', text: 'Enlace de prueba', siteUrl: 'http://localhost:5173', testMode: true };
const sandbox = () => new Response(JSON.stringify({ message: 'You can only send testing emails to your own email address.' }), { status: 403 });

test('approval delivery sends the configured API token and original recipient', async () => {
  const result = await deliverApprovalEmail(input, async (_url, request) => {
    assert.equal(request.headers.Authorization, 'Bearer test-key');
    assert.deepEqual(JSON.parse(request.body).to, [input.to]);
    return new Response('{}');
  });
  assert.equal(result.status, 'sent');
});

test('local sandbox rejection retries only the authorized test recipient', async () => {
  const recipients = [];
  const result = await deliverApprovalEmail(input, async (_url, request) => {
    recipients.push(JSON.parse(request.body).to[0]);
    return recipients.length === 1 ? sandbox() : new Response('{}');
  });
  assert.deepEqual(recipients, [input.to, 'dmsosa2@espe.edu.ec']);
  assert.equal(result.status, 'testSent');
});

test('production, disabled test mode and unrelated errors never redirect activation links', async () => {
  for (const [settings, response] of [
    [{ ...input, siteUrl: 'https://school.example.ec' }, sandbox],
    [{ ...input, testMode: false }, sandbox],
    [input, () => new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 403 })],
    [input, () => new Response('{}', { status: 429 })],
  ]) {
    let calls = 0;
    const result = await deliverApprovalEmail(settings, async () => { calls++; return response(); });
    assert.equal(calls, 1);
    assert.equal(result.status, 'failed');
  }
});

test('a failed test retry remains failed', async () => {
  let calls = 0;
  const result = await deliverApprovalEmail(input, async () => { calls++; return sandbox(); });
  assert.equal(calls, 2);
  assert.equal(result.status, 'failed');
});
