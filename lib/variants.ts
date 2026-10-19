import { CardVariant, PokemonCard, TCGPlayerPrice } from "./types";

// A card can be printed in several versions (normal, reverse holo, ...). Owned
// entries are stored as strings in owned_cards.card_id:
//   "sv03.5-025"          the card's base version (what a plain tap marks; also
//                         what every entry saved before variants existed means)
//   "sv03.5-025|reverse"  any other version
// Encoding the variant in the ID keeps the existing table and constraints.

export const VARIANT_ORDER: CardVariant[] = ["normal", "holo", "reverse", "firstEdition"];

export const VARIANT_LABELS: Record<CardVariant, { short: string; long: string }> = {
  normal:       { short: "N",   long: "Normal" },
  holo:         { short: "H",   long: "Holo" },
  reverse:      { short: "R",   long: "Reverse Holo" },
  firstEdition: { short: "1st", long: "1st Edition" },
};

const SEPARATOR = "|";

/** Versions a card exists in, base first. Cards without data count as one version. */
export function cardVariants(card: PokemonCard): CardVariant[] {
  return card.variants?.length ? card.variants : ["normal"];
}

export function ownedKey(card: PokemonCard, variant: CardVariant): string {
  return variant === cardVariants(card)[0] ? card.id : `${card.id}${SEPARATOR}${variant}`;
}

export function parseOwnedKey(key: string): { cardId: string; variant: CardVariant | null } {
  const i = key.indexOf(SEPARATOR);
  return i < 0 ? { cardId: key, variant: null } : { cardId: key.slice(0, i), variant: key.slice(i + 1) as CardVariant };
}

/** Card IDs with at least one owned version. */
export function ownedCardIds(keys: string[]): Set<string> {
  return new Set(keys.map((k) => parseOwnedKey(k).cardId));
}

// TCGplayer price keys (camelCased in lib/api.ts) for each version, best match first.
const PRICE_KEYS: Record<CardVariant, string[]> = {
  normal:       ["normal", "unlimitedNormal", "unlimited"],
  holo:         ["holofoil", "unlimitedHolofoil"],
  reverse:      ["reverseHolofoil"],
  firstEdition: ["1stEditionHolofoil", "1stEditionNormal", "1stEdition"],
};

/** TCGplayer market price for one version of a card (null = its base version). */
export function variantPrice(card: PokemonCard, variant: CardVariant | null): number | undefined {
  const prices = card.tcgplayer?.prices;
  if (!prices) return undefined;
  const v = variant ?? cardVariants(card)[0];
  for (const key of PRICE_KEYS[v]) {
    const p: TCGPlayerPrice | undefined = prices[key];
    if (p?.market != null) return p.market;
  }
  // A card listed under a single price (e.g. a holo-only card priced as "normal").
  const all = Object.values(prices).filter((p) => p.market != null);
  return all.length === 1 && cardVariants(card).length === 1 ? all[0].market : undefined;
}

/** Owned/total counts by card and by every version, for progress bars. */
export function variantProgress(cards: PokemonCard[], owned: string[]) {
  const ownedSet = new Set(owned);
  let cardsOwned = 0, versionsOwned = 0, versionsTotal = 0;
  for (const card of cards) {
    let any = false;
    for (const v of cardVariants(card)) {
      versionsTotal++;
      if (ownedSet.has(ownedKey(card, v))) { versionsOwned++; any = true; }
    }
    if (any) cardsOwned++;
  }
  return { cardsOwned, cardsTotal: cards.length, versionsOwned, versionsTotal };
}
