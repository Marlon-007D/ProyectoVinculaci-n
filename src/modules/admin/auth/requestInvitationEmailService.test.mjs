import test from 'node:test';
import assert from 'node:assert/strict';
import { requestInvitationEmailService } from './requestInvitationEmailService.ts';

test('expired link sends only email and institution to the existing Edge Function', async () => {
  const client = { functions: { invoke: async (name, options) => {
    assert.equal(name, 'admin-tenant-invite');
    assert.deepEqual(options.body, { action: 'request_invitation_email', email: 'person@example.test', institutionId: 'school' });
    return { data: { accepted: true, retryAfter: 60 }, error: null };
  } } };
  assert.equal((await requestInvitationEmailService(client, 'person@example.test', 'school')).accepted, true);
});

test('rate limits retain server cooldown and never report successful delivery', async () => {
  const client = { functions: { invoke: async () => ({ data: null, error: { context: Response.json({ retryAfter: 90 }, { status: 429 }) } }) } };
  const result = await requestInvitationEmailService(client, 'person@example.test', 'school');
  assert.equal(result.rateLimited, true);
  assert.equal(result.retryAfter, 90);
  assert.equal(result.accepted, undefined);
});
