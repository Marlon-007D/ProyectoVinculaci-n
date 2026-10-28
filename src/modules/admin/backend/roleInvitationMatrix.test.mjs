import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTenantInvitation } from './inviteTenantUser.ts';
import { verifiedInvitationDetails } from '../auth/invitationAccount.ts';

const roles = ['institution_admin', 'teacher', 'secretary', 'staff', 'dece', 'projects_manager', 'content_editor', 'student'];
const slugs = ['ue-la-concordia', 'ue-luz-de-america', 'ue-el-esfuerzo', 'ue-puerto-limon'];

test('Edge invitation forwards each assigned role and selected modules unchanged across all four tenant callbacks', async () => {
  for (const slug of slugs) for (const role of roles) {
    const origin = 'http://localhost:5173';
    const input = { action: 'invite', institutionId: slug, roleId: `role-${role}`, email: 'persona@example.test',
      firstName: 'Ana', lastName: 'Torres', phone: '0991234567', modules: ['projects', 'simuladores'],
      redirect_to: `${origin}/panel/admin?institution=${slug}&slug=${slug}` };
    let prepared = false;
    const response = await handleTenantInvitation(new Request('https://edge.test', { method: 'POST',
      headers: { origin, authorization: 'Bearer caller' }, body: JSON.stringify(input) }),
    { supabaseUrl: 'https://backend.test', publicKey: 'public', serviceRoleKey: 'server', allowedOrigins: [origin] },
    async (url, options) => {
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'actor' });
      if (url.endsWith('/admin_tenant_capabilities')) return Response.json(true);
      if (url.endsWith('/admin_tenant_invitation_recipient')) return Response.json(null);
      if (url.includes('/institutions?')) return Response.json([{ institution_id: slug, slug, is_active: true }]);
      if (url.includes('/roles?')) return Response.json([{ role_id: input.roleId, name: role }]);
      if (url.endsWith('/admin/users')) return Response.json({ id: 'recipient' });
      if (url.endsWith('/admin_tenant_prepare_invitation')) {
        const args = JSON.parse(options.body);
        assert.deepEqual(args.target_modules, input.modules);
        assert.equal(args.target_role_id, input.roleId);
        assert.equal(args.target_institution_id, slug);
        prepared = true;
        return Response.json(null);
      }
      if (url.includes('/invite?')) {
        assert.equal(prepared, true);
        assert.equal(JSON.parse(options.body).data.role, role);
        return Response.json({});
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    assert.deepEqual(await response.json(), { assigned: true, pending: true, notificationSent: true });
  }
});

test('personal data verification is identical for every recognized role without trusting URL contact values', () => {
  for (const slug of slugs) for (const role of ['super_admin', ...roles]) {
    const details = verifiedInvitationDetails({ first_name: 'Ana', last_name: 'Torres', phone: '0991234567' },
      { institution_id: slug, is_active: false, roles: { name: role }, institutions: { slug } },
      'persona@example.test', slug, slug, true);
    assert.equal(details.role, role);
    assert.equal(details.firstName, 'Ana');
    assert.equal(details.phone, '0991234567');
  }
});
