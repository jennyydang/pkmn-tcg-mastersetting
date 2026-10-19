"use client";

import { useEffect, useRef } from "react";
import { CardVariant, PokemonCard } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, variantPrice } from "@/lib/variants";
import CardImage from "./CardImage";
import { ChevronRightIcon } from "./Icons";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

/** "Which version do you have?" for a card printed in more than one (normal, reverse holo, …). */
export default function VersionPicker({ card, onPick, onCancel }: { card: PokemonCard; onPick: (v: CardVariant) => void; onCancel: () => void }) {
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="version-title"
        className="dialog-in w-full md:max-w-sm bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-4 px-5 pt-5 pb-3">
          <CardImage src={card.images.small} alt="" width={48} height={67} className="rounded shadow-sm shrink-0" />
          <div className="min-w-0">
            <h2 id="version-title" className="font-bold text-gray-900 dark:text-gray-100">Which version do you have?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{card.name} · {card.set.name} #{card.number}</p>
          </div>
        </div>
        <ul className="px-5 space-y-2">
          {cardVariants(card).map((v, i) => {
            const price = variantPrice(card, v);
            return (
              <li key={v}>
                <button ref={i === 0 ? firstRef : undefined} onClick={() => onPick(v)}
                  className="w-full flex items-center justify-between gap-3 px-4 min-h-[52px] rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{VARIANT_LABELS[v].long}</span>
                  <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                    {price != null && fmt(price)}
                    <ChevronRightIcon className="w-4 h-4" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-5 pt-3 pb-5">
          <button onClick={onCancel} className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
