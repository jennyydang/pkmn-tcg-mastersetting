"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CardImage from "@/app/components/CardImage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { getCardsByIds, getCard, getCardsForArtist, getCardsForPokemon, getCardsForSet, searchCards } from "@/lib/api";
import { CardVariant, PokemonCard, TrackedMasterSet } from "@/lib/types";
import CardPriceModal from "@/app/components/CardPriceModal";
import { cardVariants, ownedCardIds, parseOwnedKey } from "@/lib/variants";
import VersionPicker from "@/app/components/VersionPicker";
import { staggerStyle, tiltHandlers } from "@/lib/motion";
import { CardsIcon, ChevronRightIcon, SearchIcon, SwapIcon, TrendingUpIcon } from "@/app/components/Icons";
import { useCardData } from "@/lib/cardData";
import { extrasFromDetails } from "@/lib/trade";
import { setFitsCard, setsHoldingCard } from "@/lib/setMembership";
import AddToSetsSheet, { addedIntro } from "@/app/components/AddToSetsSheet";
import { useAddToCollection } from "@/lib/addCopies";
import { useConfirm } from "@/lib/confirm";

export default function CollectionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { collectionCardIds, removeCollectionCard, isInCollection, trackedItems, toggleCard } = useStore();
  const { details } = useCardData();
  const addToCollection = useAddToCollection();
  const confirm = useConfirm();
  const extraCount = extrasFromDetails(details).reduce((n, e) => n + e.count, 0);

  const [cards, setCards]               = useState<PokemonCard[]>([]);
  const [loading, setLoading]           = useState(true);

  const [priceCard, setPriceCard]       = useState<PokemonCard | null>(null);
  const [priceOpen, setPriceOpen]       = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [setsFor, setSetsFor]           = useState<{ card: PokemonCard; intro?: string; variant?: CardVariant } | null>(null);
  const [versionFor, setVersionFor]     = useState<PokemonCard | null>(null);


  const [query, setQuery]               = useState("");
  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [searching, setSearching]       = useState(false);
  const [searchOpen, setSearchOpen]     = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  // Every card you own, once: cards added here (in the order added), then cards
  // checked off in master sets that aren't here yet.
  const ownedIdsKey = useMemo(() => {
    const ids = new Set(collectionCardIds);
    for (const t of trackedItems) for (const id of ownedCardIds(t.ownedCards)) ids.add(id);
    return [...ids].join("\n");
  }, [collectionCardIds, trackedItems]);

  // Cards loaded so far, so adding or removing one doesn't reload the rest.
  const cardCache = useRef(new Map<string, PokemonCard>());

  useEffect(() => {
    if (authLoading || !user) return;
    const ids = ownedIdsKey ? ownedIdsKey.split("\n") : [];
    const show = () => setCards(ids.flatMap((id) => cardCache.current.get(id) ?? []));
    const missing = ids.filter((id) => !cardCache.current.has(id));
    if (missing.length === 0) {
      show();
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      // Cards checked off in a set, Pokémon or artist master set come from one
      // request for that master set's whole list; anything else (custom sets,
      // cards added here) is fetched card by card.
      const lists = new Map<string, TrackedMasterSet>();
      const loose: string[] = [];
      for (const id of missing) {
        const item = trackedItems.find((t) => t.type !== "custom" && t.ownedCards.some((k) => parseOwnedKey(k).cardId === id));
        if (item) lists.set(`${item.type}:${item.id}`, item);
        else loose.push(id);
      }
      const listFor = (t: TrackedMasterSet) =>
        t.type === "set" ? getCardsForSet(t.id) : t.type === "pokemon" ? getCardsForPokemon(t.id) : getCardsForArtist(t.id);
      const results = await Promise.allSettled([...[...lists.values()].map(listFor), getCardsByIds(loose)]);
      if (cancelled) return;
      const wanted = new Set(missing);
      for (const r of results) {
        if (r.status === "fulfilled") for (const c of r.value) if (wanted.has(c.id)) cardCache.current.set(c.id, c);
      }
      // A list that failed to load: fall back to its cards one by one.
      const stillMissing = missing.filter((id) => !cardCache.current.has(id) && !loose.includes(id));
      if (stillMissing.length) {
        for (const c of await getCardsByIds(stillMissing).catch(() => [])) cardCache.current.set(c.id, c);
        if (cancelled) return;
      }
      show();
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
    // trackedItems is read for set membership only; ownedIdsKey covers what changes the grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, ownedIdsKey]);

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
    debounceRef.current = setTimeout(() => runSearch(q), 350);
  }

  async function runSearch(q: string) {
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

  // Search button / keyboard Search key: search now instead of waiting for typing to pause.
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim()) runSearch(query);
  }

  async function handleAddFromSearch(result: PokemonCard) {
    setQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    // Search results can lack details (like the artist) needed to find every
    // master set the card belongs to; the full card is usually already cached.
    const card = await getCard(result.id).catch(() => result);
    // Printed in more than one version: ask which one before adding.
    if (cardVariants(card).length > 1) setVersionFor(card);
    else finishAdd(card);
  }

  function finishAdd(card: PokemonCard, variant?: CardVariant) {
    setVersionFor(null);
    const checked = addToCollection(card, variant);
    cardCache.current.set(card.id, card);
    // Optimistically prepend to cards
    setCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev;
      return [card, ...prev];
    });
    // Offer to count it toward any tracked sets it belongs to.
    if (trackedItems.some((t) => setFitsCard(t, card))) setSetsFor({ card, intro: addedIntro(checked), variant });
  }

  // The grid shows every card you own, so removing a card also unchecks it in
  // any master set that has it (after asking).
  async function handleRemove(card: PokemonCard) {
    const sets = setsHoldingCard(trackedItems, card.id);
    const ok = await confirm({
      title: `Remove ${card.name} from your collection?`,
      message: sets.length > 0
        ? `It will also be unchecked in ${sets.length === 1 ? "your master set" : `${sets.length} master sets`}: ${sets.map((t) => t.label).join(", ")}.`
        : `${card.set.name} #${card.number}`,
    });
    if (!ok) return;
    if (sets.length > 0) {
      for (const t of sets) {
        for (const key of t.ownedCards.filter((k) => parseOwnedKey(k).cardId === card.id)) toggleCard(t.id, key);
      }
    }
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

  const ownedCount = ownedIdsKey ? ownedIdsKey.split("\n").length : 0;

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
          {ownedCount === 0
            ? "No cards yet"
            : `${ownedCount} card${ownedCount === 1 ? "" : "s"} owned, including everything checked off in your master sets`}
        </p>
      </div>

      {/* Portfolio lives under Collection in the phone tab bar. */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
      <Link href="/portfolio" className="tile flex items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 shadow-sm">
        <span className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <TrendingUpIcon className="w-5 h-5" />
          </span>
          <span>
            <span className="block font-semibold text-gray-900 dark:text-gray-100">Portfolio</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Collection value, profit/loss and history</span>
          </span>
        </span>
        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
      </Link>
      <Link href="/extras" className="tile flex items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 shadow-sm">
        <span className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center">
            <SwapIcon className="w-5 h-5" />
          </span>
          <span>
            <span className="block font-semibold text-gray-900 dark:text-gray-100">Extras for trade</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{extraCount > 0 ? `${extraCount} duplicate ${extraCount === 1 ? "copy" : "copies"} · share your trade list` : "Your duplicates, ready to share"}</span>
          </span>
        </span>
        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
      </Link>
      </div>

      {/* Add row: search (the scanner is the camera button in the tab bar) */}
      <form onSubmit={handleSearchSubmit} role="search" className="flex gap-2 mb-6">
        {/* Search input with dropdown */}
        <div className="relative flex-1 min-w-0">
          <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <SearchIcon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
            <input
              id="collection-search"
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={handleSearchChange}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Search by name or card number…"
              aria-label="Search cards to add to collection"
              aria-controls="collection-search-results"
              aria-expanded={searchOpen && searchResults.length > 0}
              className="flex-1 min-w-0 appearance-none bg-transparent outline-none focus:outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
            {searching && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" aria-label="Searching" />
            )}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <ul
              id="collection-search-results"
              role="listbox"
              className="dropdown-in absolute z-50 top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-72 overflow-y-auto"
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

        <button
          type="submit"
          // Keep focus in the box so the results dropdown stays open.
          onMouseDown={(e) => e.preventDefault()}
          className="shrink-0 flex items-center gap-2 px-4 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <SearchIcon className="w-4 h-4" />
          Search
        </button>
      </form>

      {/* Card grid */}
      {loading && cards.length === 0 ? (
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
          <CardsIcon className="w-12 h-12" />
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Your collection is empty</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Search for cards above, scan them, or check them off in a master set.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
          {cards.map((card, i) => (
            <div key={card.id} style={staggerStyle(i)} className="stagger-in relative">
              {/* Remove button */}
              <button
                onClick={() => handleRemove(card)}
                aria-label={`Remove ${card.name} (${card.set.name} #${card.number}) from collection`}
                className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-gray-800/70 dark:bg-gray-200/70 text-white dark:text-gray-900 rounded-full flex items-center justify-center shadow-md hover:bg-red-600 dark:hover:bg-red-500 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Tap the card for its details and prices */}
              <button
                onClick={() => handleInfo(card.id)}
                {...tiltHandlers}
                aria-label={`${card.name} (${card.set.name} #${card.number}): details and prices`}
                className="tile block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <CardImage
                  src={card.images.small}
                  alt=""
                  width={146}
                  height={204}
                  className="w-full h-auto block rounded-lg shadow-sm"
                />
              </button>

              {(() => {
                const n = setsHoldingCard(trackedItems, card.id).length;
                return (
                  <button
                    onClick={() => setSetsFor({ card })}
                    aria-label={`Add ${card.name} (${card.set.name} #${card.number}) to sets${n ? `, in ${n} ${n === 1 ? "set" : "sets"}` : ""}`}
                    className={`mt-1 w-full min-h-[32px] rounded-lg text-[11px] font-semibold transition-colors ${n ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}`}
                  >
                    {n ? `In ${n} ${n === 1 ? "set" : "sets"}` : "+ Add to sets"}
                  </button>
                );
              })()}
            </div>
          ))}
        </div>
      )}


      {versionFor && <VersionPicker card={versionFor} onPick={(v) => finishAdd(versionFor, v)} onCancel={() => setVersionFor(null)} />}
      {setsFor && <AddToSetsSheet card={setsFor.card} intro={setsFor.intro} initialVariant={setsFor.variant} onClose={() => setSetsFor(null)} />}

      {/* Price modal */}
      {priceOpen && (
        <CardPriceModal card={priceCard} loading={priceLoading} onClose={closePriceModal} owned={!!priceCard && isInCollection(priceCard.id)} />
      )}

    </div>
  );
}
