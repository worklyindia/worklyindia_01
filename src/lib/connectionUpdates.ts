/** Invalidation only: never send account data or credentials between tabs. */
export const CONNECTION_UPDATE_KEY = 'workly:connection-update';
export const CONNECTION_UPDATE_EVENT = 'workly:connection-update';

export function notifyConnectionUpdated() {
  window.dispatchEvent(new Event(CONNECTION_UPDATE_EVENT));
  try { localStorage.setItem(CONNECTION_UPDATE_KEY, crypto.randomUUID()); } catch { /* Private storage. */ }
}

export function subscribeConnectionUpdates(refresh: () => void | Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let running = false;
  let queued = false;
  const run = async () => {
    if (disposed) return;
    if (running) { queued = true; return; }
    running = true;
    try { await refresh(); } catch { /* The status reader owns errors. */ }
    finally {
      running = false;
      if (queued && !disposed) { queued = false; schedule(); }
    }
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void run(); }, 100);
  };
  const storage = (event: StorageEvent) => {
    if (event.key === CONNECTION_UPDATE_KEY || event.key === 'gmailConnectResult' || event.key === 'outlookConnectResult') schedule();
  };
  const visible = () => { if (document.visibilityState === 'visible') schedule(); };
  const pageshow = (event: PageTransitionEvent) => { if (event.persisted) schedule(); };
  window.addEventListener(CONNECTION_UPDATE_EVENT, schedule);
  window.addEventListener('social-connection-updated', schedule);
  window.addEventListener('storage', storage);
  window.addEventListener('focus', visible);
  window.addEventListener('pageshow', pageshow);
  document.addEventListener('visibilitychange', visible);
  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    window.removeEventListener(CONNECTION_UPDATE_EVENT, schedule);
    window.removeEventListener('social-connection-updated', schedule);
    window.removeEventListener('storage', storage);
    window.removeEventListener('focus', visible);
    window.removeEventListener('pageshow', pageshow);
    document.removeEventListener('visibilitychange', visible);
  };
}