import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleNavItems } from './navItems.ts';

const all = () => true;
const labels = (role, access = all) => visibleNavItems(role, access).map(item => item.label);
const DECE = ['Inicio DECE', 'Estudiantes', 'Casos', 'Plantillas de fichas', 'Revisión de fichas'];
const SIMULATORS = ['Facturación electrónica', 'Unidades y monedas', 'Interés financiero'];

test('every item is a flat first-level entry with its own path, icon and tone', () => {
  for (const role of ['super_admin', 'institution_admin', 'dece_staff', 'projects_manager', 'content_editor', 'student']) {
    for (const item of visibleNavItems(role, all)) {
      assert.ok(item.label && item.path.startsWith('/panel') && item.icon && item.tone, `${role}: ${item.label}`);
      assert.ok(!('children' in item) && !('items' in item), `${role}: ${item.label} must not nest`);
    }
    const paths = visibleNavItems(role, all).map(item => item.path + item.label);
    assert.equal(new Set(paths).size, paths.length);
  }
});

test('the institution admin never sees DECE, but sees the rest of the panel', () => {
  const seen = labels('institution_admin');
  for (const label of DECE.filter(label => label !== 'Estudiantes' && label !== 'Casos')) assert.ok(!seen.includes(label), label);
  assert.ok(!seen.includes('Estudiantes') && !seen.includes('Casos'));
  for (const label of ['Inicio', 'Proyectos', 'Portal Web', 'Administración', 'Categorías', 'Módulos', 'Noticias', 'Eventos', 'Cuadro de honor', ...SIMULATORS]) assert.ok(seen.includes(label), label);
});

test('DECE staff sees Inicio and the five DECE items only, and only when the module is on', () => {
  assert.deepEqual(labels('dece_staff'), ['Inicio', ...DECE]);
  assert.deepEqual(labels('dece_staff', module => module !== 'dece'), ['Inicio']);
});

test('module items disappear when the institution disables the module', () => {
  const seen = labels('institution_admin', module => module !== 'simuladores' && module !== 'projects');
  for (const label of [...SIMULATORS, 'Proyectos']) assert.ok(!seen.includes(label), label);
  assert.ok(seen.includes('Portal Web'));
});

test('other roles never get DECE or the academic management items', () => {
  for (const role of ['projects_manager', 'content_editor', 'student']) {
    const seen = labels(role);
    for (const label of [...DECE, 'Categorías', 'Noticias', 'Cuadro de honor']) assert.ok(!seen.includes(label), `${role}: ${label}`);
  }
});

test('the superadmin has the system items plus academic management and no module items', () => {
  const seen = labels('super_admin');
  assert.deepEqual(seen.slice(0, 2), ['Instituciones educativas', 'Seguridad y usuarios']);
  for (const label of [...DECE, ...SIMULATORS, 'Proyectos']) assert.ok(!seen.includes(label), label);
});
