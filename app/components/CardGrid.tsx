"use client";

import { PokemonCard } from "@/lib/types";
import { useStore } from "@/lib/store";
import Image from "next/image";
import { useState } from "react";

interface CardItemProps {
  card: PokemonCard;
  setId: string;
}

function CardItem({ card, setId }: CardItemProps) {
  const { isCardOwned, toggleCard } = useStore();
  const owned = isCardOwned(setId, card.id);
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={() => toggleCard(setId, card.id)}
      title={`${card.name} #${card.number}${owned ? " — Owned" : " — Not owned"}`}
      className={`relative rounded-lg overflow-hidden transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:scale-105 ${
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
  );
}

interface Props {
  cards: PokemonCard[];
  setId: string;
}

export default function CardGrid({ cards, setId }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
      {cards.map((card) => (
        <CardItem key={card.id} card={card} setId={setId} />
      ))}
    </div>
  );
}
