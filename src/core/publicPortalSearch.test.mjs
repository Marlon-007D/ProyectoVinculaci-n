import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPortalSearch } from './publicPortalSearch.ts';

test('public pages of the portal are recognised, with or without the institution', () => {
  for (const search of ['?honores=1', '?honores=1&institution=id-luz', '?institution=id&noticia=n1', '?evento=e1&institution=id', '?simulator=invoice', '?courses=1&module=m'])
    assert.equal(isPublicPortalSearch(search), true, search);
});

test('the plain portal home and the login return keep the existing redirect', () => {
  for (const search of ['', '?institution=id-luz', '?institution=id-luz&slug=ue-luz-de-america', '?code=abc'])
    assert.equal(isPublicPortalSearch(search), false, search);
});
