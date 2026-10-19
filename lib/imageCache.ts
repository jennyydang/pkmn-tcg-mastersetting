"use client";

import { useEffect, useState } from "react";
import { createStore, get, set } from "idb-keyval";
import { useOnline } from "./online";

// Card scans saved for offline use (IndexedDB), keyed by image URL. Online, the
// app loads images normally; offline, CardImage swaps in the saved copy.

const store = typeof indexedDB !== "undefined" ? createStore("pocketi-images", "blobs") : null;

/**
 * Save one image. "stored" = kept in IndexedDB. If the image server doesn't
 * allow reading the file (CORS), fall back to loading it once so the browser's
 * own cache has it ("warmed"), which usually also works offline.
 */
export async function saveImage(url: string): Promise<"stored" | "warmed" | "failed"> {
  if (!url || url.startsWith("/")) return "stored"; // bundled with the app
  try {
    if (store && (await get(url, store))) return "stored";
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    if (store) await set(url, await res.blob(), store);
    return "stored";
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve("warmed");
      img.onerror = () => resolve("failed");
      img.src = url;
    });
  }
}

/** The image URL to use: the saved copy when offline, otherwise the original. */
export function useImageSrc(url: string): string {
  const online = useOnline();
  const [offlineSrc, setOfflineSrc] = useState<string | null>(null);

  useEffect(() => {
    if (online || !store || !url || url.startsWith("/")) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    get<Blob>(url, store).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setOfflineSrc(objectUrl);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setOfflineSrc(null);
    };
  }, [online, url]);

  return (!online && offlineSrc) || url;
}
