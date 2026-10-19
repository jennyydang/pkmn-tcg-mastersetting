"use client";

import { useCallback } from "react";
import { useStore } from "./store";
import { DEFAULT_DETAILS, useCardData } from "./cardData";
import { ownedKey } from "./variants";
import { CardVariant, PokemonCard } from "./types";

export interface CopiesToAdd {
  card: PokemonCard;
  variant: CardVariant;
  count: number;
}

/**
 * Add scanned copies to your collection: puts each card in My Collection, ticks
 * that version off in its tracked set (if you track the set), and raises the
 * copy count, so duplicates show up as extras for trading.
 */
export function useAddCopies() {
  const { addCollectionCard, isInCollection, trackedItems, toggleCard, isCardOwned } = useStore();
  const { available, details, saveDetails } = useCardData();

  return useCallback(async (items: CopiesToAdd[]) => {
    // One entry per version, in case the same card was listed twice.
    const merged = new Map<string, CopiesToAdd>();
    for (const item of items) {
      const key = ownedKey(item.card, item.variant);
      const prev = merged.get(key);
      merged.set(key, prev ? { ...prev, count: prev.count + item.count } : item);
    }

    let setsTicked = 0;
    const saves: Promise<boolean>[] = [];
    for (const [key, { card, count }] of merged) {
      const set = trackedItems.find((t) => t.type === "set" && t.id === card.set.id);
      const ownedBefore = isInCollection(card.id) || trackedItems.some((t) => t.ownedCards.includes(key));
      addCollectionCard(card.id);
      if (set && !isCardOwned(set.id, key)) {
        toggleCard(set.id, key);
        setsTicked++;
      }
      // Copies of this version: what was saved, else one if you already had it.
      const existing = details.get(key);
      const quantity = (existing?.quantity ?? (ownedBefore ? 1 : 0)) + count;
      if (available && (existing || quantity !== 1)) {
        saves.push(saveDetails(key, { ...(existing ?? DEFAULT_DETAILS), quantity }));
      }
    }
    await Promise.all(saves);
    return { versions: merged.size, setsTicked };
  }, [addCollectionCard, isInCollection, trackedItems, toggleCard, isCardOwned, available, details, saveDetails]);
}
