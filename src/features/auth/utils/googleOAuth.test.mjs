import test from 'node:test';
import assert from 'node:assert/strict';
import { googleOAuthRequest, institutionContextFromSearch, matchesInstitution } from './googleOAuth.ts';
import { institutionContexts } from '../mocks/institutionContexts.ts';

for (const institution of institutionContexts) {
  test(`OAuth preserves the URL context for ${institution.slug}`, () => {
    const search = '?' + new URLSearchParams(institution).toString();
    const context = institutionContextFromSearch(search);
    assert.deepEqual(context, institution);
    const request = googleOAuthRequest('http://localhost:5173', context);
    const callback = new URL(request.options.redirectTo);
    assert.equal(callback.origin, 'http://localhost:5173');
    assert.equal(callback.pathname, '/panel/admin');
    assert.deepEqual(institutionContextFromSearch(callback.search), institution);
    assert.equal(request.provider, 'google');
    assert.deepEqual(request.options.queryParams, { access_type: 'offline', prompt: 'consent' });
    assert.equal(matchesInstitution(context, { institution_id: institution.institution, slug: institution.slug }), true);
    const other = institutionContexts.find(item => item.institution !== institution.institution);
    assert.equal(matchesInstitution(context, { institution_id: other.institution, slug: other.slug }), false);
  });
}

test('ID-only, slug-only and empty URLs remain dynamic without assuming a default institution', () => {
  assert.deepEqual(institutionContextFromSearch('?institution=example-id'), { institution: 'example-id', slug: undefined });
  assert.deepEqual(institutionContextFromSearch('?slug=example-slug'), { institution: undefined, slug: 'example-slug' });
  assert.deepEqual(institutionContextFromSearch(''), { institution: undefined, slug: undefined });
  assert.equal(new URL(googleOAuthRequest('http://localhost:5173').options.redirectTo).search, '');
});
