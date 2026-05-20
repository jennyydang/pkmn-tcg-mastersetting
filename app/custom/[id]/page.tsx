"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchCards, getCard } from "@/lib/api";
import { PokemonCard } from "@/lib/types";
import CardPriceModal from "@/app/components/CardPriceModal";
import CollectionEditSheet from "@/app/components/CollectionEditSheet";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import ProgressBar from "@/app/components/ProgressBar";
import { ChevronRightIcon, SearchIcon } from "@/app/components/Icons";
import Image from "next/image";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default function CustomSetPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { trackedItems, isCardOwned, toggleCard, addCustomCard, removeCustomCard, removeItem, updateItem } = useStore();

  const [filter, setFilter]     = useState<"all" | "owned" | "missing">("all");
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery]       = useState("");
  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [priceCard, setPriceCard]     = useState<PokemonCard | null>(null);
  const [priceOpen, setPriceOpen]     = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [editOpen, setEditOpen]       = useState(false);

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

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  const tracked = trackedItems.find((t) => t.id === id && t.type === "custom");
  const customCards = tracked?.customCards ?? [];
  const ownedCount  = tracked?.ownedCards.length ?? 0;

  async function handleSearch(q: string) {
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    setSearching(true);
    try {
      const results = await searchCards(q);
      setSearchResults(results);
      setSearchOpen(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(q), 350);
  }

  function addCard(card: PokemonCard) {
    addCustomCard(id, {
      id:         card.id,
      name:       card.name,
      imageSmall: card.images.small,
      setName:    card.set.name,
    });
    setQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  }

  const alreadyInSet = new Set(customCards.map((c) => c.id));

  const filteredCards = customCards.filter((card) => {
    if (filter === "owned")   return isCardOwned(id, card.id);
    if (filter === "missing") return !isCardOwned(id, card.id);
    return true;
  });

  if (authLoading || !user) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!tracked) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
      <p className="text-gray-500 dark:text-gray-400">Custom set not found.</p>
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 underline">← Back to home</Link>
    </div>
  );

  const complete = customCards.length > 0 && ownedCount >= customCards.length;

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Home</Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{tracked.label}</span>
      </nav>

      {/* Header card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tracked.label}</h1>
          <button
            onClick={() => setEditOpen(true)}
            aria-label="Edit collection options"
            className="shrink-0 p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{tracked.subtitle ?? `Custom set · ${customCards.length} cards`}</p>
        <ProgressBar owned={ownedCount} total={customCards.length} />
        {complete && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-sm font-semibold px-3 py-1.5 rounded-full">
            🏆 Custom Set Complete!
          </div>
        )}
      </div>

      {/* Search to add cards */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
              <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
              <input
                id="card-search"
                type="text"
                value={query}
                onChange={handleSearchChange}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={(e) => { if (e.key === "Enter") { if (debounceRef.current) clearTimeout(debounceRef.current); handleSearch(query); } }}
                placeholder="Search cards to add to this set…"
                aria-label="Search cards to add to this set"
                aria-controls="card-search-results"
                aria-expanded={searchOpen && searchResults.length > 0}
                className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
              />
              {searching && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" aria-label="Searching" />}
            </div>

            {searchOpen && searchResults.length > 0 && (
              <ul id="card-search-results" role="listbox" className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                {searchResults.map((card) => {
                  const already = alreadyInSet.has(card.id);
                  return (
                    <li key={card.id} role="option" aria-selected={already}>
                      <button
                        onMouseDown={() => { if (!already) addCard(card); }}
                        disabled={already}
                        className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 transition-colors text-left focus-visible:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-blue-900/20"
                      >
                        <Image src={card.images.small} alt="" width={36} height={50} className="object-contain shrink-0 rounded" unoptimized />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{card.name}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{card.set.name} #{card.number}</p>
                        </div>
                        {already
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
          <button
            onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); handleSearch(query); }}
            aria-label="Search cards"
            className="shrink-0 px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Search
          </button>
        </div>
      </div>

      {/* Filters + edit toggle */}
      <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
        <div className="flex items-center gap-2" role="group" aria-label="Filter cards">
          {(["all", "owned", "missing"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-medium transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${filter === f ? "bg-blue-600 text-white shadow-sm" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400"}`}>
              {f === "all" ? `All (${customCards.length})` : f === "owned" ? `Owned (${ownedCount})` : `Missing (${customCards.length - ownedCount})`}
            </button>
          ))}
        </div>
        {customCards.length > 0 && (
          <button
            onClick={() => setIsEditing((v) => !v)}
            aria-pressed={isEditing}
            className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${isEditing ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
          >
            {isEditing ? "Done" : "Edit Cards"}
          </button>
        )}
      </div>

      {/* Card grid */}
      {filteredCards.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
          {filteredCards.map((card) => {
            const owned = isCardOwned(id, card.id);
            return (
              <div key={card.id} className="relative">
                {isEditing && (
                  <button
                    onClick={() => removeCustomCard(id, card.id)}
                    aria-label={`Remove ${card.name} from set`}
                    className="absolute top-1.5 right-1.5 z-20 w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-full flex items-center justify-center shadow-md hover:bg-red-600 dark:hover:bg-red-500 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => { if (!isEditing) toggleCard(id, card.id); }}
                  aria-label={`${card.name} from ${card.setName} — ${owned ? "Owned, click to unmark" : "Not owned, click to mark as owned"}`}
                  aria-pressed={owned}
                  className={`w-full relative rounded-lg overflow-hidden transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${!isEditing ? "cursor-pointer hover:scale-105" : "cursor-default"} ${owned ? "opacity-100 shadow-md" : "opacity-50 hover:opacity-70"}`}
                >
                  <Image
                    src={card.imageSmall}
                    alt={card.name}
                    width={146}
                    height={204}
                    className="w-full h-auto block"
                    unoptimized
                  />
                  {owned && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow" aria-hidden="true">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleInfo(card.id); }}
                  aria-label={`View price for ${card.name}`}
                  className="absolute top-0 left-0 w-11 h-11 flex items-center justify-center transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span className="w-5 h-5 bg-black/50 group-hover:bg-black/70 rounded-full flex items-center justify-center" aria-hidden="true">
                    <span className="text-white text-[10px] font-bold leading-none">i</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center text-gray-400 dark:text-gray-600">
          {customCards.length === 0
            ? <p className="text-lg">Search above to add cards to this set.</p>
            : <p className="text-lg">No cards to show</p>
          }
        </div>
      )}

      {priceOpen && (
        <CardPriceModal card={priceCard} loading={priceLoading} onClose={closePriceModal} />
      )}

      {editOpen && (
        <CollectionEditSheet
          item={tracked}
          onSave={(updates) => updateItem(id, updates)}
          onDelete={() => { removeItem(id); router.replace("/"); }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
