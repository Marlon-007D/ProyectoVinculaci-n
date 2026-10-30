const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

function load(path, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, TextEncoder, Intl, Date, URLSearchParams, require: name => { if (name in imports) return imports[name]; if (name === 'react') return React; if (name === 'react/jsx-runtime') return jsx; throw new Error('Unexpected import ' + name); } });
  return exports;
}

const validation = load('src/modules/projects/projectValidation.ts');
const presentation = load('src/modules/projects/projectPresentation.ts', { './projectValidation': validation });
const forms = load('src/modules/projects/projectForms.ts', { './projectValidation': validation, './projectPresentation': presentation });
const report = load('src/modules/projects/reportData.ts', { './projectValidation': validation, './projectPresentation': presentation });
const roles = load('src/core/auth/institutionalRoles.ts');
const lucide = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : () => null });
const formField = load('src/modules/projects/FormField.tsx', { './projectStyles': { moduleClass: value => value }, 'lucide-react': lucide });
const transientNotice = load('src/modules/projects/transientNotice.ts');
const formInputs = load('src/modules/projects/FormInputs.tsx', { './FormField': formField, './projectValidation': validation, './transientNotice': transientNotice });
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };

test('montos: un solo mensaje claro por cada caso, con coma o punto decimal', () => {
  const parse = (text, options) => validation.parseMoneyInput(text, options);
  assert.deepEqual({ ...parse('350,20') }, { ok: true, value: 350.2 });
  assert.deepEqual({ ...parse('350.20') }, { ok: true, value: 350.2 });
  assert.deepEqual({ ...parse(' 12 ') }, { ok: true, value: 12 });
  assert.equal(parse('350.2021313213').message, 'Ingresa un monto con máximo 2 decimales (ej. 350,20).');
  assert.equal(parse('0,001').message, 'Ingresa un monto con máximo 2 decimales (ej. 350,20).');
  assert.equal(parse('-5').message, 'El monto no puede ser negativo.');
  assert.equal(parse('0').message, 'El monto debe ser mayor que $0,00.');
  assert.equal(parse('0,00').message, 'El monto debe ser mayor que $0,00.');
  assert.equal(parse('0', { allowZero: true }).ok, true);
  assert.equal(parse('').message, 'Ingresa un monto.');
  assert.equal(parse('abc').message, 'Ingresa solo números (ej. 350,20).');
  assert.equal(parse('1e5').message, 'Ingresa solo números (ej. 350,20).');
  assert.equal(parse('99999999999').message, 'El monto máximo es $9.999.999.999,99.');
  assert.equal(parse('9999999999,99').ok, true);
  assert.equal(parse('999999999999999999999').message, 'El monto máximo es $9.999.999.999,99.');
});

test('textos: recorta espacios, rechaza vacíos y solo espacios y respeta el máximo', () => {
  const check = validation.validateText;
  assert.deepEqual({ ...check('  Huerto  ', 120) }, { ok: true, value: 'Huerto' });
  assert.equal(check('', 80).message, 'Este campo es obligatorio.');
  assert.equal(check('     ', 80).message, 'No puede quedar solo con espacios.');
  assert.equal(check('x'.repeat(81), 80).message, 'Máximo 80 caracteres (tienes 81).');
  assert.equal(check('x'.repeat(80), 80).ok, true);
  assert.equal(check(' ' + 'x'.repeat(80) + ' ', 80).ok, true, 'el límite se mide después de recortar');
  assert.equal(JSON.stringify({ ...validation.TEXT_LIMITS }), JSON.stringify({ projectName: 120, budgetName: 120, expense: 150, role: 80, description: 1000, search: 100 }));
});

test('formularios: validan todos los campos y devuelven valores ya recortados', () => {
  const project = forms.validateProjectForm(form({ name: '  Huerto  ', budget: '1000,50', start: '2026-11-01', end: '2026-12-01', description: ' Objetivo ' }));
  assert.equal(project.ok, true);
  assert.deepEqual({ ...project.values }, { name: 'Huerto', description: 'Objetivo', budget_total: 1000.5, start_date: '2026-11-01', end_date: '2026-12-01' });
  const bad = forms.validateProjectForm(form({ name: '   ', budget: '350.2021313213', start: '', end: '2026-12-01', description: 'x'.repeat(1001) }), { min: '2026-10-28', max: '2027-10-28' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['budget', 'description', 'name', 'start']);
  assert.equal(bad.errors.budget, 'Ingresa un monto con máximo 2 decimales (ej. 350,20).');
  assert.equal(forms.validateProjectForm(form({ name: 'a', budget: '0', start: '2026-12-02', end: '2026-12-01', description: 'd' })).errors.end, 'La fecha final no puede ser anterior al inicio.');
  assert.equal(forms.validateProjectForm(form({ name: 'a', budget: '0', start: '2026-11-01', end: '2026-12-01', description: 'd' })).ok, true, 'presupuesto 0 permitido');
  assert.match(forms.validateProjectForm(form({ name: 'a', budget: '1', start: '2026-10-01', end: '2026-12-01', description: 'd' }), { min: '2026-10-28' }).errors.start, /28\/10\/2026/);

  const item = forms.validateBudgetItemForm(form({ name: ' Materiales ', amount: '0' }));
  assert.equal(item.errors.amount, 'El monto debe ser mayor que $0,00.');
  assert.equal(forms.validateBudgetItemForm(form({ name: '', amount: '5' })).errors.name, 'Este campo es obligatorio.');
  assert.equal(forms.validateBudgetItemForm(form({ name: 'x'.repeat(121), amount: '5' })).errors.name, 'Máximo 120 caracteres (tienes 121).');

  assert.equal(forms.validateRoleForm(form({ role: ' Tutor ' })).values.role, 'Tutor');
  assert.equal(forms.validateRoleForm(form({ role: 'x'.repeat(81) })).errors.role, 'Máximo 80 caracteres (tienes 81).');
});

test('gastos: el error muestra la diferencia exacta contra el saldo del rubro', () => {
  const context = { balance: 350.2, start: '2026-10-28', end: '2027-06-30', today: '2026-11-15' };
  const over = forms.validateExpenseForm(form({ description: 'Compra', amount: '400', date: '2026-11-01' }), context);
  assert.equal(over.ok, false);
  assert.match(over.errors.amount, /^Supera el saldo disponible del rubro por \$\s?49,80\.$/);
  assert.equal(forms.balanceError(350.2, 350.2), '');
  assert.match(forms.balanceError(350.21, 350.2), /por \$\s?0,01\./);
  assert.equal(forms.validateExpenseForm(form({ description: 'Compra', amount: '350,20', date: '2026-11-01' }), context).ok, true);
  assert.equal(forms.validateExpenseForm(form({ description: 'Compra', amount: '1', date: '2026-11-16' }), context).errors.date, 'La fecha no puede ser posterior al 15/11/2026.');
  assert.match(forms.validateExpenseForm(form({ description: 'Compra', amount: '1', date: '2026-10-01' }), context).errors.date, /anterior al inicio/);
  assert.equal(forms.validateExpenseForm(form({ description: 'x'.repeat(151), amount: '1', date: '2026-11-01' }), context).errors.description, 'Máximo 150 caracteres (tienes 151).');
  const zero = forms.validateExpenseForm(form({ description: 'Compra', amount: '1', date: '2026-11-01' }), { ...context, balance: 0 });
  assert.match(zero.errors.amount, /Supera el saldo disponible del rubro por \$\s?1,00\./);
});

test('formato uniforme es-EC: moneda, porcentaje, fechas y plurales', () => {
  assert.match(presentation.formatMoney(350.2), /^\$\s?350,20$/);
  assert.equal(presentation.formatPercent(57.11).replace(/ /g, ' '), '57,11 %');
  assert.equal(presentation.formatPercent(0).replace(/ /g, ' '), '0,00 %');
  assert.equal(presentation.formatNumericDate('2026-10-05'), '05/10/2026');
  assert.equal(presentation.formatNumericDate('2026-02-30'), '');
  assert.equal(presentation.plural(1, 'participante', 'participantes'), '1 participante');
  assert.equal(presentation.plural(0, 'gasto', 'gastos'), '0 gastos');
  assert.equal(presentation.plural(3, 'proyecto', 'proyectos'), '3 proyectos');
  assert.equal(presentation.fileSlug('U.E. «El Esfuerzo» — Ñandú'), 'U_E_El_Esfuerzo_Nandu');
  assert.equal(presentation.reportFileName('Transparencia', 'U.E. El Esfuerzo', 'xlsx', '2026-10-28'), 'Transparencia_U_E_El_Esfuerzo_2026-10-28.xlsx');
  assert.equal(presentation.reportFileName('Informe', 'Huerto "Verde"', 'xlsx', '2026-10-28'), 'Informe_Huerto_Verde_2026-10-28.xlsx');
});

test('transparencia: período en es-EC y plazo vencido solo para proyectos en ejecución', () => {
  const transparency = load('src/modules/projects/publicTransparency.ts', { './projectPresentation': presentation, './projectValidation': validation });
  const row = { is_active: true, start_date: '2026-10-28', end_date: '2026-10-31' };
  assert.match(transparency.projectPeriod(row), /^28 oct\.? 2026 – 31 oct\.? 2026$/);
  assert.equal(transparency.projectPeriod({ start_date: null, end_date: null }), '', 'sin fechas no muestra nada');
  assert.equal(transparency.projectPeriod({ start_date: '2026-10-28', end_date: null }), '');
  assert.equal(transparency.projectPeriod({ start_date: '2026-02-30', end_date: '2026-10-31' }), '');
  assert.equal(transparency.isOverdue(row, '2026-10-31'), false, 'el último día aún está en plazo');
  assert.equal(transparency.isOverdue(row, '2026-11-01'), true);
  assert.equal(transparency.isOverdue({ ...row, is_active: false }, '2026-11-01'), false, 'un proyecto cerrado nunca está vencido');
  assert.equal(transparency.isOverdue({ is_active: true, end_date: null }, '2026-11-01'), false);
  assert.equal(transparency.publicStatus(row, '2026-11-01'), 'En ejecución · Plazo vencido');
  assert.equal(transparency.publicStatus(row, '2026-10-30'), 'En ejecución');
  assert.equal(transparency.publicStatus({ ...row, is_active: false }, '2026-11-01'), 'Cerrado');
  const [, projects] = transparency.transparencyXlsxSheets('Colegio', [{ project_id: 'a', title: 'Huerto', description: 'Objetivo', total_budget: 10, spent: 5, balance: 5, ...row }, { project_id: 'b', title: 'Sin fechas', description: '', is_active: true, total_budget: 0, spent: 0, balance: 0 }], 'hoy', '2026-11-01');
  assert.deepEqual(Array.from(projects.rows[0], cell => cell.value), ['Proyecto', 'Objetivo', 'Período', 'Estado', 'Presupuesto', 'Ejecutado', 'Saldo', 'Ejecución']);
  assert.match(projects.rows[1][2], /^28 oct\.? 2026 – 31 oct\.? 2026$/);
  assert.equal(projects.rows[1][3], 'En ejecución · Plazo vencido');
  assert.equal(projects.rows[2][2], '');
  assert.equal(projects.rows[2][3], 'En ejecución');
});

test('módulo sin CSV: solo quedan Excel y PDF', () => {
  for (const name of ['toCsv', 'downloadCsv']) assert.equal(name in presentation, false, name);
  const transparency = load('src/modules/projects/publicTransparency.ts', { './projectPresentation': presentation, './projectValidation': validation });
  assert.equal('transparencyCsvRows' in transparency, false);
  assert.equal('projectCsvRows' in report, false);
  for (const file of ['ProjectReport.tsx', 'TransparencyReportActions.tsx', 'PublicProjects.tsx']) {
    const source = fs.readFileSync('src/modules/projects/' + file, 'utf8');
    assert.ok(!/csv/i.test(source), file + ' no menciona CSV');
  }
});
function project() {
  return {
    id: 'p1', institution_id: 'i1', name: 'Huerto', description: 'Objetivo', budget_total: 1000, is_active: true, is_public: true, start_date: '2026-10-28', end_date: '2027-06-30', members: [],
    budget_items: [
      { budget_item_id: 'b1', project_id: 'p1', name: 'Materiales', allocated_amount: 600, spent_amount: 350.2, expenses: [
        { expense_id: 'e1', budget_item_id: 'b1', amount: 200, description: 'Semillas', date: '2026-11-10' },
        { expense_id: 'e2', budget_item_id: 'b1', amount: 150.2, description: 'Herramientas', date: '2026-11-02' }] },
      { budget_item_id: 'b2', project_id: 'p1', name: 'Servicios', allocated_amount: 400, spent_amount: 0, expenses: [] },
    ],
  };
}
const meta = { institution: 'U.E. El Esfuerzo', issuedBy: 'Ana (ana@example.com)', issuedOn: '28 de octubre de 2026' };

test('informe interno: resumen por rubro, movimientos ordenados y filtros en texto', () => {
  const model = report.buildReportModel(project(), { from: '', to: '', itemId: '' });
  assert.equal(model.items.length, 2);
  assert.deepEqual({ ...model.totals }, { allocated: 1000, spent: 350.2, balance: 649.8, percent: 35.02 });
  assert.deepEqual(Array.from(model.movements, row => row.id), ['e2', 'e1']);
  assert.equal(model.movementsTotal, 350.2);
  const january = report.buildReportModel(project(), { from: '2026-11-05', to: '', itemId: '' });
  assert.deepEqual(Array.from(january.movements, row => row.id), ['e1']);
  assert.equal(january.totals.spent, 350.2, 'el resumen por rubro es acumulado');
  const services = report.buildReportModel(project(), { from: '', to: '', itemId: 'b2' });
  assert.equal(services.items.length, 1);
  assert.equal(services.movements.length, 0);
  assert.equal(services.totals.percent, 0);
  assert.equal(report.filterSummary(project(), { from: '', to: '', itemId: '' }), 'Desde: el inicio · Hasta: la última fecha registrada · Rubro: todos');
  assert.match(report.filterSummary(project(), { from: '2026-11-05', to: '2026-11-30', itemId: 'b1' }), /^Desde: .*2026.* · Hasta: .*2026.* · Rubro: Materiales$/);
  assert.equal(report.movementsLabel(1), '1 movimiento');
  assert.equal(report.movementsLabel(2), '2 movimientos');
});

test('informe interno en Excel: datos del encabezado, resumen por rubro y movimientos', () => {
  const [summary, movements] = report.projectXlsxSheets(project(), { from: '', to: '', itemId: '' }, meta);
  const text = row => Array.from(row, cell => cell && typeof cell === 'object' ? cell.value : cell);
  assert.deepEqual(text(summary.rows[1]), ['Institución', 'U.E. El Esfuerzo']);
  assert.ok(text(summary.rows[4])[1].includes('Ana (ana@example.com)'));
  assert.deepEqual(text(summary.rows[5]), ['Rubro', 'Asignado', 'Ejecutado', 'Saldo', 'Ejecución']);
  assert.deepEqual(text(summary.rows.at(-1)), ['Totales', 1000, 350.2, 649.8, 0.3502]);
  assert.deepEqual(text(movements.rows[1]), ['02/11/2026', 'Materiales', 'Herramientas', 150.2]);
  assert.equal(text(movements.rows.at(-1))[3], 350.2);
});
// ---- Institution selector: shown only when the user can manage more than one institution.
function switcher(institutions, activeId) {
  const active = institutions.find(item => item.institution_id === activeId) ?? institutions[0];
  const module = load('src/modules/projects/InstitutionSwitcher.tsx', {
    '../admin/auth/institutionSwitch': { institutionSwitchSearch: (search, next) => '?' + new URLSearchParams({ institution: next.institution_id, slug: next.slug }) },
    'react-router-dom': { useLocation: () => ({ pathname: '/panel/proyectos', search: '' }), useNavigate: () => () => {} },
    'lucide-react': { Building2: () => null },
    '../../core/TenantContext': {},
    '../../core/auth/institutionalRoles': roles,
    '../../core/AuthContext': { useAuth: () => ({ user: { id: 'user-a' } }) },
    '../../shared/components/ConfirmDialog/confirm': { confirmAction: async () => true },
    './projectStyles': { moduleClass: value => value },
    './FormField': formField,
  });
  return { module, active };
}
const school = (id, role) => ({ institution_id: id, slug: id, name: 'Colegio ' + id.toUpperCase(), role });
function render(institutions, activeId, props = {}) {
  const { active } = switcher(institutions, activeId);
  const Component = load('src/modules/projects/InstitutionSwitcher.tsx', {
    '../admin/auth/institutionSwitch': { institutionSwitchSearch: (search, next) => '?' + new URLSearchParams({ institution: next.institution_id, slug: next.slug }) },
    'react-router-dom': { useLocation: () => ({ pathname: '/panel/proyectos', search: '' }), useNavigate: () => () => {} },
    'lucide-react': { Building2: () => null },
    '../../core/TenantContext': { useTenant: () => ({ institutions, activeInstitution: active, setActiveInstitution: () => {}, loadingTenant: false }) },
    '../../core/auth/institutionalRoles': roles,
    '../../core/AuthContext': { useAuth: () => ({ user: { id: 'user-a' } }) },
    '../../shared/components/ConfirmDialog/confirm': { confirmAction: async () => true },
    './projectStyles': { moduleClass: value => value },
    './FormField': formField,
  }).InstitutionSwitcher;
  return renderToStaticMarkup(React.createElement(Component, props));
}

test('selector de institución: solo con más de una institución administrable', () => {
  const four = ['a', 'b', 'c', 'd'].map(id => school(id, 'super_admin'));
  const html = render(four, 'a');
  assert.ok(html.includes('<select') && html.includes('Institución'));
  for (const item of four) assert.ok(html.includes(item.name));
  assert.ok(html.includes('value="a"') || html.includes('selected'));

  // One institution: no selector, the user goes straight to it (name only when asked).
  const single = [school('a', 'institution_admin')];
  assert.ok(!render(single, 'a').includes('<select'));
  assert.equal(render(single, 'a'), '');
  assert.ok(render(single, 'a', { showName: true }).includes('Colegio A') && !render(single, 'a', { showName: true }).includes('<select'));

  // An institutional admin of two schools sees both; roles that cannot manage projects never appear in the list.
  const mixed = [school('a', 'institution_admin'), school('b', 'projects_manager'), school('c', 'student'), school('d', 'dece')];
  const mixedHtml = render(mixed, 'a');
  assert.ok(mixedHtml.includes('Colegio A') && mixedHtml.includes('Colegio B'));
  assert.ok(!mixedHtml.includes('Colegio C') && !mixedHtml.includes('Colegio D'));
  const oneManaged = [school('a', 'institution_admin'), school('c', 'student')];
  assert.ok(!render(oneManaged, 'a').includes('<select'));
  assert.equal(switcher(four, 'a').module.manageableInstitutions(oneManaged).length, 1);
  assert.equal(switcher(four, 'a').module.manageableInstitutions([...four, school('x', 'student')]).length, 4);
});

test('montos al escribir o pegar: máximo 10 enteros y 2 decimales, sin signo ni letras', () => {
  const clean = text => ({ ...validation.sanitizeMoneyInput(text) });
  assert.deepEqual(clean('350.2021313213'), { text: '350.20', trimmed: 'decimals' });
  assert.deepEqual(clean('350,201'), { text: '350,20', trimmed: 'decimals' });
  assert.deepEqual(clean('350,20'), { text: '350,20', trimmed: '' });
  assert.deepEqual(clean('500'), { text: '500', trimmed: '' });
  assert.deepEqual(clean('99999999999'), { text: '9999999999', trimmed: 'integers' });
  assert.deepEqual(clean('1234567890123,456'), { text: '1234567890,45', trimmed: 'integers' });
  assert.deepEqual(clean('-5'), { text: '5', trimmed: 'negative' });
  assert.deepEqual(clean('12a3'), { text: '123', trimmed: 'chars' });
  assert.deepEqual(clean('$ 1.234,50'), { text: '1234,50', trimmed: 'chars' });
  assert.deepEqual(clean('1,234.50'), { text: '1234.50', trimmed: '' });
  assert.deepEqual(clean('1.234.567'), { text: '1234567', trimmed: '' });
  assert.deepEqual(clean('007'), { text: '7', trimmed: '' });
  assert.deepEqual(clean(',5'), { text: '0,5', trimmed: '' });
  assert.deepEqual(clean('0'), { text: '0', trimmed: '' });
  assert.deepEqual(clean(''), { text: '', trimmed: '' });
  assert.equal(validation.MONEY_TRIM_MESSAGES.decimals, 'Ingresa un monto con máximo 2 decimales (ej. 350,20).');
  // Whatever the field keeps is always accepted by the parser used on submit.
  for (const sample of ['350.2021313213', '99999999999,999', '$ 1.234,50', '1,234.50', '9999999999,99']) {
    const parsed = validation.parseMoneyInput(validation.sanitizeMoneyInput(sample).text, { allowZero: true });
    assert.equal(parsed.ok, true, sample);
  }
});

test('campo de monto: texto con teclado decimal y valor guardado mostrado con coma', () => {
  const field = formField;
  const inputs = formInputs;
  assert.equal(inputs.moneyText(350.2), '350,20');
  assert.equal(inputs.moneyText(500), '500');
  assert.equal(inputs.moneyText(undefined), '');
  const fields = load('src/modules/projects/ProjectFields.tsx', { './projectValidation': validation, './FormField': field, './FormInputs': inputs, '../../features/feats/pages/AdminCourseCategoriesPage.module.css': { default: new Proxy({}, { get: (_, key) => String(key) }) } });
  const html = renderToStaticMarkup(React.createElement(fields.ProjectFields, { project: { name: 'Huerto', description: 'Objetivo', budget_total: 350.2, start_date: '2026-11-01', end_date: '2026-12-01', is_public: false } }));
  const budget = /<input[^>]*name="budget"[^>]*>/.exec(html)[0];
  assert.match(budget, /type="text"/);
  assert.match(budget, /inputMode="decimal"/);
  assert.match(budget, /value="350,20"/);
  assert.ok(!/type="number"/.test(html), 'ningún campo numérico nativo');
  assert.match(html, /name="name"[^>]*maxLength="120"|maxLength="120"[^>]*name="name"/);
});

// ---- Amount notice: temporary trim notice (3 s) separate from the submit validation error.
function fakeTimers() {
  const pending = new Map();
  let next = 1;
  return {
    set: (callback, ms) => { pending.set(next, { callback, ms }); return next++; },
    clear: handle => { pending.delete(handle); },
    pending,
    fire: () => { for (const [handle, timer] of [...pending]) { pending.delete(handle); timer.callback(); } },
  };
}

test('aviso de recorte: desaparece solo a los 3 segundos y reiniciar el recorte reinicia la cuenta', () => {
  const timers = fakeTimers();
  const shown = [];
  const notice = transientNotice.createTransientNotice(text => shown.push(text), timers);
  assert.equal(transientNotice.NOTICE_MS, 3000);
  notice.show('máx. 2 decimales');
  assert.deepEqual(shown, ['máx. 2 decimales']);
  assert.equal([...timers.pending.values()][0].ms, 3000);
  notice.show('otra vez');
  assert.equal(timers.pending.size, 1, 'recortar de nuevo cancela el temporizador anterior');
  timers.fire();
  assert.equal(shown.at(-1), '');
  assert.equal(timers.pending.size, 0);
});

test('aviso de recorte: un carácter válido, salir del campo o desmontar lo limpian y cancelan el temporizador', () => {
  const timers = fakeTimers();
  const shown = [];
  const notice = transientNotice.createTransientNotice(text => shown.push(text), timers);
  notice.show('aviso');
  notice.clear();
  assert.equal(shown.at(-1), '');
  assert.equal(timers.pending.size, 0);
  notice.show('aviso');
  notice.dispose();
  assert.equal(timers.pending.size, 0, 'desmontar no deja temporizadores');
  const count = shown.length;
  timers.fire();
  assert.equal(shown.length, count, 'tras desmontar no se actualiza el estado');
});

test('campo de monto: un valor válido nunca muestra error ni aria-invalid, aunque haya aviso de recorte', () => {
  const html = error => renderToStaticMarkup(React.createElement(formInputs.MoneyField, { id: 'm', name: 'amount', label: 'Importe', defaultValue: '21.20', error }));
  const valid = html(undefined);
  assert.match(valid, /value="21.20"/);
  assert.ok(!/aria-invalid/.test(valid), 'sin error de validación no hay aria-invalid');
  assert.ok(!/role="alert"/.test(valid));
  assert.match(valid, /<p id="m-notice" aria-live="polite"[^>]*><[/]p>/, 'la región de aviso existe y está vacía');
});

test('aviso temporal y error de validación son estados distintos con roles distintos', () => {
  const markup = props => renderToStaticMarkup(React.createElement(formField.Field, { id: 'f', label: 'Importe', ...props }, React.createElement('input', formField.fieldProps('f', props.error, false, Boolean(props.notice)))));
  const notice = markup({ notice: 'Ingresa un monto con máximo 2 decimales (ej. 350,20).' });
  assert.match(notice, /id="f-notice" aria-live="polite"/);
  assert.ok(!/role="alert"/.test(notice) && !/aria-invalid/.test(notice), 'el aviso no es un error: no roba el foco ni marca el campo');
  assert.match(notice, /aria-describedby="f-notice"/);
  const error = markup({ notice: '', error: 'Ingresa el importe.' });
  assert.match(error, /aria-invalid="true"/);
  assert.match(error, /role="alert"[^>]*>.*Ingresa el importe./);
  assert.match(error, /is-invalid/);
  const both = markup({ notice: 'aviso', error: 'Ingresa el importe.' });
  assert.match(both, /aria-describedby="f-error f-notice"/);
  assert.ok(both.includes('aviso') && both.includes('Ingresa el importe.'), 'el aviso al expirar no borra el error de validación');
});
