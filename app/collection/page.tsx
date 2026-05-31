"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { getCardsByIds, getCard, searchCards } from "@/lib/api";
import { PokemonCard } from "@/lib/types";
import CardPriceModal from "@/app/components/CardPriceModal";
import CardScanSheet from "@/app/components/CardScanSheet";
import { ChevronRightIcon, SearchIcon } from "@/app/components/Icons";

export default function CollectionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { collectionCardIds, addCollectionCard, removeCollectionCard, isInCollection } = useStore();

  const [cards, setCards]               = useState<PokemonCard[]>([]);
  const [loading, setLoading]           = useState(true);

  const [priceCard, setPriceCard]       = useState<PokemonCard | null>(null);
  const [priceOpen, setPriceOpen]       = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);

  const [scanOpen, setScanOpen]         = useState(false);

  const [query, setQuery]               = useState("");
  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [searching, setSearching]       = useState(false);
  const [searchOpen, setSearchOpen]     = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  // Load cards from API whenever collectionCardIds changes
  useEffect(() => {
    if (authLoading || !user) return;
    if (collectionCardIds.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const fetched = await getCardsByIds(collectionCardIds);
        // Preserve insertion order (collectionCardIds order)
        const byId = new Map<string, PokemonCard>();
        for (const c of fetched) byId.set(c.id, c);
        const ordered: PokemonCard[] = [];
        for (const id of collectionCardIds) {
          const c = byId.get(id);
          if (c) ordered.push(c);
        }
        setCards(ordered);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, authLoading, collectionCardIds]);

  // Debounced search
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchCards(q);
        setSearchResults(results);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function handleAddFromSearch(card: PokemonCard) {
    addCollectionCard(card.id);
    // Optimistically prepend to cards
    setCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev;
      return [card, ...prev];
    });
    setQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  }

  function handleRemove(card: PokemonCard) {
    removeCollectionCard(card.id);
    setCards((prev) => prev.filter((c) => c.id !== card.id));
  }

  async function handleInfo(cardId: string) {
    setPriceCard(null);
    setPriceOpen(true);
    setPriceLoading(true);
    try {
      const full = await getCard(cardId);
      setPriceCard(full);
    } finally {
      setPriceLoading(false);
    }
  }

  function closePriceModal() {
    setPriceOpen(false);
    setPriceCard(null);
  }

  function handleScanAdd(card: PokemonCard) {
    addCollectionCard(card.id);
    setCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev;
      return [card, ...prev];
    });
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Home</Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">My Collection</span>
      </nav>

      {/* Header card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">My Collection</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {collectionCardIds.length === 0
            ? "No cards yet"
            : `${collectionCardIds.length} card${collectionCardIds.length === 1 ? "" : "s"} in your collection`}
        </p>
      </div>

      {/* Add row: search + scan */}
      <div className="flex gap-2 mb-6">
        {/* Search input with dropdown */}
        <div className="relative flex-1">
          <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
            <input
              id="collection-search"
              type="text"
              value={query}
              onChange={handleSearchChange}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Search by name or card number…"
              aria-label="Search cards to add to collection"
              aria-controls="collection-search-results"
              aria-expanded={searchOpen && searchResults.length > 0}
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
            {searching && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" aria-label="Searching" />
            )}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <ul
              id="collection-search-results"
              role="listbox"
              className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-72 overflow-y-auto"
            >
              {searchResults.map((card) => {
                const inCol = isInCollection(card.id);
                return (
                  <li key={card.id} role="option" aria-selected={inCol}>
                    <button
                      onMouseDown={() => { if (!inCol) handleAddFromSearch(card); }}
                      disabled={inCol}
                      className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 transition-colors text-left focus-visible:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-blue-900/20"
                    >
                      <Image
                        src={card.images.small}
                        alt=""
                        width={36}
                        height={50}
                        className="object-contain shrink-0 rounded"
                        unoptimized
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{card.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{card.set.name} #{card.number}</p>
                      </div>
                      {inCol
                        ? <span className="text-xs text-green-700 dark:text-green-400 font-medium shrink-0">Added</span>
                        : <span className="text-xs text-blue-700 dark:text-blue-400 font-medium shrink-0">+ Add</span>
                      }
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Scan button */}
        <button
          onClick={() => setScanOpen(true)}
          aria-label="Scan a card"
          className="shrink-0 flex items-center gap-2 px-4 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-12h-3a1 1 0 00-1 1v3" />
          </svg>
          Scan
        </button>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[146/204] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <span className="text-5xl" aria-hidden="true">🃏</span>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Your collection is empty</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Search or scan cards above to add them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
          {cards.map((card) => (
            <div key={card.id} className="relative">
              {/* Remove button */}
              <button
                onClick={() => handleRemove(card)}
                aria-label={`Remove ${card.name} from collection`}
                className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-gray-800/70 dark:bg-gray-200/70 text-white dark:text-gray-900 rounded-full flex items-center justify-center shadow-md hover:bg-red-600 dark:hover:bg-red-500 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Info ("i") button */}
              <button
                onClick={() => handleInfo(card.id)}
                aria-label={`View price for ${card.name}`}
                className="absolute top-0 left-0 w-11 h-11 flex items-center justify-center transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <span className="w-5 h-5 bg-black/50 group-hover:bg-black/70 rounded-full flex items-center justify-center" aria-hidden="true">
                  <span className="text-white text-[10px] font-bold leading-none">i</span>
                </span>
              </button>

              {/* Card image */}
              <Image
                src={card.images.small}
                alt={card.name}
                width={146}
                height={204}
                className="w-full h-auto block rounded-lg shadow-sm"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}

      {/* Price modal */}
      {priceOpen && (
        <CardPriceModal card={priceCard} loading={priceLoading} onClose={closePriceModal} />
      )}

      {/* Scan sheet */}
      {scanOpen && (
        <CardScanSheet
          onAdd={handleScanAdd}
          onClose={() => setScanOpen(false)}
          isInCollection={isInCollection}
        />
      )}
    </div>
  );
}
