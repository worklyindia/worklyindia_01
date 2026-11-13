/**
 * Recovery for stale/failed lazy-chunk loads.
 *
 * After a new deploy, an open tab still holds the old index.html and asks for
 * asset file names that no longer exist. The dynamic import then fails with
 * "Failed to fetch dynamically imported module" and React unmounts the tree
 * (often surfacing as a minified React error), so the user sees a generic
 * "Something went wrong" page.
 *
 * Instead of showing that page we retry the import, and if it still fails we
 * reload the document once with a cache-busting query so the freshest
 * index.html (and matching asset names) is fetched.
 */

import { lazy, type ComponentType } from "react";

const RELOAD_MARK_KEY = "chunk_recovery_reloaded_at";
const RELOAD_COOLDOWN_MS = 10 * 60_000;

const CHUNK_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "failed to load module script",
  "unable to preload css",
  "chunkloaderror",
  "loading chunk",
  "loading css chunk",
  "page chunk load timed out",
];

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : `${(error as { name?: string }).name ?? ""} ${(error as { message?: string }).message ?? ""}`;
  const normalized = message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Mixed-build errors: when a tab mixes assets from two different builds the
 * app can end up with two React copies / mismatched module graphs. React then
 * throws a hook-mismatch invariant (minified #300, #310, #321) instead of a
 * network error. The cure is the same: reload onto a single, current build.
 */
const STALE_BUNDLE_PATTERNS = [
  "rendered fewer hooks than expected",
  "rendered more hooks than during the previous render",
  "invalid hook call",
  "invariant=300",
  "invariant=310",
  "invariant=321",
  "minified react error #300",
  "minified react error #310",
  "minified react error #321",
  "reading 'usestate'",
  "reading 'useeffect'",
  "reading 'usecontext'",
  "reading 'useref'",
];

export function isStaleBundleError(error: unknown): boolean {
  if (isChunkLoadError(error)) return true;
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : `${(error as { name?: string }).name ?? ""} ${(error as { message?: string }).message ?? ""}`;
  const normalized = message.toLowerCase();
  return STALE_BUNDLE_PATTERNS.some((pattern) => normalized.includes(pattern));
}


function reloadedRecently(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_MARK_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOAD_MARK_KEY, String(Date.now()));
  } catch {
    /* storage unavailable - reload guard degrades gracefully */
  }
}

/** Best-effort purge of caches that can keep serving the previous build. */
function purgeStaleCaches(): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  try {
    if ("caches" in window) {
      jobs.push(
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .catch(() => undefined),
      );
    }
  } catch {
    /* ignore */
  }
  try {
    if ("serviceWorker" in navigator) {
      jobs.push(
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(registrations.map((registration) => registration.update().catch(() => undefined))),
          )
          .catch(() => undefined),
      );
    }
  } catch {
    /* ignore */
  }
  return Promise.race([
    Promise.all(jobs).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 600)),
  ]);
}

/**
 * Reload once (cache-busted) so the tab picks up the current build.
 * Returns true when a reload was triggered.
 */
export function recoverFromChunkError(): boolean {
  if (typeof window === "undefined") return false;
  if (reloadedRecently()) return false;

  markReloaded();

  const doReload = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  purgeStaleCaches().then(doReload, doReload);
  return true;
}

/** Manual recovery always requests the newest document and clears stale caches. */
export function forceLatestBuild(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RELOAD_MARK_KEY);
  } catch {
    /* storage unavailable */
  }
  recoverFromChunkError();
}


/** Retry-aware React.lazy: survives a transient network hiccup, self-heals a stale build. */
export function lazyRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
) {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        // A stalled import can otherwise leave React.Suspense on its skeleton
        // forever without ever rejecting. Bound each attempt and run recovery.
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Page chunk load timed out")), 15_000);
        });
        return await Promise.race([factory(), timeout]);
      } catch (error) {
        lastError = error;
        if (!isChunkLoadError(error)) throw error;
        // A hashed deploy asset that no longer exists will never succeed by
        // retrying the same URL. Refresh the document immediately so it picks
        // up the current asset manifest before the error screen can render.
        if (attempt === 0 && recoverFromChunkError()) {
          await new Promise(() => {});
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    }

    if (recoverFromChunkError()) {
      // Keep Suspense pending while the document reloads.
      await new Promise(() => {});
    }
    throw lastError;
  });
}

let installed = false;

/** Catch chunk failures that escape a component boundary (e.g. router prefetch). */
export function installChunkErrorRecovery(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    if (isStaleBundleError(event.error) || isStaleBundleError(event.message)) {
      recoverFromChunkError();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isStaleBundleError(event.reason)) {
      event.preventDefault();
      recoverFromChunkError();
    }
  });
}
