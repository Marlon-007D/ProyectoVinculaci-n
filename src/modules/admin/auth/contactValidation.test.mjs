import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidAdminEmail, normalizeContact, validateAdminContact } from './contactValidation.ts';

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
