import { createStore, get, set } from "idb-keyval";

// Saved copies of card-data responses (IndexedDB), so anything viewed before
// still loads offline. Requests go to the network first; the saved copy is only
// used when that fails.

const store = typeof indexedDB !== "undefined" ? createStore("pocketi-cache", "responses") : null;

interface Entry<T> {
  data: T;
  savedAt: number;
}

export async function readCache<T>(key: string): Promise<T | undefined> {
  if (!store) return undefined;
  try {
    return (await get<Entry<T>>(key, store))?.data;
  } catch {
    return undefined;
  }
}

export async function writeCache<T>(key: string, data: T) {
  if (!store) return;
  try {
    await set(key, { data, savedAt: Date.now() } satisfies Entry<T>, store);
  } catch {
    // Storage full or unavailable (e.g. private browsing): just don't cache.
  }
}

/**
 * Fetch fresh data and save it; if the fetch fails, fall back to the saved copy.
 * `canFallBack` lets callers rethrow errors a saved copy shouldn't hide (e.g. 404).
 */
export async function networkFirst<T>(key: string, fetcher: () => Promise<T>, canFallBack: (e: unknown) => boolean = () => true): Promise<T> {
  try {
    const data = await fetcher();
    void writeCache(key, data);
    return data;
  } catch (e) {
    if (!canFallBack(e)) throw e;
    const cached = await readCache<T>(key);
    if (cached !== undefined) return cached;
    throw e;
  }
}
