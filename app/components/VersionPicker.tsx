"use client";

import { useEffect, useRef, useState } from "react";
import { CardVariant, PokemonCard } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, variantPrice } from "@/lib/variants";
import CardImage from "./CardImage";
import { CheckIcon } from "./Icons";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

/** "Which versions do you have?" for a card printed in more than one (normal, reverse holo, …). Pick one or several. */
export default function VersionPicker({ card, onPick, onCancel }: { card: PokemonCard; onPick: (versions: CardVariant[]) => void; onCancel: () => void }) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const versions = cardVariants(card);
  const [chosen, setChosen] = useState<CardVariant[]>([versions[0]]);
  const toggle = (v: CardVariant) => setChosen((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

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
            <h2 id="version-title" className="font-bold text-gray-900 dark:text-gray-100">Which versions do you have?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{card.name} · {card.set.name} #{card.number}</p>
          </div>
        </div>
        <ul className="px-5 space-y-2">
          {versions.map((v, i) => {
            const price = variantPrice(card, v);
            const on = chosen.includes(v);
            return (
              <li key={v}>
                <button ref={i === 0 ? firstRef : undefined} role="checkbox" aria-checked={on} onClick={() => toggle(v)}
                  className={`w-full flex items-center gap-3 px-4 min-h-[52px] rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${on ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}>
                  <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${on ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 dark:border-gray-600"}`}>
                    {on && <CheckIcon className="w-4 h-4" />}
                  </span>
                  <span className="flex-1 font-semibold text-gray-900 dark:text-gray-100">{VARIANT_LABELS[v].long}</span>
                  {price != null && <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{fmt(price)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-5 pt-4 pb-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 min-h-[48px] rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button onClick={() => onPick(versions.filter((v) => chosen.includes(v)))} disabled={chosen.length === 0}
            className="flex-1 min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold text-white transition-colors">
            {chosen.length > 1 ? `Add ${chosen.length} versions` : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
