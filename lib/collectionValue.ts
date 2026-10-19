"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { CopyDetails, useCardData } from "./cardData";
import { getCardsByIds } from "./api";
import { conditionPrice } from "./conditions";
import { PokemonCard, TrackedMasterSet } from "./types";
import { ownedCardIds, parseOwnedKey, variantPrice } from "./variants";

// What your collection is worth, shared by the Collection and Portfolio pages
// so they always show the same total.

/**
 * Everything you own, as owned keys ("<card id>" or "<card id>|<variant>"):
 * versions checked off in master sets, versions with copy details, and My
 * Collection cards with no version recorded (as their base version).
 */
export function ownedKeys(trackedItems: TrackedMasterSet[], collectionCardIds: string[], details: Map<string, CopyDetails>): Set<string> {
  const keys = new Set<string>();
  for (const item of trackedItems) for (const key of item.ownedCards) keys.add(key);
  for (const key of details.keys()) keys.add(key);
  const recorded = ownedCardIds([...keys]);
  for (const id of collectionCardIds) if (!recorded.has(id)) keys.add(id);
  return keys;
}

/**
 * One copy's value: the market price adjusted for the condition you set
 * (lib/conditions.ts). Graded copies, and copies without a condition, use the
 * market price.
 */
export function copyValue(market: number, d: CopyDetails | undefined) {
  return d?.condition && !d.gradeCompany ? conditionPrice(market, d.condition) : market;
}

export interface Valuation {
  keys: Set<string>;
  cardById: Map<string, PokemonCard>;
  /** Market (Near Mint) price of one copy, by owned key; missing = no price. */
  marketPrice: Map<string, number>;
  /** Total for your copies' conditions. */
  total: number;
  /** The same copies at Near Mint market price. */
  marketTotal: number;
  /** Priced copies counted. */
  count: number;
  quantity: (key: string) => number;
  /** Value of one copy for its condition, if priced. */
  unitValue: (key: string) => number | undefined;
}

// Full cards (with prices) already fetched this session, shared across pages.
const cardCache = new Map<string, PokemonCard>();

export function useCollectionValue(): { loading: boolean; valuation: Valuation | null } {
  const { trackedItems, collectionCardIds } = useStore();
  const { details } = useCardData();
  const keys = useMemo(() => ownedKeys(trackedItems, collectionCardIds, details), [trackedItems, collectionCardIds, details]);
  const idsKey = useMemo(() => [...ownedCardIds([...keys])].sort().join("\n"), [keys]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    const ids = idsKey ? idsKey.split("\n") : [];
    const missing = ids.filter((id) => !cardCache.has(id));
    let cancelled = false;
    (missing.length ? getCardsByIds(missing) : Promise.resolve([]))
      .then((cards) => { for (const c of cards) cardCache.set(c.id, c); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadedKey(idsKey); });
    return () => { cancelled = true; };
  }, [idsKey]);

  const valuation = useMemo<Valuation | null>(() => {
    if (loadedKey !== idsKey) return null;
    const cardById = new Map<string, PokemonCard>();
    const marketPrice = new Map<string, number>();
    for (const key of keys) {
      const { cardId, variant } = parseOwnedKey(key);
      const card = cardCache.get(cardId);
      if (!card) continue;
      cardById.set(cardId, card);
      const market = variantPrice(card, variant);
      if (market != null) marketPrice.set(key, market);
    }
    // Each owned version counts once (even if it's in several master sets),
    // times the copies recorded for it.
    const quantity = (key: string) => details.get(key)?.quantity ?? 1;
    const unitValue = (key: string) => { const m = marketPrice.get(key); return m == null ? undefined : copyValue(m, details.get(key)); };
    let total = 0, marketTotal = 0, count = 0;
    for (const [key, price] of marketPrice) {
      total += unitValue(key)! * quantity(key);
      marketTotal += price * quantity(key);
      count += quantity(key);
    }
    return { keys, cardById, marketPrice, total, marketTotal, count, quantity, unitValue };
  }, [loadedKey, idsKey, keys, details]);

  return { loading: valuation === null, valuation };
}
