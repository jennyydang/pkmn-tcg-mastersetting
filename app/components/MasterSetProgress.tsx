"use client";

import { PokemonCard } from "@/lib/types";
import { useIncludeVariants } from "@/lib/prefs";
import { variantProgress } from "@/lib/variants";
import ProgressBar from "./ProgressBar";
import { TrophyIcon } from "./Icons";
import Confetti from "./Confetti";
import { useEffect, useRef, useState } from "react";
import { successFeedback } from "@/lib/haptics";

interface Props {
  cards: PokemonCard[];
  ownedKeys: string[];
  completeLabel: string;
}

// Progress for a set, Pokémon or artist page. With variants on, it also tracks
// every printed version (reverse holo, 1st Edition, ...) of each card.
export default function MasterSetProgress({ cards, ownedKeys, completeLabel }: Props) {
  const [includeVariants, setIncludeVariants] = useIncludeVariants();
  const p = variantProgress(cards, ownedKeys);
  const hasVariants = p.versionsTotal > p.cardsTotal;
  const complete = includeVariants ? p.versionsOwned >= p.versionsTotal : p.cardsOwned >= p.cardsTotal;

  // Celebrate the moment a set becomes complete, not every visit to a finished set.
  const [celebrate, setCelebrate] = useState(false);
  const wasComplete = useRef<boolean | null>(null);
  useEffect(() => {
    if (cards.length === 0) return;
    if (wasComplete.current === false && complete) {
      setCelebrate(true);
      successFeedback();
    }
    wasComplete.current = complete;
  }, [complete, cards.length]);

  return (
    <div className="space-y-2">
      {includeVariants && hasVariants ? (
        <>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Every version</p>
            <ProgressBar owned={p.versionsOwned} total={p.versionsTotal} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">One of each card</p>
            <ProgressBar owned={p.cardsOwned} total={p.cardsTotal} />
          </div>
        </>
      ) : (
        <ProgressBar owned={p.cardsOwned} total={p.cardsTotal} />
      )}

      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}

      {complete && cards.length > 0 && (
        <div className="pop-in inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-sm font-semibold px-3 py-1.5 rounded-full">
          <TrophyIcon className="w-4 h-4" /> {completeLabel}
        </div>
      )}

      {hasVariants && (
        <label className="flex items-center gap-2 pt-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none w-fit min-h-[44px]">
          <input
            type="checkbox"
            checked={includeVariants}
            onChange={(e) => setIncludeVariants(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          Track variants (reverse holo, 1st Edition…)
        </label>
      )}
    </div>
  );
}
