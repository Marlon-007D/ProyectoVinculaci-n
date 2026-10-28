import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingInvitationInput } from './pendingInvitation.ts';
import { snapshotFixture } from './mocks/tenantManagement.mjs';

test('resending uses stored pending contact and role for all institutions and both management roles', () => {
  for (const institutionId of ['concordia', 'luz', 'esfuerzo', 'puerto']) {
    for (const actorRole of ['super_admin', 'institution_admin']) {
      const snapshot = snapshotFixture();
      snapshot.institution_id = institutionId;
      snapshot.actor_role = actorRole;
      const member = { ...snapshot.members[0], institution_id: institutionId, is_active: false, invitation_pending: true };
      snapshot.members = [member];
      const input = pendingInvitationInput(snapshot, { ...member, email: 'untrusted@example.test' }, institutionId);
      assert.equal(input.email, member.email);
      assert.equal(input.institutionId, institutionId);
      assert.equal(input.roleId, 'teacher');
      assert.deepEqual(input.modules, ['simuladores']);
    }
  }
});

test('resending rejects active memberships, unknown roles, missing invitations and other tenants', () => {
  const snapshot = snapshotFixture();
  const member = { ...snapshot.members[0], is_active: false, invitation_pending: true };
  for (const row of [{ ...member, is_active: true }, { ...member, invitation_pending: false }, { ...member, institution_id: 'other' }, { ...member, role_name: 'unknown' }]) {
    snapshot.members = [row];
    assert.throws(() => pendingInvitationInput(snapshot, row, 'a'), /verificar/);
  }
  snapshot.members = [member];
  assert.throws(() => pendingInvitationInput(snapshot, member, 'other'), /verificar/);
});
