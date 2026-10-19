import { normalizeNumber } from "./api";
import { CardVariant, PokemonCard } from "./types";
import { VARIANT_LABELS, cardVariants, ownedKey } from "./variants";

// Turns typed card numbers into owned-entry keys for one set:
//   "25, 57 199"   cards 25, 57 and 199 (base version)
//   "1-10"         a range (up to MAX_RANGE cards)
//   "25r 4h 58f"   a specific version: r = reverse holo, h = holo, f = 1st Edition
//   "TG05, SV001"  prefixed numbers, matched however the set pads them

const SUFFIX: Record<string, CardVariant> = { r: "reverse", h: "holo", f: "firstEdition" };
const MAX_RANGE = 500;

export interface QuickAddResult {
  /** Keys to mark owned, with the card and version for the summary. */
  toAdd: { key: string; card: PokemonCard; variant: CardVariant }[];
  alreadyOwned: number;
  /** Tokens that matched no card, or a version the card doesn't have. */
  problems: string[];
}

export function parseQuickAdd(text: string, cards: PokemonCard[], owned: Set<string>): QuickAddResult {
  const byNumber = new Map(cards.map((c) => [normalizeNumber(c.number), c]));
  const result: QuickAddResult = { toAdd: [], alreadyOwned: 0, problems: [] };
  const seen = new Set<string>();

  const add = (number: string, suffix: string | undefined, token: string) => {
    const card = byNumber.get(normalizeNumber(number));
    if (!card) { result.problems.push(`#${token} isn’t in this set`); return; }
    const versions = cardVariants(card);
    const variant = suffix ? SUFFIX[suffix.toLowerCase()] : versions[0];
    if (!versions.includes(variant)) {
      result.problems.push(`#${number} has no ${VARIANT_LABELS[variant].long} version`);
      return;
    }
    const key = ownedKey(card, variant);
    if (seen.has(key)) return;
    seen.add(key);
    if (owned.has(key)) result.alreadyOwned++;
    else result.toAdd.push({ key, card, variant });
  };

  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d+)\s*-\s*(\d+)([rhf])?$/i.exec(token);
    if (range) {
      const [from, to] = [parseInt(range[1], 10), parseInt(range[2], 10)];
      if (to < from || to - from >= MAX_RANGE) { result.problems.push(`${token} isn’t a valid range`); continue; }
      for (let n = from; n <= to; n++) {
        const card = byNumber.get(String(n));
        if (card) add(String(n), range[3], String(n));
      }
      continue;
    }
    const single = /^([a-z]{0,5}\d+[a-z]?)$/i.exec(token);
    // A trailing r/h/f is a version suffix, unless the whole token is a card number ("24a").
    const m = single && (byNumber.has(normalizeNumber(token)) ? null : /^([a-z]{0,5}\d+)([rhf])$/i.exec(token));
    if (m) add(m[1], m[2], token);
    else if (single) add(token, undefined, token);
    else result.problems.push(`“${token}” isn’t a card number`);
  }
  return result;
}
