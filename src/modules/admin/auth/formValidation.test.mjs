import test from 'node:test';
import assert from 'node:assert/strict';
import { adminFieldIssue } from './formValidation.ts';

const field = (value, extra = {}) => ({value, required:true, type:'text', minLength:-1, maxLength:-1, ...extra});

test('required fields and malformed emails are rejected before submitting', () => {
  for (const value of ['', '   ']) assert.match(adminFieldIssue(field(value)), /obligatorios/);
  for (const value of ['persona', 'persona@', 'persona@colegio', 'persona@@colegio.ec', 'persona @colegio.ec']) {
    assert.match(adminFieldIssue(field(value, {type:'email'})), /correo electrónico válido/);
  }
  assert.equal(adminFieldIssue(field('persona@colegio.edu.ec', {type:'email'})), null);
});

test('length and institution contact/code patterns apply equally to visible and hidden passwords', () => {
  for (const type of ['text', 'password']) {
    assert.match(adminFieldIssue(field('corta', {type, minLength:12})), /12 caracteres/);
    assert.equal(adminFieldIssue(field('contraseña segura', {type, minLength:12})), null);
  }
  assert.match(adminFieldIssue(field('0123456789', {pattern:'09[0-9]{8}'})), /formato/);
  assert.equal(adminFieldIssue(field('0991234567', {pattern:'09[0-9]{8}'})), null);
  assert.match(adminFieldIssue(field('123', {pattern:'[0-9]{6}'})), /formato/);
  assert.equal(adminFieldIssue(field('123456', {pattern:'[0-9]{6}'})), null);
  assert.match(adminFieldIssue(field('demasiado largo', {maxLength:5})), /máximo/);
});
