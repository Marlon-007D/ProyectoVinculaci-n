const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

/** Deterministic hook lifecycle and browser events; no real database or timers. */
exports.portalHookHarness = function () {
  const slots = [], timers = new Map(), channels = [];
  const window = new EventTarget(), document = new EventTarget();
  document.visibilityState = 'visible';
  let cursor = 0, pending = [], dirty = false, output, component, timerId = 0;
  const same = (a, b) => a && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; dirty = true; }];
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) pending.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  window.setInterval = fn => { timers.set(++timerId, fn); return timerId; };
  window.clearInterval = id => timers.delete(id);
  class CustomEvent extends Event { constructor(name, options) { super(name); this.detail = options?.detail; } }
  class BroadcastChannel {
    constructor(name) { this.name = name; channels.push(this); }
    close() { this.closed = true; }
  }
  function load(path, imports = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(code, {
      exports, window, document, BroadcastChannel, CustomEvent,
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime' || name === 'lucide-react') return require(name);
        assert.ok(name in imports, `Unexpected import ${name} in ${path}`);
        return imports[name];
      },
    });
    return exports;
  }
  function render(next = component) {
    component = next;
    let passes = 0;
    do {
      assert.ok(passes++ < 30, 'Unexpected render loop');
      dirty = false; cursor = 0; output = component();
      const effects = pending; pending = []; effects.forEach(fn => fn());
    } while (dirty);
    return output;
  }
  return {
    load, render, timers, channels,
    async flush() { await new Promise(resolve => setImmediate(resolve)); return render(); },
    idle() {
      for (let cycle = 0; cycle < 120; cycle++) {
        for (const timer of timers.values()) timer();
        window.dispatchEvent(new Event('focus'));
        document.visibilityState = cycle % 2 ? 'visible' : 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('academic-content-updated'));
        window.dispatchEvent(new CustomEvent('institutional-portal-published', { detail: { institutionId: 'school-a' } }));
        for (const channel of channels) if (!channel.closed) channel.onmessage?.({ data: { institutionId: 'school-a' } });
      }
    },
    stop() { slots.forEach(slot => slot?.cleanup?.()); },
  };
};
