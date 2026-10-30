import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHonorGroups, HONOR_EMPTY_MESSAGE } from './honorGroups.ts';

const period = (id, title, isCurrent = false) => ({ id, kind: 'period', title, isCurrent, startDate: `${title}-01-01` });
const official = (id, periodId, distinction) => ({ id, kind: 'honor', honorCategory: 'official', periodId, distinction, studentName: id });

test('without a current period or distinctions there are no groups, so the page must show its empty state', () => {
  assert.deepEqual(buildHonorGroups([], [], undefined), []);
  assert.match(HONOR_EMPTY_MESSAGE, /período académico vigente/);
});

test('the current period always appears with empty official slots', () => {
  const current = period('p1', '2026', true);
  const groups = buildHonorGroups([], [current], current);
  assert.equal(groups.length, 1);
  assert.deepEqual({ key: groups[0].key, category: groups[0].category, year: groups[0].year, people: groups[0].people }, { key: 'p1:official', category: 'official', year: '2026', people: [] });
});

test('distinctions are grouped by period, newest year first', () => {
  const current = period('p2', '2026', true);
  const old = period('p1', '2025');
  const groups = buildHonorGroups([official('a', 'p1', 'Abanderado del Pabellón Nacional'), official('b', 'p2', 'Portaestandarte de la ciudad')], [old, current], current);
  assert.deepEqual(groups.map(group => group.year), ['2026', '2025']);
  assert.equal(groups[1].people[0].id, 'a');
});

test('entries without a known period are grouped under "Año sin período"', () => {
  const groups = buildHonorGroups([official('a', '', 'Abanderado del Pabellón Nacional')], [], undefined);
  assert.equal(groups[0].year, 'Año sin período');
});
