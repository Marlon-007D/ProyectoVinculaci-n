import { useEffect, useId, useSyncExternalStore } from 'react';

// Global hosts (toasts, confirmation dialog) may be mounted by a module and later by App.tsx.
// Only the first mounted instance of each kind renders; the others stay empty.
const owners = new Map<string, string[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

function register(kind: string, id: string) {
  owners.set(kind, [...(owners.get(kind) ?? []), id]);
  emit();
  return () => {
    const rest = (owners.get(kind) ?? []).filter(item => item !== id);
    if (rest.length) owners.set(kind, rest); else owners.delete(kind);
    emit();
  };
}

/** True only for the oldest mounted instance of `kind`. */
export function useSingleInstance(kind: string) {
  const id = useId();
  useEffect(() => register(kind, id), [kind, id]);
  return useSyncExternalStore(subscribe, () => owners.get(kind)?.[0] === id, () => false);
}

/** Number of mounted instances of `kind` (for tests). */
export function mountedInstances(kind: string) {
  return owners.get(kind)?.length ?? 0;
}
