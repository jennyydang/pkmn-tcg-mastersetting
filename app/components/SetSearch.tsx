"use client";

import { useState, useRef } from "react";
import { searchPokemon, PokemonEntry } from "@/lib/api";
import { useStore } from "@/lib/store";
import { SearchIcon, XIcon } from "./Icons";
import Image from "next/image";

export default function PokemonSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PokemonEntry | null | "none">(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PokemonEntry | null>(null);
  const { addPokemon, hasPokemon } = useStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(q: string) {
    if (!q.trim()) {
      setResult(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const entry = await searchPokemon(q);
      setResult(entry ?? "none");
      setOpen(true);
    } catch {
      setResult("none");
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

  function handleSelect(entry: PokemonEntry) {
    setOpen(false);
    setPending(entry);
  }

  function handleConfirm() {
    if (!pending) return;
    addPokemon(pending.name, pending.image);
    setPending(null);
    setQuery("");
    setResult(null);
  }

  return (
    <>
      <div className="relative w-full max-w-lg">
        <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
          <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search a Pokémon (e.g. Pidgey)..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            onFocus={() => result && result !== "none" && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
        </div>

        {open && result && result !== "none" && (
          <ul className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
            <li>
              <button
                onMouseDown={() => handleSelect(result)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <Image
                  src={result.image}
                  alt={result.name}
                  width={36}
                  height={50}
                  className="object-contain shrink-0 rounded"
                  unoptimized
                />
                <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{result.name}</span>
                {hasPokemon(result.name) ? (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium shrink-0">Already tracking</span>
                ) : (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">+ Add →</span>
                )}
              </button>
            </li>
          </ul>
        )}

        {open && result === "none" && query.trim() && (
          <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            No Pokémon found for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>

      {/* Confirmation modal */}
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
              <Image
                src={pending.image}
                alt={pending.name}
                width={100}
                height={140}
                className="object-contain drop-shadow-lg"
                unoptimized
              />
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  Add {pending.name} Master Set?
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Track every {pending.name} card across all sets.
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
