import { expect, test } from "bun:test";
import { clearActiveVideo, getActiveVideoKey, setActiveVideo, subscribeActiveVideo } from "./activeVideoPlayer";
import { audioManager } from "../services/GlobalAudioManager";

test("three home videos replace each other; stale cleanup cannot release the active video", () => {
  const playing = new Set<string>();
  const unsubscribers = ["first", "second", "third"].map(key =>
    subscribeActiveVideo(active => {
      if (active !== key) playing.delete(key);
    }),
  );
  try {
    for (const key of ["first", "second", "third", "first"]) {
      setActiveVideo(key);
      playing.add(key);
      expect([...playing]).toEqual([key]);
      expect(getActiveVideoKey()).toBe(key);
    }
    clearActiveVideo("third");
    expect(getActiveVideoKey()).toBe("first");
    clearActiveVideo("first");
    expect(playing.size).toBe(0);
    expect(getActiveVideoKey()).toBeNull();
  } finally {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    const key = getActiveVideoKey();
    if (key) clearActiveVideo(key);
  }
});

test("old YouTube cleanup cannot stop the next player's global audio ownership", () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { querySelectorAll: () => [] } });
  try {
    audioManager.onVideoPlay("first");
    audioManager.onVideoPlay("second");
    audioManager.onVideoStop("first");
    expect(audioManager.isPlayingVideo()).toBe(true);
    audioManager.onVideoPlay("third");
    audioManager.onVideoStop("second");
    expect(audioManager.isPlayingVideo()).toBe(true);
    audioManager.onVideoStop("third");
    expect(audioManager.isPlayingVideo()).toBe(false);
  } finally {
    audioManager.onVideoStop("third");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});