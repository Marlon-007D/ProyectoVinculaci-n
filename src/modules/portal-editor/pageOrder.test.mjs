import test from 'node:test';
import assert from 'node:assert/strict';
import { orderPortalPages } from './pageOrder.ts';

const page = (title, status, is_homepage = false) => ({ status, snapshot: { title, is_homepage } });

test('homepage first, then published, then drafts, each alphabetical', () => {
  const ordered = orderPortalPages([page('Nosotros', 'published'), page('Borrador A', 'draft'), page('Inicio', 'published', true), page('Contacto', 'published'), page('Álbum', 'draft')]);
  assert.deepEqual(ordered.map(item => item.snapshot.title), ['Inicio', 'Contacto', 'Nosotros', 'Álbum', 'Borrador A']);
});

test('the input is not mutated and every page is kept', () => {
  const input = [page('B', 'draft'), page('A', 'published')];
  const copy = [...input];
  assert.equal(orderPortalPages(input).length, 2);
  assert.deepEqual(input, copy);
});
