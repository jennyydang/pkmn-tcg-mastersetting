"use client";

import { useState, useRef } from "react";
import { searchAll, SearchResult } from "@/lib/api";
import { useStore } from "@/lib/store";
import { SearchIcon, XIcon } from "./Icons";
import Image from "next/image";

export default function MasterSetSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<SearchResult | null>(null);
  const { addItem, hasItem } = useStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(q: string) {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await searchAll(q);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 400);
  }

  function handleConfirm() {
    if (!pending) return;
    addItem({
      type: pending.type,
      id: pending.id,
      label: pending.label,
      image: pending.image,
      totalCards: 0,
      ownedCards: [],
      subtitle: pending.subtitle,
    });
    setPending(null);
    setQuery("");
    setResults([]);
  }

  function handleSearchButton() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    search(query);
  }

  const sets    = results.filter((r) => r.type === "set");
  const pokemon = results.filter((r) => r.type === "pokemon");
  const artists = results.filter((r) => r.type === "artist");
  const hasResults = results.length > 0;

  return (
    <>
      <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1">
        <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
          <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearchButton(); }}
            placeholder="Search a Pokémon, set, or artist…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            onFocus={() => hasResults && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />}
        </div>

        {open && hasResults && (
          <ul className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-80 overflow-y-auto">
            {sets.length > 0 && (
              <>
                <li className="px-4 pt-2.5 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Sets</span>
                </li>
                {sets.map((r) => <ResultRow key={r.id} result={r} onSelect={() => { if (!hasItem(r.id)) setPending(r); setOpen(false); }} alreadyTracking={hasItem(r.id)} />)}
              </>
            )}
            {pokemon.length > 0 && (
              <>
                <li className={`px-4 pb-1 ${sets.length > 0 ? "pt-2.5 border-t border-gray-100 dark:border-gray-700 mt-1" : "pt-2.5"}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Pokémon</span>
                </li>
                {pokemon.map((r) => <ResultRow key={r.id} result={r} onSelect={() => { if (!hasItem(r.id)) setPending(r); setOpen(false); }} alreadyTracking={hasItem(r.id)} />)}
              </>
            )}
            {artists.length > 0 && (
              <>
                <li className={`px-4 pb-1 ${sets.length > 0 || pokemon.length > 0 ? "pt-2.5 border-t border-gray-100 dark:border-gray-700 mt-1" : "pt-2.5"}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Artists</span>
                </li>
                {artists.map((r) => <ResultRow key={`artist:${r.id}`} result={r} onSelect={() => { if (!hasItem(r.id)) setPending(r); setOpen(false); }} alreadyTracking={hasItem(r.id)} />)}
              </>
            )}
          </ul>
        )}

        {open && !loading && !hasResults && query.trim() && (
          <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
      <button
        onClick={handleSearchButton}
        aria-label="Search"
        className="shrink-0 px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Search
      </button>
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPending(null); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="relative bg-gradient-to-b from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 p-6 flex flex-col items-center gap-3">
              <button
                onClick={() => setPending(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <XIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              {pending.image && (
                <Image
                  src={pending.image}
                  alt={pending.label}
                  width={pending.type === "set" ? 180 : 100}
                  height={pending.type === "set" ? 70 : 140}

                  className="object-contain drop-shadow-lg"
                  unoptimized
                />
              )}
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  Add {pending.label}{pending.type === "pokemon" ? " Master Set" : pending.type === "artist" ? " Artist Collection" : ""}?
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {pending.type === "pokemon"
                    ? `Track every ${pending.label} card across all sets.`
                    : pending.type === "artist"
                    ? `Track every card illustrated by ${pending.label}.`
                    : `Track every card in the ${pending.label} set.`}
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-4">
              <button
                onClick={() => setPending(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors"
              >
                Add to My List
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultRow({ result, onSelect, alreadyTracking }: { result: SearchResult; onSelect: () => void; alreadyTracking: boolean }) {
  return (
    <li>
      <button
        onMouseDown={onSelect}
        disabled={alreadyTracking}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 transition-colors text-left"
      >
        {result.image ? (
          <Image
            src={result.image}
            alt={result.label}
            width={result.type === "set" ? 56 : 36}
            height={result.type === "set" ? 22 : 50}
            className="object-contain shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-9 h-9 rounded bg-gray-200 dark:bg-gray-700 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{result.label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.subtitle}</p>
        </div>
        {alreadyTracking ? (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">Tracking</span>
        ) : (
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">+ Add →</span>
        )}
      </button>
    </li>
  );
}
