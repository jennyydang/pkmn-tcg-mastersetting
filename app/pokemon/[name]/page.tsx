"use client";

import { use, useEffect, useState } from "react";
import { getCardsForPokemon } from "@/lib/api";
import { PokemonCard, PokemonSet } from "@/lib/types";
import { useStore } from "@/lib/store";
import { ChevronRightIcon } from "@/app/components/Icons";
import Image from "next/image";
import Link from "next/link";

interface Props {
  params: Promise<{ name: string }>;
}

interface SetGroup {
  set: PokemonSet;
  cards: PokemonCard[];
}

export default function PokemonPage({ params }: Props) {
  const { name: encodedName } = use(params);
  const name = decodeURIComponent(encodedName);
  const [groups, setGroups] = useState<SetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addSet, hasSet } = useStore();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const cards = await getCardsForPokemon(name);

        const bySet = new Map<string, SetGroup>();
        for (const card of cards) {
          if (!bySet.has(card.set.id)) {
            bySet.set(card.set.id, { set: card.set, cards: [] });
          }
          bySet.get(card.set.id)!.cards.push(card);
        }

        setGroups(Array.from(bySet.values()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load cards");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [name]);

  const totalCards = groups.reduce((n, g) => n + g.cards.length, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading {name} cards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <p className="text-red-500 font-medium">{error}</p>
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 underline">← Back to home</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Home</Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">{name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{name}</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {totalCards} card{totalCards !== 1 ? "s" : ""} across {groups.length} set{groups.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Set groups */}
      {groups.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No cards found.</p>
      ) : (
        <div className="space-y-10">
          {groups.map(({ set, cards }) => (
            <section key={set.id}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  {set.images?.symbol && (
                    <Image
                      src={set.images.symbol}
                      alt={set.name}
                      width={24}
                      height={24}
                      className="object-contain shrink-0"
                      unoptimized
                    />
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/sets/${set.id}`}
                      className="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate block"
                    >
                      {set.name}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{set.series} · {set.releaseDate}</p>
                  </div>
                </div>
                <button
                  onClick={() => addSet(set)}
                  disabled={hasSet(set.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    hasSet(set.id)
                      ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 cursor-default"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {hasSet(set.id) ? "Tracking" : "+ Track Set"}
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
                {cards.map((card) => (
                  <Link
                    key={card.id}
                    href={`/sets/${set.id}`}
                    title={`${card.name} #${card.number} — ${set.name}`}
                    className="rounded-lg overflow-hidden hover:scale-105 transition-transform shadow-sm hover:shadow-md"
                  >
                    <Image
                      src={card.images.small}
                      alt={`${card.name} #${card.number}`}
                      width={146}
                      height={204}
                      className="w-full h-auto block"
                      unoptimized
                    />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
