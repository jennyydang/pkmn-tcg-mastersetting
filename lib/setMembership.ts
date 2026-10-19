import { matchesWord } from "./api";
import { PokemonCard, TrackedMasterSet } from "./types";
import { parseOwnedKey } from "./variants";

// Which tracked master sets a card can count toward: its own set, the Pokémon
// whose master set includes it (same whole-word name match as lib/api.ts), the
// artist who drew it, and any custom set (they hold whatever you add).

export function setFitsCard(t: TrackedMasterSet, card: PokemonCard): boolean {
  switch (t.type) {
    case "set":     return t.id === card.set.id;
    case "pokemon": return matchesWord(card.name, t.id);
    case "artist":  return matchesWord(card.illustrator, t.id);
    case "custom":  return true;
  }
}

/** Tracked sets where some version of this card is marked owned. */
export function setsHoldingCard(items: TrackedMasterSet[], cardId: string): TrackedMasterSet[] {
  return items.filter((t) => t.ownedCards.some((k) => parseOwnedKey(k).cardId === cardId));
}
