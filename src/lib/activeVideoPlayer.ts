/**
 * Single-active-video coordinator.
 *
 * Any inline video player registers itself with a unique key and subscribes.
 * When one player starts, every other player is told to stop, so only one
 * video ever plays at a time inside the chat (or anywhere else).
 */
type Listener = (activeKey: string | null) => void;

let activeKey: string | null = null;
const listeners = new Set<Listener>();

export const getActiveVideoKey = () => activeKey;

export function subscribeActiveVideo(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => {
    try {
      l(activeKey);
    } catch {
      /* noop */
    }
  });
}

/** Claim playback for this key — all other players stop. */
export function setActiveVideo(key: string) {
  if (activeKey === key) return;
  activeKey = key;
  emit();
}

/** Release playback if this key currently owns it. */
export function clearActiveVideo(key: string) {
  if (activeKey !== key) return;
  activeKey = null;
  emit();
}
