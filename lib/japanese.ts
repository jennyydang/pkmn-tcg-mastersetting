import { restFetch } from "./tcgdex";
import { eurToUsdRate } from "./exchange";
import { CardVariant, PokemonCard, PokemonSet, TCGPlayerPrice } from "./types";
import DEX_NAMES from "./dexNames.json";

// Japanese cards, from TCGdex's Japanese catalog. They're stored like English
// cards but with a "ja:" prefix ("ja:SV2a-025", set "ja:SV2a") so the two
// catalogs can't collide. Japanese sets are their own releases with their own
// numbering, so they're tracked as separate master sets.
//
// TCGdex's GraphQL API is English-only, so everything here uses REST. Prices
// come from Cardmarket (euros), converted to dollars at the day's rate and put
// in the same shape as TCGplayer prices so totals work everywhere. Names are
// shown in English where the card's Pokédex number gives one (lib/dexNames.json,
// built from TCGdex's English cards); trainers and energy keep their Japanese name.

export const JA_PREFIX = "ja:";
export const isJapaneseId = (id: string) => id.startsWith(JA_PREFIX);
const unprefix = (id: string) => id.slice(JA_PREFIX.length);

const PLACEHOLDER_IMAGE = "/card-placeholder.svg";

interface RawJaSetBrief {
  id: string;
  name: string;
  cardCount: { official: number; total: number };
}

interface RawJaCardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

interface RawJaSet extends RawJaSetBrief {
  releaseDate?: string;
  serie?: { id: string; name: string };
  logo?: string;
  symbol?: string;
  cards: RawJaCardBrief[];
}

export type CardmarketPrices = Record<string, number | string | null | undefined>;

interface RawJaCard extends RawJaCardBrief {
  rarity?: string;
  illustrator?: string;
  category?: string;
  dexId?: number[];
  set: { id: string };
  variants?: Partial<Record<CardVariant | "wPromo", boolean>>;
  pricing?: { cardmarket?: CardmarketPrices | null } | null;
}

// ── Sets ─────────────────────────────────────────────────────────────────

function toSet(s: RawJaSetBrief & Partial<RawJaSet>): PokemonSet {
  return {
    id:           JA_PREFIX + s.id,
    // Collectors know Japanese sets by code ("SV2a"), so lead with it.
    name:         `${s.id} · ${s.name}`,
    series:       "Japanese",
    printedTotal: s.cardCount.official,
    total:        s.cardCount.total,
    releaseDate:  s.releaseDate ?? "",
    images:       { logo: s.logo ? `${s.logo}.png` : "", symbol: s.symbol ? `${s.symbol}.png` : "" },
    language:     "ja",
  };
}

let catalogPromise: Promise<Map<string, PokemonSet>> | null = null;

/** Every Japanese set, keyed by prefixed ID ("ja:SV2a"). */
export function getJaSetCatalog(): Promise<Map<string, PokemonSet>> {
  if (!catalogPromise) {
    catalogPromise = restFetch<RawJaSetBrief[]>("/sets", "ja").then(
      (sets) => new Map(sets.map((s) => [JA_PREFIX + s.id, toSet(s)]))
    );
    catalogPromise.catch(() => { catalogPromise = null; });
  }
  return catalogPromise;
}

const setDetails = (code: string) => restFetch<RawJaSet>(`/sets/${encodeURIComponent(code)}`, "ja");

export async function getJaSet(id: string): Promise<PokemonSet> {
  return toSet(await setDetails(unprefix(id)));
}

// ── Names ────────────────────────────────────────────────────────────────

const dexNames = DEX_NAMES as Record<string, string>;
const englishToDex = new Map(Object.entries(dexNames).map(([dex, name]) => [name.toLowerCase(), Number(dex)]));

/** Pokédex number for an English Pokémon name ("pikachu" → 25), if it is one. */
export function dexNumberFor(name: string): number | undefined {
  return englishToDex.get(name.trim().toLowerCase());
}

// Mechanics printed in Latin letters after the Japanese name ("ピカチュウex").
const SUFFIX = /\s*(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.X|LEGEND|δ|☆|◇|prism)$/;

/** "ピカチュウex" with Pokédex [25] → "Pikachu ex"; tag teams join names with "&". */
function englishName(jaName: string, dexIds: number[] | undefined): string | undefined {
  const names = (dexIds ?? []).map((d) => dexNames[String(d)]).filter(Boolean);
  if (names.length === 0) return undefined;
  const suffix = SUFFIX.exec(jaName)?.[1];
  const mega = /^M(?=[^\x00-\x7F])/.test(jaName) ? "M " : ""; // "Mリザードン" = Mega Charizard
  return `${mega}${names.join(" & ")}${suffix ? ` ${suffix}` : ""}`;
}

// ── Prices ───────────────────────────────────────────────────────────────

// TCGplayer-style price keys for a card's base version (see lib/variants.ts).
const BASE_PRICE_KEY: Record<CardVariant, string> = {
  normal: "normal",
  holo: "holofoil",
  reverse: "reverseHolofoil",
  firstEdition: "1stEditionHolofoil",
};

function num(v: unknown): number | undefined {
  return typeof v === "number" && v > 0 ? v : undefined;
}

/**
 * Cardmarket gives one price set for the card and one ("-holo") for its foil
 * version, which on cards that also come non-foil is the reverse holo. Uses the
 * price trend, falling back to the 30-day average.
 */
export function cardmarketPrices(cm: CardmarketPrices | null | undefined, variants: CardVariant[], rate: number) {
  if (!cm) return undefined;
  const usd = (n: number | undefined) => (n == null ? undefined : Math.round(n * rate * 100) / 100);
  const pick = (suffix: string): TCGPlayerPrice | undefined => {
    const market = usd(num(cm[`trend${suffix}`]) ?? num(cm[`avg30${suffix}`]) ?? num(cm[`avg${suffix}`]));
    return market == null ? undefined : { market, low: usd(num(cm[`low${suffix}`])), mid: usd(num(cm[`avg${suffix}`])) };
  };
  const prices: Record<string, TCGPlayerPrice> = {};
  const base = pick("");
  if (base) prices[BASE_PRICE_KEY[variants[0] ?? "normal"]] = base;
  const foil = pick("-holo");
  if (foil && variants.includes("reverse") && variants[0] !== "reverse") prices.reverseHolofoil = foil;
  return Object.keys(prices).length ? { prices, updatedAt: typeof cm.updated === "string" ? cm.updated : undefined } : undefined;
}

// ── Cards ────────────────────────────────────────────────────────────────

const VARIANT_ORDER: CardVariant[] = ["normal", "holo", "reverse", "firstEdition"];
const image = (raw: { image?: string }, quality: "low" | "high") => (raw.image ? `${raw.image}/${quality}.webp` : PLACEHOLDER_IMAGE);

/** A card from a set or search listing: no prices or versions yet. */
function briefToCard(raw: RawJaCardBrief, set: PokemonSet, name?: string): PokemonCard {
  return {
    id: JA_PREFIX + raw.id,
    name: name ?? raw.name,
    localName: name ? raw.name : undefined,
    number: raw.localId,
    images: { small: image(raw, "low"), large: image(raw, "high") },
    set,
  };
}

export async function getJaCard(id: string): Promise<PokemonCard> {
  const [raw, rate] = await Promise.all([
    restFetch<RawJaCard>(`/cards/${encodeURIComponent(unprefix(id))}`, "ja"),
    eurToUsdRate(),
  ]);
  const set = (await getJaSetCatalog()).get(JA_PREFIX + raw.set.id) ?? toSet({ id: raw.set.id, name: raw.set.id, cardCount: { official: 0, total: 0 } });
  const variants = raw.variants ? VARIANT_ORDER.filter((v) => raw.variants![v]) : undefined;
  const english = raw.category === "Pokemon" ? englishName(raw.name, raw.dexId) : undefined;
  const prices = cardmarketPrices(raw.pricing?.cardmarket, variants ?? ["normal"], rate);
  return {
    ...briefToCard(raw, set, english),
    rarity: raw.rarity && raw.rarity !== "None" ? raw.rarity : undefined,
    illustrator: raw.illustrator,
    variants: variants?.length ? variants : undefined,
    tcgplayer: prices,
    priceSource: "cardmarket",
  };
}

export async function getJaCardsForSet(id: string): Promise<PokemonCard[]> {
  const raw = await setDetails(unprefix(id));
  const set = toSet(raw);
  return raw.cards.map((c) => briefToCard(c, set));
}

// "025" and "25" are the same card number; letters stay ("TG05").
const sameNumber = (a: string, b: string) => a.toUpperCase().replace(/^([A-Z]*)0*(?=\d)/, "$1") === b.toUpperCase().replace(/^([A-Z]*)0*(?=\d)/, "$1");
const setCodeOf = (c: RawJaCardBrief) => c.id.slice(0, c.id.length - c.localId.length - 1);

/** Cards numbered `number`, optionally in a set of `total` printed cards ("025", 165). */
export async function searchJaByNumber(number: string, total?: number): Promise<PokemonCard[]> {
  const [briefs, catalog] = await Promise.all([
    // Substring match ("25" also finds "125"); exact matching happens below.
    restFetch<RawJaCardBrief[]>(`/cards?localId=${encodeURIComponent(number)}`, "ja"),
    getJaSetCatalog(),
  ]);
  return briefs.flatMap((c) => {
    const set = catalog.get(JA_PREFIX + setCodeOf(c));
    return set && sameNumber(c.localId, number) && (total == null || set.printedTotal === total) ? [briefToCard(c, set)] : [];
  });
}

/** Every Japanese card of a Pokémon, by English name ("Pikachu"). */
export async function searchJaByName(name: string): Promise<PokemonCard[]> {
  const dex = dexNumberFor(name);
  if (dex == null) return [];
  const [briefs, catalog] = await Promise.all([
    restFetch<RawJaCardBrief[]>(`/cards?dexId=eq:${dex}`, "ja"),
    getJaSetCatalog(),
  ]);
  return briefs.flatMap((c) => {
    const set = catalog.get(JA_PREFIX + setCodeOf(c));
    return set ? [briefToCard(c, set, englishName(c.name, [dex]))] : [];
  });
}

/** A Japanese set code in text ("SV2A" or "sv2a" → "ja:SV2a"), matched against the catalog. */
export async function findJaSetCode(text: string): Promise<PokemonSet | undefined> {
  const catalog = await getJaSetCatalog();
  const upper = text.toUpperCase();
  // Longest codes first so "SV2A" isn't read as "SV2".
  const sets = [...catalog.values()].sort((a, b) => b.id.length - a.id.length);
  return sets.find((s) => {
    const code = unprefix(s.id).toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return code.length >= 2 && new RegExp(`(^|[^A-Z0-9])${code}($|[^A-Z0-9])`).test(upper);
  });
}

/**
 * The Japanese set whose code is printed just before the card number, as OCR
 * reads it: often with the spaces lost and the regulation mark attached
 * ("G SV2a 025/165" → "GSV2a025/165"). English cards print a language code
 * there instead ("MEW EN"), which rules them out.
 */
export async function jaSetBeforeNumber(text: string): Promise<PokemonSet | undefined> {
  const upper = text.toUpperCase().replace(/\s+/g, "");
  const m = /(\d{1,3})\/\d{1,3}/.exec(upper);
  if (!m) return undefined;
  const before = upper.slice(0, m.index);
  if (before.length < 2 || before.endsWith("EN")) return undefined;
  const catalog = await getJaSetCatalog();
  // Longest codes first so "SV2A" wins over a shorter code that ends the same way.
  return [...catalog.values()]
    .map((s) => ({ s, code: unprefix(s.id).toUpperCase() }))
    .filter(({ code }) => code.length >= 2 && before.endsWith(code))
    .sort((a, b) => b.code.length - a.code.length)[0]?.s;
}

/** Japanese sets whose code or name contains the query ("sv2a", "151"). */
export async function searchJaSets(query: string): Promise<PokemonSet[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const catalog = await getJaSetCatalog();
  return [...catalog.values()].filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6);
}
