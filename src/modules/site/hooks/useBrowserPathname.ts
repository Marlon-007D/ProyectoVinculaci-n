import { useEffect, useState } from 'react';

const EVENT = 'browser-pathname-change';

// react-router and DECE both navigate through the History API; one patch tells every listener about it.
function patchHistory() {
  const marker = '__pathnamePatched';
  const target = window.history as History & { [marker]?: boolean };
  if (target[marker]) return;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = target[method].bind(target);
    target[method] = (...args: Parameters<History['pushState']>) => { original(...args); window.dispatchEvent(new Event(EVENT)); };
  }
  target[marker] = true;
}

/** Current pathname, including changes made with history.pushState outside the router. */
export function useBrowserPathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    patchHistory();
    const update = () => setPathname(window.location.pathname);
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener('popstate', update);
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener('popstate', update); };
  }, []);
  return pathname;
}
