const eventName = 'institutional-portal-published';

/** Only invalidation identifiers cross tabs; unpublished content stays private. */
export function notifyPortalPublished(institutionId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName, { detail: { institutionId } }));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(eventName);
      channel.postMessage({ institutionId });
      channel.close();
    }
  } catch { /* Focus and periodic refresh work if cross-tab messaging is unavailable. */ }
}

export function watchPortalUpdates(institutionId: string, refresh: () => void): () => void {
  const visibleRefresh = () => { if (document.visibilityState === 'visible') refresh(); };
  const changed = (data: unknown) => {
    if (data && typeof data === 'object' && 'institutionId' in data && data.institutionId === institutionId) visibleRefresh();
  };
  const localChange = (event: Event) => changed((event as CustomEvent).detail);
  let channel: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(eventName);
      channel.onmessage = event => changed(event.data);
    }
  } catch { /* Polling does not require Realtime or a messaging permission. */ }
  window.addEventListener(eventName, localChange);
  window.addEventListener('focus', visibleRefresh);
  document.addEventListener('visibilitychange', visibleRefresh);
  // Other visitors receive committed changes without a manual page reload.
  const timer = window.setInterval(visibleRefresh, 30000);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener(eventName, localChange);
    window.removeEventListener('focus', visibleRefresh);
    document.removeEventListener('visibilitychange', visibleRefresh);
    channel?.close();
  };
}
