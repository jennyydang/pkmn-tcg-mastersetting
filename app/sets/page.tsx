"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSet, getCardsForSet } from "@/lib/api";
import { PokemonCard, PokemonSet } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import MasterSetCards from "@/app/components/MasterSetCards";
import MasterSetProgress from "@/app/components/MasterSetProgress";
import CollectionEditSheet from "@/app/components/CollectionEditSheet";
import { ChevronRightIcon } from "@/app/components/Icons";
import Image from "next/image";
import Link from "next/link";

// The ID comes from the query string (?id=…) rather than the path so the
// app can be statically exported and bundled into the iOS app.
export default function SetMasterSetPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <SetMasterSetView />
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

function SetMasterSetView() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [set, setSet] = useState<PokemonSet | null>(null);
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const { toggleCard, hasItem, addItem, updateTotal, removeItem, updateItem, trackedItems } = useStore();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  const tracked = trackedItems.find((t) => t.id === id && t.type === "set");
  const ownedKeys = tracked?.ownedCards ?? EMPTY;
  const displayName = tracked?.label ?? set?.name ?? "";
  const displaySubtitle = tracked?.subtitle ?? (set ? `${set.series} · Released ${set.releaseDate} · ${cards.length} cards` : "");

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

  if (authLoading || !user) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{displayName}</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {set?.images?.logo && (
            <Image src={set.images.logo} alt={set.name} width={200} height={70}
              className="object-contain max-h-16 w-auto" unoptimized />
          )}
          <div className="flex-1 min-w-0">
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
        </div>
      </div>

      <MasterSetCards cards={cards} ownedKeys={ownedKeys} onToggle={(k) => toggleCard(id, k)} quickAdd offlineKey={`set:${id}`} />

      {editOpen && tracked && (
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
