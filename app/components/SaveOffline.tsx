"use client";

import { useState, useSyncExternalStore } from "react";
import { getCardsByIds } from "@/lib/api";
import { saveImage } from "@/lib/imageCache";
import { useOnline } from "@/lib/online";
import { PokemonCard } from "@/lib/types";
import { CheckIcon, CloudOffIcon } from "./Icons";

// "Save for offline": fetches every card's details and prices (kept by the
// response cache in lib/offlineCache.ts) and saves their images, so the set
// works with no connection, e.g. at a card show.

const KEY = "pocketi-offline-saved";
const CHANGE_EVENT = "pocketi-offline-saved-change";
const CONCURRENCY = 6;

function readSaved(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export default function SaveOffline({ saveKey, cards }: { saveKey: string; cards: PokemonCard[] }) {
  const online = useOnline();
  const savedAt = useSyncExternalStore(subscribe, () => readSaved()[saveKey] ?? null, () => null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function save() {
    const total = cards.length * 2; // details + image per card
    let done = 0;
    const tick = () => setProgress({ done: ++done, total });
    setResult(null);
    setProgress({ done: 0, total });

    // 1. Full card details with prices (cached as they're fetched).
    const ids = cards.map((c) => c.id);
    for (let i = 0; i < ids.length; i += 25) {
      await getCardsByIds(ids.slice(i, i + 25)).catch(() => []);
      for (let j = 0; j < Math.min(25, ids.length - i); j++) tick();
    }

    // 2. Images, a few at a time.
    const counts = { stored: 0, warmed: 0, failed: 0 };
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (next < cards.length) {
        const card = cards[next++];
        counts[await saveImage(card.images.small)]++;
        tick();
      }
    }));

    try {
      localStorage.setItem(KEY, JSON.stringify({ ...readSaved(), [saveKey]: new Date().toISOString() }));
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setProgress(null);
    setResult(counts.failed > 0
      ? `Saved, but ${counts.failed} ${counts.failed === 1 ? "image" : "images"} couldn’t be downloaded.`
      : counts.warmed > 0
        ? "Saved. Some images are kept in the browser cache, which usually works offline."
        : null);
  }

  const busy = progress !== null;
  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {busy ? (
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className="h-2 bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-gray-500 dark:text-gray-400 tabular-nums shrink-0">Saving for offline… {pct}%</span>
        </div>
      ) : savedAt ? (
        <>
          <span className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
            <CheckIcon className="w-4 h-4" /> Saved for offline · {new Date(savedAt).toLocaleDateString()}
          </span>
          {online && (
            <button onClick={save} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Update</button>
          )}
        </>
      ) : (
        <button
          onClick={save}
          disabled={!online}
          className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-medium text-gray-700 dark:text-gray-200 hover:border-blue-400 disabled:opacity-50 transition-colors"
        >
          <CloudOffIcon className="w-4 h-4" />
          Save for offline
          <span className="text-xs text-gray-400 font-normal">({cards.length} cards)</span>
        </button>
      )}
      {result && <p className="w-full text-xs text-gray-500 dark:text-gray-400">{result}</p>}
    </div>
  );
}
