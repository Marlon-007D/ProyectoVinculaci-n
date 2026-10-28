const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Array, Object, queueMicrotask, require: name => { throw new Error('Unexpected import ' + name); } });
  return exports;
}
const { notify, connectNotifier } = load('src/shared/components/Toaster/notify.ts');

test('sin puente conectado, notificar no falla', () => {
  assert.doesNotThrow(() => { notify.success('Listo'); notify.dismiss('x'); });
});

test('une título y descripción y usa solo los tipos del Toast compartido', () => {
  const seen = [];
  const disconnect = connectNotifier((message, kind) => seen.push([message, kind]));
  notify.success('Proyecto creado', { description: 'Huerto' });
  notify.error('No se pudo crear', { description: 'Intenta de nuevo.' });
  notify.warning('Revisa el formulario:', { description: 'falta el nombre' });
  notify.info('Aviso');
  notify.success('Con opciones ignoradas', { id: 'a', persistent: true, action: { label: 'Ver', onClick() {} } });
  notify.dismiss('a');
  disconnect();
  assert.equal(JSON.stringify(seen), JSON.stringify([
    ['Proyecto creado. Huerto', 'success'],
    ['No se pudo crear. Intenta de nuevo.', 'error'],
    ['Revisa el formulario: falta el nombre', 'error'],
    ['Aviso', 'success'],
    ['Con opciones ignoradas', 'success'],
  ]));
});

test('con varios puentes manda al último y, al desmontarlo, al anterior', () => {
  const log = [];
  const first = connectNotifier(m => log.push('1:' + m));
  const second = connectNotifier(m => log.push('2:' + m));
  notify.success('a'); second(); notify.success('b'); first(); notify.success('c');
  assert.equal(JSON.stringify(log), JSON.stringify(['2:a', '1:b']));
});

test('el módulo no depende de sonner ni de AppToaster', () => {
  for (const file of ['src/shared/components/Toaster/notify.ts', 'src/shared/components/Toaster/NotifyBridge.tsx', 'src/modules/projects/PublicProjects.tsx']) {
    assert.ok(!/sonner|AppToaster/.test(fs.readFileSync(file, 'utf8')), file);
  }
  assert.ok(fs.readFileSync('src/shared/components/Toaster/NotifyBridge.tsx', 'utf8').includes("from '../Toast/Toast'"));
});
