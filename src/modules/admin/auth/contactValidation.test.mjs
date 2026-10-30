import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRequestEmail, hasEmailShape, isValidAdminEmail, normalizeContact, validateAdminContact } from './contactValidation.ts';

test('contact normalization removes only formatting, preserving identity and accented personal names', () => {
  const row = normalizeContact({ email: ' \u200BANA@ESPE.EDU.EC ', first_name: '  Ana\tMaría ', last_name: '  Pérez   Vera ' });
  assert.deepEqual(row, { email: 'ana@espe.edu.ec', first_name: 'Ana María', last_name: 'Pérez Vera' });
});

test('strict emails reject appended text instead of silently addressing a different account', () => {
  for (const email of ['gjbrito@espe.edu.ec333333333', 'ana@espe.edu.ec texto', 'ana@@espe.edu.ec', '.ana@example.test', 'ana..vera@example.test', 'ana@-example.test']) {
    assert.equal(isValidAdminEmail(email), false);
    assert.throws(() => validateAdminContact({ email, firstName: 'Ana', lastName: 'Vera' }), /correo/);
  }
  for (const email of ['elkin.vera0205@gmail.com', 'ana+unidad@espe.edu.ec']) assert.equal(isValidAdminEmail(email), true);
});

test('request extraction removes trailing numeric contamination and leaves ambiguous recipients invalid', () => {
  assert.equal(extractRequestEmail(' GJBRITO@ESPE.EDU.EC333333333 '), 'gjbrito@espe.edu.ec');
  for (const value of ['ana@example.test otra@example.test','ana@@example.test','ana@example.testtexto']) {
    assert.equal(extractRequestEmail(value), value);
  }
  assert.deepEqual(normalizeContact({ email: 'ana@example.test', first_name: null, last_name: null }), { email: 'ana@example.test', first_name: '', last_name: '' });
});

test('hasEmailShape equals the previous regex without its backtracking cost', () => {
  const previous = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const samples = ['a@b.c', 'ana@espe.edu.ec', 'a@b..c', 'a@.b', 'a@b.', 'a@.', 'a@..', '@b.c', 'a@@b.c', 'a@b@c.d', 'a b@c.d', 'a@b .c',
    'a@b.c\n', 'a@bc', '', '@', 'a@', 'a@b.c.d', 'ñ@é.ü'];
  for (const sample of samples) assert.equal(hasEmailShape(sample), previous.test(sample), JSON.stringify(sample));
  assert.equal(hasEmailShape('a@' + 'b'.repeat(100000) + '!'), false);
});
