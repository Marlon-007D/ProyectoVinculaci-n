import test from 'node:test';
import assert from 'node:assert/strict';
import { adminDestination, currentAdminScope } from './institutionNavigation.ts';
import { googleOAuthRequest } from '../../../features/auth/utils/googleOAuth.ts';

test('navigation and OAuth keep the same tenant on localhost and Render', () => {
  const scope = { institution: 'institution-a', slug: 'school-a' };
  const search = '?' + new URLSearchParams({ ...scope, tab: 'users' });
  for (const origin of ['http://localhost:5173', 'https://proyectovinculaci-n.onrender.com']) {
    for (const path of ['/panel/admin', '/panel/instituciones', '/panel/superadmin']) {
      const target = new URL(adminDestination(path, search), origin);
      assert.equal(target.origin, origin);
      assert.equal(target.searchParams.get('institution'), scope.institution);
      assert.equal(target.searchParams.get('slug'), scope.slug);
      assert.equal(target.searchParams.get('tab'), 'users');
    }
    const callback = new URL(googleOAuthRequest(origin, scope).options.redirectTo);
    assert.equal(callback.origin, origin);
    assert.equal(callback.pathname, '/panel/admin');
    assert.deepEqual(currentAdminScope(callback.search), scope);
  }
});

test('switching tenants replaces both identifiers and preserves the destination hash', () => {
  const target = new URL(adminDestination('/panel/admin#users', '?institution=old&slug=old-school&tab=users',
    { institution: 'new', slug: 'new-school' }), 'https://proyectovinculaci-n.onrender.com');
  assert.equal(target.searchParams.get('institution'), 'new');
  assert.equal(target.searchParams.get('slug'), 'new-school');
  assert.equal(target.hash, '#users');
});

test('session fallback restores clean subroutes without replacing explicit tenants', () => {
  const values = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
  } });
  try {
    currentAdminScope('?institution=a&slug=school-a');
    assert.equal(adminDestination('/panel/admin', ''), '/panel/admin?institution=a&slug=school-a');
    assert.equal(adminDestination('/panel/admin', '?slug=school-b'), '/panel/admin?slug=school-b');
  } finally { delete globalThis.sessionStorage; }
});
