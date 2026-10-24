import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Exercise the actual provider and its asynchronous callbacks without a DOM or live accounts.
export function authProviderHarness(t, initialSession = null) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let mounted = true;
  let queued = false;
  let provider;
  let listener;
  let session = initialSession;
  let value;
  const snapshots = [];
  const calls = [];
  const location = { pathname: '/panel/admin', search: '', origin: 'http://localhost:5173' };
  const stored = new Map([['auth-login-method', 'password']]);
  const previousWindow = globalThis.window;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  globalThis.window = { location, setTimeout, clearTimeout };
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, item) => stored.set(key, item),
    removeItem: key => stored.delete(key),
  } });

  const schedule = () => {
    if (queued || !mounted) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (mounted) render(); });
  };
  const sameDeps = (left, right) => left && right && left.length === right.length && left.every((item, index) => Object.is(item, right[index]));
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    createElement: (type, props) => ({ type, props }),
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      slots[index].setter ??= next => {
        const resolved = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(resolved, slots[index].value)) { slots[index].value = resolved; schedule(); }
      };
      return [slots[index].value, slots[index].setter];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { deps, callback };
      return slots[index].callback;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (sameDeps(slots[index]?.deps, deps)) return;
      effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: callback() };
      });
    },
  };
  react.default = react;

  let query = async table => {
    switch (table) {
      case 'memberships': return [{ institution_id: 'a', role_id: 'admin' }, { institution_id: 'b', role_id: 'student' }];
      case 'roles': return [{ role_id: 'admin', name: 'institution_admin' }, { role_id: 'student', name: 'student' }];
      case 'institutions': return [{ institution_id: 'a', slug: 'school-a', is_active: true }, { institution_id: 'b', slug: 'school-b', is_active: true }];
      default: throw new Error(`Unexpected table: ${table}`);
    }
  };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
      onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    },
    rpc: async () => ({ data: false, error: null }),
    from(table) {
      const chain = {
        select() { return chain; }, eq() { return chain; }, in() { return chain; },
        then(resolve, reject) { calls.push(table); return query(table).then(data => ({ data, error: null })).then(resolve, reject); },
      };
      return chain;
    },
  };
  const cache = new Map();
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    const exports = {};
    cache.set(url.href, exports);
    const code = ts.transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.React },
    }).outputText;
    const require = createRequire(url);
    new Function('require', 'exports', code)(specifier => {
      if (specifier === 'react') return react;
      if (specifier === 'react-router-dom') return { useLocation: () => location };
      if (specifier.endsWith('supabaseClient')) return { supabase: client };
      if (specifier.endsWith('registerInstitutionalAccount')) return { registerInstitutionalAccount: async () => ({ error: null }) };
      if (specifier.startsWith('.')) return load(new URL(/\.tsx?$/.test(specifier) ? specifier : specifier + '.ts', url));
      return require(specifier);
    }, exports);
    return exports;
  }
  provider = load(new URL('../../../../core/AuthContext.tsx', import.meta.url)).AuthProvider;
  function render() {
    cursor = 0;
    effects = [];
    value = provider({ children: null }).props.value;
    snapshots.push({ user: value.user?.id ?? null, role: value.role, loading: value.loading, issue: value.roleIssue });
    const pending = effects;
    effects = [];
    pending.forEach(effect => effect());
  }
  t.after(() => {
    mounted = false;
    slots.forEach(slot => slot?.cleanup?.());
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage);
    else delete globalThis.sessionStorage;
  });
  render();
  return {
    get value() { return value; }, snapshots, calls,
    setQuery(next) { query = next; },
    emit(event, nextSession) { session = nextSession; listener(event, nextSession); },
    scope(search) { location.search = search; render(); },
    async until(predicate) {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (predicate(value)) return;
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      throw new Error('Provider did not reach the expected access state');
    },
  };
}
