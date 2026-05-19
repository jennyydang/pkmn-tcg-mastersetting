"use client";

import { PokemonCard } from "@/lib/types";
import Image from "next/image";
import { useState } from "react";
import CardPriceModal from "./CardPriceModal";

interface CardItemProps {
  card: PokemonCard;
  owned: boolean;
  onToggle: () => void;
  onInfo: () => void;
}

function CardItem({ card, owned, onToggle, onInfo }: CardItemProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        title={`${card.name} #${card.number} — ${owned ? "Owned" : "Not owned"}`}
        className={`relative w-full rounded-lg overflow-hidden transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:scale-105 ${
          owned ? "opacity-100 shadow-md" : "opacity-50 hover:opacity-70"
        }`}
      >
        {!imgError ? (
          <Image
            src={card.images.small}
            alt={`${card.name} #${card.number}`}
            width={146}
            height={204}
            className="w-full h-auto block"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full aspect-[146/204] bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 text-xs p-2 rounded-lg">
            <span className="text-2xl mb-1">🃏</span>
            <span className="font-medium text-center leading-tight">{card.name}</span>
            <span>#{card.number}</span>
          </div>
        )}
        {owned && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onInfo(); }}
        title="View price"
        className="absolute top-1 left-1 w-5 h-5 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
      >
        <span className="text-white text-[10px] font-bold leading-none">i</span>
      </button>
    </div>
  );
}

interface Props {
  cards: PokemonCard[];
  isOwned: (cardId: string) => boolean;
  onToggle: (cardId: string) => void;
}

export default function CardGrid({ cards, isOwned, onToggle }: Props) {
  const [priceCard, setPriceCard] = useState<PokemonCard | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            owned={isOwned(card.id)}
            onToggle={() => onToggle(card.id)}
            onInfo={() => setPriceCard(card)}
          />
        ))}
      </div>
      <CardPriceModal card={priceCard} loading={false} onClose={() => setPriceCard(null)} />
    </>
  );
}
