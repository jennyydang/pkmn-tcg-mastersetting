"use client";

import { getCard } from "@/lib/api";
import { PokemonCard } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, ownedKey } from "@/lib/variants";
import Image from "next/image";
import { useState } from "react";
import CardPriceModal from "./CardPriceModal";

interface CardItemProps {
  card: PokemonCard;
  ownedKeys: Set<string>;
  showVariants: boolean;
  onToggle: (key: string) => void;
  onInfo: () => void;
}

function CardItem({ card, ownedKeys, showVariants, onToggle, onInfo }: CardItemProps) {
  const [imgError, setImgError] = useState(false);
  const variants = cardVariants(card);
  const keys = variants.map((v) => ownedKey(card, v));
  // Tapping the card marks its base version; the chips below mark each version.
  const baseOwned = ownedKeys.has(keys[0]);
  // Any owned version counts as owning the card; the check means nothing's left to get.
  const owned = keys.some((k) => ownedKeys.has(k));
  const complete = showVariants ? keys.every((k) => ownedKeys.has(k)) : owned;

  return (
    <div className="relative">
      <button
        onClick={() => onToggle(keys[0])}
        aria-label={`${card.name} #${card.number} — ${baseOwned ? "Owned, click to unmark" : "Not owned, click to mark as owned"}`}
        aria-pressed={baseOwned}
        className={`relative w-full rounded-lg overflow-hidden transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:scale-105 ${
          owned ? "opacity-100 shadow-md" : "opacity-50 hover:opacity-70"
        }`}
      >
        {!imgError ? (
          <Image
            src={card.images.small}
            alt={card.name}
            width={146}
            height={204}
            className="w-full h-auto block"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full aspect-[146/204] bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center text-gray-600 dark:text-gray-400 text-xs p-2 rounded-lg">
            <span className="text-2xl mb-1" aria-hidden="true">🃏</span>
            <span className="font-medium text-center leading-tight">{card.name}</span>
            <span>#{card.number}</span>
          </div>
        )}
        {complete && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow" aria-hidden="true">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onInfo(); }}
        aria-label={`View price for ${card.name}`}
        className="absolute top-0 left-0 w-11 h-11 flex items-center justify-center transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span className="w-5 h-5 bg-black/50 group-hover:bg-black/70 rounded-full flex items-center justify-center" aria-hidden="true">
          <span className="text-white text-[10px] font-bold leading-none">i</span>
        </span>
      </button>
      {showVariants && variants.length > 1 && (
        <div className="flex gap-1 mt-1" role="group" aria-label={`${card.name} versions`}>
          {variants.map((v, i) => {
            const has = ownedKeys.has(keys[i]);
            return (
              <button
                key={v}
                onClick={() => onToggle(keys[i])}
                aria-pressed={has}
                aria-label={`${card.name} ${VARIANT_LABELS[v].long}: ${has ? "owned" : "not owned"}`}
                title={VARIANT_LABELS[v].long}
                className={`flex-1 min-h-[28px] rounded-md text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  has
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {VARIANT_LABELS[v].short}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  cards: PokemonCard[];
  /** Owned entries (see lib/variants.ts for the key format). */
  ownedKeys: Set<string>;
  /** Show a chip per printed version so each can be marked separately. */
  showVariants: boolean;
  onToggle: (key: string) => void;
}

export default function CardGrid({ cards, ownedKeys, showVariants, onToggle }: Props) {
  const [priceOpen, setPriceOpen]       = useState(false);
  const [priceCard, setPriceCard]       = useState<PokemonCard | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Card lists don't include prices; fetch the full card when its price is opened.
  async function openPrice(card: PokemonCard) {
    setPriceCard(card);
    setPriceOpen(true);
    setPriceLoading(true);
    try {
      setPriceCard(await getCard(card.id));
    } catch {
      // Keep the list version; the modal shows that no price is available.
    } finally {
      setPriceLoading(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            ownedKeys={ownedKeys}
            showVariants={showVariants}
            onToggle={onToggle}
            onInfo={() => openPrice(card)}
          />
        ))}
      </div>
      {priceOpen && (
        <CardPriceModal
          card={priceCard}
          loading={priceLoading}
          onClose={() => { setPriceOpen(false); setPriceCard(null); }}
        />
      )}
    </>
  );
}
