/**
 * Debug/admin gate for the AI live-status chip.
 *
 * Normal users only ever see the clean human-readable status text. Raw JSON
 * (phase, progress, run id, tool payload) is available ONLY when debug mode is
 * explicitly enabled — via `?aidebug=1` in the URL or the persisted flag.
 */
const KEY = 'ai_status_debug';

export function isAIStatusDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const param = new URLSearchParams(window.location.search).get('aidebug');
    if (param === '1') {
      localStorage.setItem(KEY, '1');
      return true;
    }
    if (param === '0') {
      localStorage.removeItem(KEY);
      return false;
    }
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setAIStatusDebug(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
