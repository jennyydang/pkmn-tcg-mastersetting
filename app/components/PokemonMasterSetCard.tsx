"use client";

import Link from "next/link";
import Image from "next/image";
import { TrackedPokemon } from "@/lib/types";
import { useStore } from "@/lib/store";
import { XIcon } from "./Icons";

interface Props {
  tracked: TrackedPokemon;
}

export default function PokemonMasterSetCard({ tracked }: Props) {
  const { removePokemon } = useStore();
  const { name, image, totalCards, ownedCards } = tracked;
  const owned = ownedCards.length;
  const pct = totalCards > 0 ? Math.round((owned / totalCards) * 100) : 0;
  const complete = totalCards > 0 && owned >= totalCards;

  return (
    <div className="relative group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <button
        onClick={(e) => { e.preventDefault(); removePokemon(name); }}
        aria-label="Remove master set"
        className="absolute top-2 right-2 z-10 p-1 rounded-full bg-gray-100 dark:bg-gray-700 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 transition-all"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>

      <Link href={`/pokemon/${encodeURIComponent(name)}`} className="block p-5">
        <div className="flex items-center gap-4 mb-4">
          <Image
            src={image}
            alt={name}
            width={56}
            height={78}
            className="object-contain rounded shrink-0"
            unoptimized
          />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">{name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Master Set</p>
          </div>
        </div>

        {totalCards > 0 ? (
          <>
            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1.5">
              <span>{owned} / {totalCards} cards</span>
              <span className={complete ? "text-green-600 dark:text-green-400 font-semibold" : ""}>{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${complete ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {complete && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-semibold text-center">
                Master Set Complete! 🏆
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {owned > 0 ? `${owned} cards owned` : "Click to view cards"}
          </p>
        )}
      </Link>
    </div>
  );
}
