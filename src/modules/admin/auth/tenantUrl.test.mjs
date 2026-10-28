import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalTenantSearch, invitationRedirect, resolveTenantIdentity } from './tenantUrl.ts';
import { assignedTenants } from '../superadmin/mocks/assignedTenants.mjs';
import { canonicalSlug } from './canonicalSlug.ts';

test('conflicting tenant parameters resolve to one assigned row, with ID precedence', () => {
  const tenant = resolveTenantIdentity(assignedTenants, '?institution=b&slug=school-a');
  assert.equal(tenant.institution_id, 'b');
  assert.equal(tenant.name, 'Unidad Educativa B');
  assert.equal(canonicalTenantSearch('?institution=b&slug=school-a&tab=users', tenant), '?institution=b&slug=school-b&tab=users');
  assert.equal(resolveTenantIdentity(assignedTenants, '?institution=invalid&slug=school-a').institution_id, 'a');
  assert.equal(resolveTenantIdentity(assignedTenants, '?institution=school-b').institution_id, 'b');
  assert.equal(resolveTenantIdentity(assignedTenants, '?institution=unknown&slug=unknown'), undefined);
});

test('all four invitation slugs normalize accents and punctuation with exactly two encoded tenant parameters', () => {
  const slugs = ['ue-la-concordia','ue-lúz-de-américa','ue-el-esfuerzo','ue-puerto-limón'];
  for(const origin of ['http://localhost:5173','https://proyectovinculaci-n.onrender.com']) {
    for(const [index,slug] of slugs.entries()) {
      const tenant={...assignedTenants[index],slug};
      const url=new URL(invitationRedirect(origin,tenant));
      assert.equal(url.origin,origin);
      assert.equal(url.searchParams.get('slug'),canonicalSlug(slug));
      assert.equal(url.searchParams.get('institution'),tenant.institution_id);
      assert.deepEqual([...url.searchParams.keys()].sort(),['institution','slug']);
    }
  }
  assert.equal(canonicalSlug('  UE LÚZ de AMÉRICA!  '),'ue-luz-de-america');
  assert.equal(canonicalSlug('ue-lu\u0301z-de-ame\u0301rica'),'ue-luz-de-america');
  assert.throws(()=>invitationRedirect('http://localhost:5173',{...assignedTenants[0],slug:'!!!'}),/contexto/);
});

test('invitation callback preserves one exact tenant on both local and production origins', () => {
  for (const origin of ['http://localhost:5173', 'https://proyectovinculaci-n.onrender.com']) {
    const url = new URL(invitationRedirect(origin, assignedTenants[1]));
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, '/panel/admin');
    assert.equal(url.search, '?institution=b&slug=school-b');
  }
});
