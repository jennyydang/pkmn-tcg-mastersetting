"use client";

import { useState, useCallback, useRef } from "react";
import { searchSets } from "@/lib/api";
import { PokemonSet } from "@/lib/types";
import { useStore } from "@/lib/store";
import { SearchIcon } from "./Icons";
import Image from "next/image";

export default function SetSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { addSet, hasSet } = useStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchSets(q);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 400);
  }

  function handleAdd(set: PokemonSet) {
    addSet(set);
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="relative w-full max-w-lg">
      <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
        <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search for a Pokémon TCG set..."
          className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-80 overflow-y-auto">
          {results.map((set) => (
            <li key={set.id}>
              <button
                onMouseDown={() => handleAdd(set)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                {set.images?.symbol && (
                  <Image
                    src={set.images.symbol}
                    alt={set.name}
                    width={28}
                    height={28}
                    className="object-contain shrink-0"
                    unoptimized
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{set.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{set.series} · {set.total} cards</p>
                </div>
                {hasSet(set.id) ? (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">Tracking</span>
                ) : (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">+ Add</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          No sets found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
