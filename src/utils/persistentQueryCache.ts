import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

const DB_NAME = "worklyindia-local-query-cache";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "public-query-data-v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_QUERY_BYTES = 750_000;
const WRITE_DELAY_MS = 400;

type StoredSnapshot = {
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
};

let writeTimer: number | undefined;
let writeInProgress = false;
let writeAgain = false;

function isSafeForDeviceCache(queryKey: readonly unknown[]): boolean {
  let key = "";
  try {
    key = JSON.stringify(queryKey).toLowerCase();
  } catch {
    return false;
  }

  // Never persist account-specific, private, financial, messaging or identity data.
  const privateData = /auth|session|token|password|profile|account|applicant|employer|user[-_ ]?id|user[-_ ]?data|chat|message|notification|payment|wallet|resume|cv|document|private|admin|owner|subscription|application|interview|verification|referral|call|contact|email|phone|address|personal|secure|vault|billing/;
  if (privateData.test(key)) return false;

  // Cache public/read-only content only. Mutations are never persisted.
  return true;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readSnapshot(): Promise<StoredSnapshot | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME).get(SNAPSHOT_KEY);
      request.onsuccess = () => {
        const value = request.result as StoredSnapshot | undefined;
        if (!value || Date.now() - value.savedAt > MAX_AGE_MS) {
          resolve(null);
          return;
        }
        resolve(value);
      };
      request.onerror = () => resolve(null);
      request.transaction.oncomplete = () => db.close();
      request.transaction.onerror = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function writeSnapshot(client: QueryClient): Promise<void> {
  if (writeInProgress) {
    writeAgain = true;
    return;
  }
  writeInProgress = true;
  try {
    const state = dehydrate(client, {
      shouldDehydrateQuery: (query) => {
        if (query.state.status !== "success" || !isSafeForDeviceCache(query.queryKey)) return false;
        try {
          return JSON.stringify(query.state.data).length <= MAX_QUERY_BYTES;
        } catch {
          return false;
        }
      },
    });
    const db = await openDatabase();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(
          { savedAt: Date.now(), state } satisfies StoredSnapshot,
          SNAPSHOT_KEY,
        );
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
    db.close();
  } catch (error) {
    console.warn("[WorklyCache] Could not persist public query data", error);
  } finally {
    writeInProgress = false;
    if (writeAgain) {
      writeAgain = false;
      scheduleWrite(client);
    }
  }
}

function scheduleWrite(client: QueryClient): void {
  if (typeof window === "undefined") return;
  if (writeTimer !== undefined) window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => {
    writeTimer = undefined;
    void writeSnapshot(client);
  }, WRITE_DELAY_MS);
}

/**
 * Restore public, non-sensitive query data before React renders, then keep it
 * updated in IndexedDB. Private account data is deliberately excluded.
 */
export async function restoreAndPersistQueryCache(client: QueryClient): Promise<void> {
  const restore = async () => {
    const snapshot = await readSnapshot();
    if (snapshot?.state) hydrate(client, snapshot.state);
  };

  // A slow/broken IndexedDB must never hold the app startup screen for long.
  await Promise.race([
    restore().catch((error) => console.warn("[WorklyCache] Restore failed", error)),
    new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
  ]);

  client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.query.state.status === "success") {
      scheduleWrite(client);
    }
  });

  const persistNow = () => {
    if (writeTimer !== undefined) window.clearTimeout(writeTimer);
    writeTimer = undefined;
    void writeSnapshot(client);
  };
  window.addEventListener("pagehide", persistNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistNow();
  });
}
