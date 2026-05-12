"use client";

import { use, useEffect, useState } from "react";
import { getSet, getCardsForSet } from "@/lib/api";
import { PokemonCard, PokemonSet } from "@/lib/types";
import { useStore } from "@/lib/store";
import CardGrid from "@/app/components/CardGrid";
import ProgressBar from "@/app/components/ProgressBar";
import { ChevronRightIcon } from "@/app/components/Icons";
import Image from "next/image";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default function SetMasterSetPage({ params }: Props) {
  const { id } = use(params);
  const [set, setSet] = useState<PokemonSet | null>(null);
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "owned" | "missing">("all");
  const { isCardOwned, toggleCard, hasItem, addItem, updateTotal, trackedItems } = useStore();

  const tracked = trackedItems.find((t) => t.id === id && t.type === "set");
  const ownedCount = tracked?.ownedCards.length ?? 0;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [fetchedSet, fetchedCards] = await Promise.all([getSet(id), getCardsForSet(id)]);
        setSet(fetchedSet);
        setCards(fetchedCards);
        if (!hasItem(id)) {
          addItem({
            type: "set",
            id: fetchedSet.id,
            label: fetchedSet.name,
            image: fetchedSet.images?.logo || fetchedSet.images?.symbol || "",
            totalCards: fetchedCards.length,
            ownedCards: [],
            subtitle: `${fetchedSet.series} · ${fetchedSet.printedTotal ?? fetchedSet.total} cards`,
          });
        }
        if (fetchedCards.length > 0) updateTotal(id, fetchedCards.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load set");
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filteredCards = cards.filter((card) => {
    if (filter === "owned") return isCardOwned(id, card.id);
    if (filter === "missing") return !isCardOwned(id, card.id);
    return true;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 dark:text-gray-400 text-sm">Loading set…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
      <p className="text-red-500 font-medium">{error}</p>
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 underline">← Back to home</Link>
    </div>
  );

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Home</Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{set?.name}</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {set?.images?.logo && (
            <Image src={set.images.logo} alt={set.name} width={200} height={70}
              className="object-contain max-h-16 w-auto" unoptimized />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-0.5">{set?.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {set?.series} · Released {set?.releaseDate} · {cards.length} cards
            </p>
            <ProgressBar owned={ownedCount} total={cards.length} />
            {ownedCount >= cards.length && cards.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-sm font-semibold px-3 py-1.5 rounded-full">
                🏆 Master Set Complete!
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        {(["all", "owned", "missing"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${filter === f ? "bg-blue-600 text-white shadow-sm" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400"}`}>
            {f === "all" ? `All (${cards.length})` : f === "owned" ? `Owned (${ownedCount})` : `Missing (${cards.length - ownedCount})`}
          </button>
        ))}
      </div>

      {filteredCards.length > 0 ? (
        <CardGrid cards={filteredCards} isOwned={(cid) => isCardOwned(id, cid)} onToggle={(cid) => toggleCard(id, cid)} />
      ) : (
        <div className="py-16 text-center text-gray-400 dark:text-gray-600"><p className="text-lg">No cards to show</p></div>
      )}
    </div>
  );
}
