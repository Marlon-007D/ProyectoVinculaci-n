import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeInvitationSession, markInvitationSession, replaceInvitationHistory } from './invitationCompletionNavigation.ts';

test('the completion notification is consumed once for the same account and institution only', () => {
  markInvitationSession('person', 'school');
  assert.equal(consumeInvitationSession('other', 'school'), false);
  assert.equal(consumeInvitationSession('person', 'other'), false);
  assert.equal(consumeInvitationSession('person', 'school'), true);
  assert.equal(consumeInvitationSession('person', 'school'), false);
});

test('completion replaces the callback with exactly one tenant pair on local and production origins', () => {
  for (const origin of ['http://localhost:5173', 'https://proyectovinculaci-n.onrender.com']) {
    for (const slug of ['ue-la-concordia', 'ue-luz-de-america', 'ue-el-esfuerzo', 'ue-puerto-limon']) {
      let current = `${origin}/panel/admin?institution=old&slug=old&accept_invitation=1&token_hash=secret#access_token=secret&type=invite`;
      const state = { idx: 3, key: 'router-key' };
      const history = { state, replaceState: (nextState, title, url) => {
        assert.equal(nextState, state);
        current = new URL(url, origin).href;
      } };
      const destination = replaceInvitationHistory(history, 'verified-id', slug);
      const cleaned = new URL(current);
      assert.equal(cleaned.pathname, '/panel/admin');
      assert.equal(cleaned.hash, '');
      assert.deepEqual([...cleaned.searchParams], [['institution', 'verified-id'], ['slug', slug]]);
      assert.equal(new URL(destination, origin).href, current);
      // Repeating completion or reloading the resulting URL cannot restore tokens.
      replaceInvitationHistory(history, 'verified-id', slug);
      assert.equal(new URL(current).hash, '');
    }
  }
});
