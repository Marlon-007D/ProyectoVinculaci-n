import { useEffect, useRef, useState } from 'react';
import { createInitialPrivateLoadRegistry } from './initialPrivateLoad';

const registry = createInitialPrivateLoadRegistry();

export function useInitialPrivateLoad(userId: string | undefined, panel: string, loading: boolean, eligible: boolean, sessionLoading: boolean): boolean {
  const key = `${userId ?? ''}:${panel}`;
  const [initial, setInitial] = useState<{ key: string; visible: boolean } | null>(null);
  const claimed = useRef<string | null>(null);
  useEffect(() => {
    if (!userId && !sessionLoading) registry.clear();
    if (!userId || !eligible || !loading) {
      if (!loading) setInitial(current => current?.visible ? { key, visible: false } : current);
      return;
    }
    if (claimed.current !== key) {
      claimed.current = key;
      setInitial({ key, visible: registry.claim(userId) });
    }
  }, [userId, panel, key, loading, eligible, sessionLoading]);
  return eligible && loading && initial?.key === key && initial.visible;
}
