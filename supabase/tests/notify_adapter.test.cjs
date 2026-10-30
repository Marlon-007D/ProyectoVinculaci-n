const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Array, Object, Infinity, queueMicrotask, require: name => { if (name in imports) return imports[name]; throw new Error('Unexpected import ' + name); } });
  return exports;
}
const calls = [];
const toast = Object.assign(() => undefined, Object.fromEntries(['success', 'error', 'warning', 'info'].map(kind => [kind, (title, options) => calls.push([kind, title, options])])), { dismiss: id => calls.push(['dismiss', id]) });
const { notify } = load('src/shared/components/Toaster/notify.ts', { sonner: { toast } });

test('cada tipo usa su propio color y la duración definida', () => {
  calls.length = 0;
  notify.success('a'); notify.info('b'); notify.warning('c'); notify.error('d');
  assert.equal(JSON.stringify(calls.map(([kind, , options]) => [kind, options.duration])), JSON.stringify([['success', 4000], ['info', 5000], ['warning', 6500], ['error', 8000]]));
  assert.ok(calls.every(([, , options]) => options.className === 'toast-timed'));
});

test('título y descripción, id estable, persistente y acción llegan a sonner', () => {
  calls.length = 0;
  const action = { label: 'Ver', onClick() {} };
  notify.warning('Revisa', { description: 'falta el nombre', id: 'form', persistent: true, action });
  notify.dismiss('form');
  const [kind, title, options] = calls[0];
  assert.equal(kind, 'warning'); assert.equal(title, 'Revisa');
  assert.equal(options.description, 'falta el nombre'); assert.equal(options.id, 'form'); assert.equal(options.duration, Infinity); assert.equal(options.action, action);
  assert.deepEqual(calls[1], ['dismiss', 'form']);
});

test('el Toast compartido y el de admin son adaptadores sobre notify con el color correcto', () => {
  const shared = load('src/shared/components/Toast/Toast.tsx', { react: { useEffect() {} }, '../Toaster/notify': { notify } });
  const admin = load('src/modules/admin/auth/Toast/Toast.tsx', { react: { useEffect() {} }, 'react/jsx-runtime': {}, '../../../../shared/components/Toaster/notify': { notify } });
  calls.length = 0;
  shared.useToast()('uno'); shared.useToast()('dos', 'success');
  admin.useToast()('tres', 'warning'); admin.useToast()('cuatro');
  assert.equal(JSON.stringify(calls.map(([kind, title]) => [kind, title])), JSON.stringify([['error', 'uno'], ['success', 'dos'], ['warning', 'tres'], ['error', 'cuatro']]));
});
