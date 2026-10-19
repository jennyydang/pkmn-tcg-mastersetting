"use client";

import { useCallback } from "react";
import { useStore } from "./store";
import { DEFAULT_DETAILS, useCardData } from "./cardData";
import { cardVariants, ownedKey, parseOwnedKey } from "./variants";
import { setFitsCard } from "./setMembership";
import { CardVariant, PokemonCard } from "./types";

/**
 * Add a card to My Collection and check it off in every master set that
 * includes it: its set, the Pokémon's and artist's master sets, and custom sets
 * that list it. With a `variant` that version is checked; without one, sets
 * where some version is already checked are left alone and the others get the
 * card's base version. Returns how many sets were checked.
 */
export function useAddToCollection() {
  const { addCollectionCard, trackedItems, toggleCard } = useStore();

  return useCallback((card: PokemonCard, variant?: CardVariant) => {
    addCollectionCard(card.id);
    let checked = 0;
    for (const t of trackedItems) {
      const fits = t.type === "custom" ? (t.customCards ?? []).some((c) => c.id === card.id) : setFitsCard(t, card);
      if (!fits) continue;
      // Custom sets track cards, not versions.
      const key = t.type === "custom" ? card.id : ownedKey(card, variant ?? cardVariants(card)[0]);
      const alreadyChecked = variant && t.type !== "custom"
        ? t.ownedCards.includes(key)
        : t.ownedCards.some((k) => parseOwnedKey(k).cardId === card.id);
      if (alreadyChecked) continue;
      toggleCard(t.id, key);
      checked++;
    }
    return checked;
  }, [addCollectionCard, trackedItems, toggleCard]);
}

export interface CopiesToAdd {
  card: PokemonCard;
  variant: CardVariant;
  count: number;
}

/**
 * Add scanned copies to your collection: puts each card in My Collection, checks
 * that version off in the master sets that include it, and raises the copy
 * count, so duplicates show up as extras for trading.
 */
export function useAddCopies() {
  const { isInCollection, trackedItems } = useStore();
  const addToCollection = useAddToCollection();
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
    for (const [key, { card, variant, count }] of merged) {
      const ownedBefore = isInCollection(card.id) || trackedItems.some((t) => t.ownedCards.includes(key));
      setsTicked += addToCollection(card, variant);
      // Copies of this version: what was saved, else one if you already had it.
      const existing = details.get(key);
      const quantity = (existing?.quantity ?? (ownedBefore ? 1 : 0)) + count;
      if (available && (existing || quantity !== 1)) {
        saves.push(saveDetails(key, { ...(existing ?? DEFAULT_DETAILS), quantity }));
      }
    }
    await Promise.all(saves);
    return { versions: merged.size, setsTicked };
  }, [addToCollection, isInCollection, trackedItems, available, details, saveDetails]);
}
