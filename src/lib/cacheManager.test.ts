import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./jobApplicationService", () => ({ BUILD_VERSION: "test" }));

import { clearAllCaches, isPushWorkerUrl } from "./cacheManager";

const registration = (scriptURL: string) => ({
  active: { scriptURL },
  waiting: null,
  installing: null,
  unregister: vi.fn().mockResolvedValue(true),
});

afterEach(() => vi.unstubAllGlobals());

describe("cache clearing keeps push notifications subscribed", () => {
  it("recognises the push notification worker", () => {
    expect(isPushWorkerUrl("https://site.in/firebase-messaging-sw.js?apiKey=x")).toBe(true);
    expect(isPushWorkerUrl("https://site.in/sw.js")).toBe(false);
  });

  it("never unregisters the push worker, but still removes old workers", async () => {
    const push = registration("https://site.in/firebase-messaging-sw.js?apiKey=x");
    const old = registration("https://site.in/sw.js");
    const store: Record<string, string> = {};
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() });
    vi.stubGlobal("window", { caches: {} });
    vi.stubGlobal("navigator", { serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([push, old]) } });
    vi.stubGlobal("localStorage", { removeItem: (k: string) => delete store[k] });

    await clearAllCaches();

    expect(push.unregister).not.toHaveBeenCalled();
    expect(old.unregister).toHaveBeenCalledTimes(1);
  });
});
