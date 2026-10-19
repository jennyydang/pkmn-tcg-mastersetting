"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getCardsByIds } from "@/lib/api";
import { masterSetHref } from "@/lib/links";
import { staggerStyle, tiltHandlers } from "@/lib/motion";
import { PokemonCard, TrackedMasterSet } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, ownedCardIds, parseOwnedKey } from "@/lib/variants";
import CardPriceModal from "./CardPriceModal";
import { CardsIcon, ChevronRightIcon } from "./Icons";

// The Collection page's view of master sets: each set with cards marked owned,
// expandable to show those cards. Cards load when a set is opened.
export default function CollectionMasterSets({ items }: { items: TrackedMasterSet[] }) {
  const withCards = items.filter((t) => t.ownedCards.length > 0);
  if (withCards.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">From your master sets</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Cards you’ve marked as owned in your master sets.</p>
      <div className="space-y-3">
        {withCards.map((item, i) => <MasterSetSection key={item.id} item={item} index={i} />)}
      </div>
    </section>
  );
}

function MasterSetSection({ item, index }: { item: TrackedMasterSet; index: number }) {
  const [open, setOpen]       = useState(false);
  const [opened, setOpened]   = useState(false);
  const [cards, setCards]     = useState<Map<string, PokemonCard> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [price, setPrice]     = useState<{ card: PokemonCard; key: string } | null>(null);

  const cardCount = ownedCardIds(item.ownedCards).size;
  const versionCount = item.ownedCards.length;

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const fetched = await getCardsByIds([...ownedCardIds(item.ownedCards)]);
      setCards(new Map(fetched.map((c) => [c.id, c])));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setOpened(true);
    if (next && !cards) load();
  }

  // One tile per owned entry, in set order; a version label when the card has several.
  const tiles = cards
    ? item.ownedCards
        .map((key) => {
          const { cardId, variant } = parseOwnedKey(key);
          const card = cards.get(cardId);
          if (!card) return null;
          const versions = cardVariants(card);
          const label = versions.length > 1 ? VARIANT_LABELS[variant ?? versions[0]].long : null;
          return { key, card, label };
        })
        .filter((t): t is { key: string; card: PokemonCard; label: string | null } => t !== null)
        .sort((a, b) =>
          a.card.set.releaseDate.localeCompare(b.card.set.releaseDate) ||
          a.card.number.localeCompare(b.card.number, undefined, { numeric: true }))
    : [];

  return (
    <div style={staggerStyle(index)} className="stagger-in bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <button onClick={toggle} aria-expanded={open} className="flex flex-1 min-w-0 items-center gap-3 text-left min-h-[44px]">
          {item.image ? (
            <Image src={item.image} alt="" width={item.type === "set" ? 64 : 40} height={item.type === "set" ? 26 : 56}
              className="object-contain shrink-0 rounded" unoptimized />
          ) : (
            <span className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 text-gray-400">
              <CardsIcon className="w-6 h-6" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-gray-900 dark:text-gray-100 truncate">{item.label}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {cardCount} {cardCount === 1 ? "card" : "cards"} owned
              {versionCount > cardCount && ` (${versionCount} versions)`}
              {item.totalCards > 0 && ` of ${item.totalCards}`}
            </span>
          </span>
          <ChevronRightIcon className={`w-5 h-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        <Link href={masterSetHref(item)} className="shrink-0 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline px-2 py-2">
          Open
        </Link>
      </div>

      {/* Kept mounted after the first open so closing animates too; inert while closed. */}
      <div className="expand-panel" data-open={open}>
        <div inert={!open}>
          {opened && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-4">
              {loading && !cards && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                  {Array.from({ length: Math.min(versionCount, 8) }).map((_, i) => (
                    <div key={i} className="aspect-[146/204] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" aria-hidden="true" />
                  ))}
                </div>
              )}
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400">
                  Couldn’t load these cards. <button onClick={load} className="font-medium underline">Retry</button>
                </p>
              )}
              {cards && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                  {tiles.map(({ key, card, label }, i) => (
                    <div key={key} style={staggerStyle(i)} className="stagger-in relative">
                      <button
                        onClick={() => setPrice({ card, key })}
                        aria-label={`${card.name}${label ? ` ${label}` : ""} #${card.number}: view price and your copies`}
                        {...tiltHandlers}
                    className="tile relative block w-full rounded-lg overflow-hidden shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <Image src={card.images.small} alt={card.name} width={146} height={204} className="w-full h-auto block" unoptimized />
                        {label && (
                          <span className="absolute bottom-1 inset-x-1 rounded-md px-1 py-0.5 text-center text-[10px] font-bold leading-tight text-white bg-black/60">
                            {label}
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {price && (
        <CardPriceModal card={price.card} loading={false} cardKey={price.key} owned onClose={() => setPrice(null)} />
      )}
    </div>
  );
}
