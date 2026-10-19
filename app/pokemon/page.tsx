"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCardsForPokemon, thumbnail } from "@/lib/api";
import { PokemonCard } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import MasterSetCards from "@/app/components/MasterSetCards";
import MasterSetProgress from "@/app/components/MasterSetProgress";
import CollectionEditSheet from "@/app/components/CollectionEditSheet";
import { ChevronRightIcon } from "@/app/components/Icons";
import Link from "next/link";

// The ID comes from the query string (?name=…) rather than the path so the
// app can be statically exported and bundled into the iOS app.
export default function PokemonMasterSetPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <PokemonMasterSetView />
    </Suspense>
  );
}

const EMPTY: string[] = [];

function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PokemonMasterSetView() {
  const name = useSearchParams().get("name") ?? "";
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { toggleCard, hasItem, addItem, updateTotal, removeItem, updateItem, trackedItems } = useStore();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  const tracked = trackedItems.find((t) => t.id === name && t.type === "pokemon");
  const ownedKeys = tracked?.ownedCards ?? EMPTY;
  const displayName = tracked?.label ?? `${name} Master Set`;
  const displaySubtitle = tracked?.subtitle ?? `All ${name} cards across every set`;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const fetched = await getCardsForPokemon(name);
        setCards(fetched);
        if (!hasItem(name) && fetched.length > 0) {
          addItem({ type: "pokemon", id: name, label: name, image: thumbnail(fetched), totalCards: fetched.length, ownedCards: [], subtitle: "All cards across every set" });
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
              aria-label="Edit collection options"
              className="shrink-0 p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{displaySubtitle}</p>
        <MasterSetProgress cards={cards} ownedKeys={ownedKeys} completeLabel="Master Set Complete!" />
      </div>

      <MasterSetCards cards={cards} ownedKeys={ownedKeys} onToggle={(k) => toggleCard(name, k)} showSetNames offlineKey={`pokemon:${name}`} />

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
