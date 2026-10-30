import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveReturnTo, returnToFromLocation, safeReturnTo } from './returnTo.ts';

test('acepta rutas internas del panel', () => {
  assert.equal(safeReturnTo('/panel/dece?institution=a#x'), '/panel/dece?institution=a#x');
  assert.equal(safeReturnTo('/panel'), '/panel');
});

test('descarta destinos externos o fuera del panel', () => {
  for (const value of ['//evil.com/panel', 'https://evil.com/panel', '/\\evil.com', '/login', '/panelx', '', null, 42])
    assert.equal(safeReturnTo(value), null, String(value));
});

test('construye returnTo desde la ubicación', () => {
  assert.equal(returnToFromLocation({ pathname: '/panel/cursos/modulos', search: '?institution=a', hash: '' }), '/panel/cursos/modulos?institution=a');
  assert.equal(returnToFromLocation({ pathname: '/login', search: '', hash: '' }), null);
});

test('conserva la institución verificada y vuelve a la página pedida', () => {
  const target = '/panel/admin?institution=a&slug=ue';
  assert.equal(resolveReturnTo('/panel/dece', target), '/panel/dece?institution=a&slug=ue');
  assert.equal(resolveReturnTo('/panel/dece?institution=a', target), '/panel/dece?institution=a&slug=ue');
});

test('usa el destino verificado si el returnTo es de otra institución o inválido', () => {
  const target = '/panel/admin?institution=a&slug=ue';
  assert.equal(resolveReturnTo('/panel/dece?institution=b', target), target);
  assert.equal(resolveReturnTo('https://evil.com', target), target);
  assert.equal(resolveReturnTo(undefined, target), target);
});
