"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchPokemon, PokemonEntry } from "@/lib/api";
import { SearchIcon } from "./Icons";
import Image from "next/image";

export default function PokemonSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchPokemon(q);
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

  function handleSelect(entry: PokemonEntry) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/pokemon/${encodeURIComponent(entry.name)}`);
  }

  return (
    <div className="relative w-full max-w-lg">
      <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
        <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search Pokémon (e.g. Pidgey)..."
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
          {results.map((entry) => (
            <li key={entry.name}>
              <button
                onMouseDown={() => handleSelect(entry)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <Image
                  src={entry.image}
                  alt={entry.name}
                  width={40}
                  height={56}
                  className="object-contain shrink-0 rounded"
                  unoptimized
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{entry.cardCount} card{entry.cardCount !== 1 ? "s" : ""}</p>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">View →</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          No Pokémon found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
