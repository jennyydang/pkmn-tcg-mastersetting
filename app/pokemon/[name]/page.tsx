"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCardsForPokemon } from "@/lib/api";
import { PokemonCard } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import CardGrid from "@/app/components/CardGrid";
import ProgressBar from "@/app/components/ProgressBar";
import CollectionEditSheet from "@/app/components/CollectionEditSheet";
import { ChevronRightIcon } from "@/app/components/Icons";
import Link from "next/link";

interface Props {
  params: Promise<{ name: string }>;
}

export default function PokemonMasterSetPage({ params }: Props) {
  const { name: encodedName } = use(params);
  const name = decodeURIComponent(encodedName);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "owned" | "missing">("all");
  const [editOpen, setEditOpen] = useState(false);
  const { isCardOwned, toggleCard, hasItem, addItem, updateTotal, removeItem, updateItem, trackedItems } = useStore();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  const tracked = trackedItems.find((t) => t.id === name && t.type === "pokemon");
  const ownedCount = tracked?.ownedCards.length ?? 0;
  const displayName = tracked?.label ?? `${name} Master Set`;
  const displaySubtitle = tracked?.subtitle ?? `All ${name} cards across every set`;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const fetched = await getCardsForPokemon(name);
        setCards(fetched);
        if (!hasItem(name) && fetched.length > 0) {
          addItem({ type: "pokemon", id: name, label: name, image: fetched[fetched.length - 1].images.small, totalCards: fetched.length, ownedCards: [], subtitle: "All cards across every set" });
        }
        if (fetched.length > 0) updateTotal(name, fetched.length);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load cards");
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const filteredCards = cards.filter((card) => {
    if (filter === "owned") return isCardOwned(name, card.id);
    if (filter === "missing") return !isCardOwned(name, card.id);
    return true;
  });

  if (authLoading || !user) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 dark:text-gray-400 text-sm">Loading {name} cards…</p>
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
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{displayName}</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{displayName}</h1>
          {tracked && (
            <button
              onClick={() => setEditOpen(true)}
              className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{displaySubtitle}</p>
        <ProgressBar owned={ownedCount} total={cards.length} />
        {ownedCount >= cards.length && cards.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-sm font-semibold px-3 py-1.5 rounded-full">
            🏆 Master Set Complete!
          </div>
        )}
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
        <CardGrid cards={filteredCards} isOwned={(cid) => isCardOwned(name, cid)} onToggle={(cid) => toggleCard(name, cid)} />
      ) : (
        <div className="py-16 text-center text-gray-400 dark:text-gray-600"><p className="text-lg">No cards to show</p></div>
      )}

      {editOpen && tracked && (
        <CollectionEditSheet
          item={tracked}
          onSave={(updates) => updateItem(name, updates)}
          onDelete={() => { removeItem(name); router.replace("/"); }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
