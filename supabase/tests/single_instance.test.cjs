const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Minimal hook runtime: one "component" per mount, effects run after the first render,
// and store subscriptions re-render the component when the registry changes.
let current;
let nextId = 0;
const react = {
  useId: () => current.ids[current.cursor++] ??= 'id' + nextId++,
  useEffect: fn => { if (!current.effectRan) current.pending.push(fn); },
  useSyncExternalStore: (subscribe, get) => { if (!current.unsubscribe) { const owner = current; owner.unsubscribe = subscribe(() => owner.render()); } return get(); },
};

function load(path) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Map, Set, require: name => { if (name === 'react') return react; throw new Error('Unexpected import ' + name); } });
  return exports;
}
const { useSingleInstance, mountedInstances } = load('src/shared/components/singleInstance.ts');

function mount(kind) {
  const instance = { ids: [], cursor: 0, pending: [], cleanups: [], effectRan: false, unsubscribe: null, rendered: false };
  instance.render = () => {
    const previous = current; current = instance; instance.cursor = 0;
    instance.rendered = useSingleInstance(kind);
    current = previous;
    if (!instance.effectRan) { instance.effectRan = true; for (const fn of instance.pending) { const cleanup = fn(); if (cleanup) instance.cleanups.push(cleanup); } }
  };
  instance.unmount = () => { instance.cleanups.forEach(cleanup => cleanup()); instance.unsubscribe?.(); };
  instance.render();
  return instance;
}

test('solo la primera instancia del mismo tipo se dibuja', () => {
  const first = mount('other-host');
  const second = mount('other-host');
  assert.equal(mountedInstances('other-host'), 2);
  assert.equal(first.rendered, true);
  assert.equal(second.rendered, false);
  second.unmount(); first.unmount();
  assert.equal(mountedInstances('other-host'), 0);
});

test('si se desmonta la primera, la siguiente toma su lugar sin duplicar', () => {
  const first = mount('confirm-host');
  const second = mount('confirm-host');
  first.unmount();
  assert.equal(second.rendered, true);
  const third = mount('confirm-host');
  assert.equal(third.rendered, false);
  second.unmount(); third.unmount();
});

test('los tipos distintos no se afectan entre sí', () => {
  const toaster = mount('other-host');
  const confirm = mount('confirm-host');
  assert.equal(toaster.rendered, true);
  assert.equal(confirm.rendered, true);
  toaster.unmount(); confirm.unmount();
});

test('ConfirmHost usa la guarda y ModuleBoundary monta el puente de avisos y la confirmación', () => {
  assert.ok(fs.readFileSync('src/shared/components/ConfirmDialog/ConfirmHost.tsx', 'utf8').includes("useSingleInstance('confirm-host')"));
  const boundary = fs.readFileSync('src/modules/projects/integration/ModuleBoundary.tsx', 'utf8');
  assert.ok(boundary.includes('<NotifyBridge/>'));
  assert.ok(boundary.includes('<ConfirmHost/>'));
  assert.ok(!/sonner|AppToaster/.test(boundary));
});
