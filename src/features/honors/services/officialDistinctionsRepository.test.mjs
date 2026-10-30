import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { buildHonorGroups } from '../../academic-content/utils/honorGroups.ts';

const require = createRequire(import.meta.url);
const INSTITUTION = '816d15bb-3f56-43a7-be71-0caaf8c6a9c1';

function loadRepository(publicClient) {
  const code = ts.transpileModule(readFileSync(new URL('./officialDistinctionsRepository.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Promise, Map, Date, console, require: name => {
    if (name.endsWith('publicClient')) return { publicSupabase: publicClient };
    return require(name);
  } });
  return exports.createOfficialDistinctionsRepository;
}

// Minimal PostgREST double: every filter chain resolves to the rows registered for the table (or its error).
function client(tables) {
  const builder = table => {
    const state = tables[table] ?? { data: [] };
    const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, then: (resolve, reject) => Promise.resolve({ data: state.data ?? null, error: state.error ?? null }).then(resolve, reject) };
    return chain;
  };
  return { from: builder };
}

const period = { academic_period_id: 'p1', name: '2026-2027', start_date: '2026-09-01', end_date: '2027-06-30', is_active: true, updated_at: '2026-09-01' };
const publicRow = (id, achievement, order) => ({ honor_id: id, institution_id: INSTITUTION, academic_period_id: 'p1', achievement, photo_url: null, student_name: 'Ana Vera', grade_level: 'Tercero de Bachillerato', schedule: null, honor_category: 'official', official_order: order, modality: null, campus: null });
const student = { student_id: 's1', first_name: 'Ana', last_name: 'Vera', grade_level: 'Tercero de Bachillerato' };

async function groupsFor(adminTables, publicTables) {
  const create = loadRepository(client(publicTables));
  const result = await create(client(adminTables)).list(INSTITUTION);
  const entries = [...result.periods, ...result.entries];
  const periods = entries.filter(entry => entry.kind === 'period');
  return { result, groups: buildHonorGroups(entries.filter(entry => entry.kind === 'honor'), periods, periods.find(item => item.isCurrent)) };
}

test('with distinctions in the response the board has groups (admin rows)', async () => {
  const honor = { honor_id: 'h1', institution_id: INSTITUTION, academic_period_id: 'p1', student_id: 's1', achievement: 'Abanderado del Pabellón Nacional', score: null, photo_url: null, schedule: null, honor_category: 'official', official_order: 1, modality: null, campus: null, status: 'published', updated_at: '2026-10-01' };
  const { groups } = await groupsFor({ honors: { data: [honor] }, academic_periods: { data: [period] }, students: { data: [student] } }, {});
  assert.equal(groups.length, 1);
  assert.equal(groups[0].people.length, 1);
});

test('when the admin session sees nothing, the public view still fills the board', async () => {
  const { groups } = await groupsFor({ honors: { data: [] }, academic_periods: { data: [] }, students: { data: [] } },
    { public_honors: { data: [publicRow('h1', 'Abanderado del Pabellón Nacional', 1), publicRow('h2', 'Portaestandarte de la ciudad', 2)] } });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].people.length, 2);
});

test('a failed query is reported with its real message instead of looking like an empty board', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const create = loadRepository(client({ public_honors: { data: null, error: { message: 'permission denied for view public_honors' } } }));
    const result = await create(client({ honors: { data: [] }, academic_periods: { data: [] }, students: { data: [] } })).list(INSTITUTION);
    assert.deepEqual([...result.diagnostics.errors], ['public_honors: permission denied for view public_honors']);
    assert.ok(logged.some(line => line.includes('permission denied for view public_honors')));
  } finally { console.error = original; }
});

test('the diagnostics count what each source returned', async () => {
  const create = loadRepository(client({ public_honors: { data: [publicRow('h1', 'Abanderado del Pabellón Nacional', 1)] } }));
  const { diagnostics } = await create(client({ honors: { data: [] }, academic_periods: { data: [period] }, students: { data: [student] } })).list(INSTITUTION);
  assert.deepEqual({ ...diagnostics, errors: [...diagnostics.errors] }, { institutionId: INSTITUTION, honors: 0, publicHonors: 1, periods: 1, students: 1, errors: [] });
});
