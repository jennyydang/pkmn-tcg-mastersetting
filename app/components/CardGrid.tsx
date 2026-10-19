"use client";

import { getCard } from "@/lib/api";
import { CardVariant, PokemonCard } from "@/lib/types";
import { VARIANT_LABELS } from "@/lib/variants";
import Image from "next/image";
import { useState } from "react";
import CardPriceModal from "./CardPriceModal";
import { staggerStyle, tiltHandlers } from "@/lib/motion";
import { tapFeedback } from "@/lib/haptics";
import { CardsIcon } from "./Icons";

/** One tappable card in the grid: a card, or one printed version of it. */
export interface CardTile {
  card: PokemonCard;
  /** Owned-entry key this tile toggles (see lib/variants.ts). */
  key: string;
  /** Version shown as a label; null when the tile stands for the card as a whole. */
  variant: CardVariant | null;
  owned: boolean;
}

interface CardItemProps {
  tile: CardTile;
  index: number;
  onToggle: () => void;
  onInfo: () => void;
}

function CardItem({ tile, index, onToggle, onInfo }: CardItemProps) {
  const { card, variant, owned } = tile;
  const [imgError, setImgError] = useState(false);
  // Pulse only when the user marks the card, not for cards already owned on load.
  const [pulse, setPulse] = useState(false);
  const label = variant ? ` ${VARIANT_LABELS[variant].long}` : "";

  function handleToggle() {
    tapFeedback();
    setPulse(!owned);
    onToggle();
  }

  return (
    <div className="relative stagger-in" style={staggerStyle(index)}>
      <button
        onClick={handleToggle}
        {...tiltHandlers}
        onAnimationEnd={(e) => { if (e.animationName === "owned-pulse") setPulse(false); }}
        aria-label={`${card.name}${label} #${card.number} — ${owned ? "Owned, click to unmark" : "Not owned, click to mark as owned"}`}
        aria-pressed={owned}
        className={`tile relative w-full rounded-lg overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
          owned ? "opacity-100 shadow-md" : "opacity-50 hover:opacity-70"
        } ${pulse ? "owned-pulse" : ""}`}
      >
        {!imgError ? (
          <Image
            src={card.images.small}
            alt={`${card.name}${label}`}
            width={146}
            height={204}
            className="w-full h-auto block"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full aspect-[146/204] bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center text-gray-600 dark:text-gray-400 text-xs p-2 rounded-lg">
            <CardsIcon className="w-7 h-7 mb-1" />
            <span className="font-medium text-center leading-tight">{card.name}</span>
            <span>#{card.number}</span>
          </div>
        )}
        {/* Versions share one scan, so label which version this tile is. */}
        {variant && (
          <span className={`absolute bottom-1 inset-x-1 rounded-md px-1 py-0.5 text-center text-[10px] font-bold leading-tight text-white shadow ${
            variant === "reverse" || variant === "holo"
              ? "bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-500"
              : variant === "firstEdition" ? "bg-gray-900/80" : "bg-black/60"
          }`}>
            {VARIANT_LABELS[variant].long}
          </span>
        )}
        {owned && (
          <div className={`absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow ${pulse ? "pop-in" : ""}`} aria-hidden="true">
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
    </div>
  );
}

interface Props {
  tiles: CardTile[];
  onToggle: (key: string) => void;
}

export default function CardGrid({ tiles, onToggle }: Props) {
  const [priceOpen, setPriceOpen]       = useState(false);
  const [priceCard, setPriceCard]       = useState<PokemonCard | null>(null);
  const [priceTile, setPriceTile]       = useState<CardTile | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Card lists don't include prices; fetch the full card when its price is opened.
  async function openPrice(tile: CardTile) {
    const card = tile.card;
    setPriceTile(tile);
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
        {tiles.map((tile, i) => (
          <CardItem
            key={tile.key}
            tile={tile}
            index={i}
            onToggle={() => onToggle(tile.key)}
            onInfo={() => openPrice(tile)}
          />
        ))}
      </div>
      {priceOpen && (
        <CardPriceModal
          card={priceCard}
          loading={priceLoading}
          cardKey={priceTile?.key}
          owned={priceTile?.owned}
          onClose={() => { setPriceOpen(false); setPriceCard(null); }}
        />
      )}
    </>
  );
}
