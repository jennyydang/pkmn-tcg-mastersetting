"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { setFitsCard } from "@/lib/setMembership";
import { CardVariant, PokemonCard, TrackedMasterSet } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, ownedKey } from "@/lib/variants";
import { tapFeedback } from "@/lib/haptics";
import CardImage from "./CardImage";
import { CardsIcon, CheckIcon } from "./Icons";

// Mark a collection card as owned in several master sets at once: its set, the
// Pokémon's master set, the artist's, and any custom sets.

const TYPE_LABELS: Record<TrackedMasterSet["type"], string> = {
  set: "Set",
  pokemon: "Pokémon master set",
  artist: "Artist collection",
  custom: "Custom set",
};

/** Sheet intro after adding a card to the collection. */
export function addedIntro(setsChecked: number) {
  return setsChecked > 0
    ? `Added to your collection and checked off in ${setsChecked} ${setsChecked === 1 ? "set" : "sets"}`
    : "Added to your collection";
}

interface Props {
  card: PokemonCard;
  onClose: () => void;
  /** Shown above the list, e.g. right after adding the card. */
  intro?: string;
  /** The version just added, so its sets are the ones shown ticked. */
  initialVariant?: CardVariant;
}

export default function AddToSetsSheet({ card, onClose, intro, initialVariant }: Props) {
  const { trackedItems, toggleCard, addCustomCard } = useStore();
  const versions = cardVariants(card);
  const [variant, setVariant] = useState(initialVariant && versions.includes(initialVariant) ? initialVariant : versions[0]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  const fitting = trackedItems.filter((t) => setFitsCard(t, card));
  // Custom sets hold cards without versions; the others track each version separately.
  const keyFor = (t: TrackedMasterSet) => (t.type === "custom" ? card.id : ownedKey(card, variant));
  const inSet = (t: TrackedMasterSet) =>
    t.ownedCards.includes(keyFor(t)) && (t.type !== "custom" || (t.customCards ?? []).some((c) => c.id === card.id));

  function toggle(t: TrackedMasterSet) {
    tapFeedback();
    if (t.type === "custom" && !(t.customCards ?? []).some((c) => c.id === card.id)) {
      addCustomCard(t.id, { id: card.id, name: card.name, imageSmall: card.images.small, setName: card.set.name });
    }
    toggleCard(t.id, keyFor(t));
  }

  const count = fitting.filter(inSet).length;

  return (
    <>
      <div className="fade-in fixed inset-0 z-50 bg-black/60" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${card.name} to sets`}
        className={`fixed z-50 bottom-0 inset-x-0 pb-[env(safe-area-inset-bottom)] md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ease-out md:max-h-[85vh] ${
          visible
            ? "translate-y-0 md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-100 md:scale-100"
            : "translate-y-full md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-0 md:scale-95"
        }`}
      >
        <div className="md:hidden mx-auto mt-3 mb-1 w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" aria-hidden="true" />
        <div className="overflow-y-auto max-h-[75vh] md:max-h-none px-5 pb-4">
          <div className="flex items-center gap-4 py-4 border-b border-gray-100 dark:border-gray-800">
            <CardImage src={card.images.small} alt="" width={56} height={78} className="rounded shadow-sm shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 dark:text-gray-100 leading-tight">Add to sets</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate">{card.name} · {card.set.name} #{card.number}</p>
              {intro && <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1 flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" />{intro}</p>}
            </div>
          </div>

          {versions.length > 1 && fitting.some((t) => t.type !== "custom") && (
            <div className="pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Version you have</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Version">
                {versions.map((v) => (
                  <button key={v} role="radio" aria-checked={variant === v} onClick={() => setVariant(v)}
                    className={`px-3 min-h-[36px] rounded-full text-xs font-semibold transition-colors ${variant === v ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"}`}>
                    {VARIANT_LABELS[v].long}
                  </button>
                ))}
              </div>
            </div>
          )}

          {fitting.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">None of the sets you track include this card.</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Track {card.set.name}, a {card.name} master set, or make a custom set from the{" "}
                <Link href="/" className="text-blue-600 dark:text-blue-400 font-medium">home screen</Link>.
              </p>
            </div>
          ) : (
            <ul className="pt-4 space-y-2">
              {fitting.map((t) => {
                const checked = inSet(t);
                return (
                  <li key={t.id}>
                    <button
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(t)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${checked ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}
                    >
                      {t.image ? (
                        <CardImage src={t.image} alt="" width={t.type === "set" ? 48 : 32} height={t.type === "set" ? 20 : 44} className="object-contain rounded shrink-0 w-12 h-11" />
                      ) : (
                        <span className="w-12 h-11 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0"><CardsIcon className="w-5 h-5" /></span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{t.label}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{TYPE_LABELS[t.type]}</span>
                      </span>
                      <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 dark:border-gray-600"}`}>
                        {checked && <CheckIcon className="w-4 h-4 pop-in" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button onClick={close} className="w-full min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
            {count > 0 ? `Done · in ${count} ${count === 1 ? "set" : "sets"}` : "Done"}
          </button>
        </div>
      </div>
    </>
  );
}
