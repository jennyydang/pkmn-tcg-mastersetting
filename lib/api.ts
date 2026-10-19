import { CardVariant, PokemonCard, PokemonSet, TCGPlayerPrice } from "./types";
import { legacyImageUrl } from "./legacyIds";
import { VARIANT_ORDER } from "./variants";
import { ApiError, gql, restFetch } from "./tcgdex";
import { eurToUsdRate } from "./exchange";
import { CardmarketPrices, JA_PREFIX, cardmarketPrices, findJaSetCode, getJaCard, getJaCardsForSet, getJaSet, isJapaneseId, searchJaByName, searchJaByNumber, searchJaSets } from "./japanese";

// Card data comes from TCGdex (https://tcgdex.dev). GraphQL is used for searches and
// card lists (one request returns each card's set); REST is used for single cards
// because only the REST card includes prices. Japanese cards live in lib/japanese.ts.

// Shown for the few TCGdex cards that have no scan.
export const PLACEHOLDER_IMAGE = "/card-placeholder.svg";

// TCGdex also lists Pokémon TCG Pocket (digital-only) sets under this series.
const POCKET_SERIE_ID = "tcgp";

export { ApiError };

// ── Raw TCGdex shapes ───────────────────────────────────────────────────────

interface RawSet {
  id: string;
  name: string;
  releaseDate: string;
  logo: string | null;
  symbol: string | null;
  serie: { id: string; name: string };
  cardCount: { official: number; total: number };
}

interface RawTcgplayerPrice {
  productId?: number;
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
  directLowPrice?: number | null;
}

interface RawCard {
  id: string;
  localId: string;
  name: string;
  image?: string | null;
  rarity?: string | null;
  illustrator?: string | null;
  set: { id: string };
  variants?: Partial<Record<CardVariant, boolean>> | null;
  pricing?: {
    tcgplayer?: { updated?: string; unit?: string } & Record<string, RawTcgplayerPrice | string | undefined>;
    cardmarket?: CardmarketPrices | null;
  } | null;
}

const CARD_FIELDS = "id localId name image rarity illustrator set { id } variants { normal reverse holo firstEdition }";

// ── Set catalog (every set, fetched once per page load) ─────────────────────

let catalogPromise: Promise<Map<string, PokemonSet>> | null = null;

export function getSetCatalog(): Promise<Map<string, PokemonSet>> {
  if (!catalogPromise) {
    catalogPromise = gql<{ sets: RawSet[] }>(
      `{ sets { id name releaseDate logo symbol serie { id name } cardCount { official total } } }`
    ).then(({ sets }) => {
      const map = new Map<string, PokemonSet>();
      for (const s of sets) {
        if (s.serie?.id === POCKET_SERIE_ID) continue;
        map.set(s.id, {
          id:           s.id,
          name:         s.name,
          series:       s.serie?.name ?? "",
          printedTotal: s.cardCount.official,
          total:        s.cardCount.total,
          releaseDate:  s.releaseDate,
          images: {
            logo:   s.logo ? `${s.logo}.png` : "",
            symbol: s.symbol ? `${s.symbol}.png` : "",
          },
        });
      }
      return map;
    });
    // Don't cache a failure; the next call tries again.
    catalogPromise.catch(() => { catalogPromise = null; });
  }
  return catalogPromise;
}

// ── Mapping TCGdex → app types ──────────────────────────────────────────────

// TCGdex has no English scan for ~7% of cards (whole subsets like Trainer Galleries
// and Shiny Vaults); for those, fall back to pokemontcg.io's image server.
export function cardImage(raw: Pick<RawCard, "image" | "localId">, setId: string, quality: "low" | "high" = "low") {
  if (raw.image) return `${raw.image}/${quality}.webp`;
  return legacyImageUrl(setId, raw.localId, quality) ?? PLACEHOLDER_IMAGE;
}

// "reverse-holofoil" → "reverseHolofoil", matching the old pokemontcg.io price keys.
function camelCase(key: string) {
  return key.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

function toTcgplayer(raw: RawCard["pricing"]): PokemonCard["tcgplayer"] {
  const tp = raw?.tcgplayer;
  if (!tp) return undefined;
  const prices: Record<string, TCGPlayerPrice> = {};
  let productId: number | undefined;
  for (const [key, value] of Object.entries(tp)) {
    if (!value || typeof value !== "object") continue;
    productId ??= value.productId;
    prices[camelCase(key)] = {
      low:       value.lowPrice ?? undefined,
      mid:       value.midPrice ?? undefined,
      high:      value.highPrice ?? undefined,
      market:    value.marketPrice ?? undefined,
      directLow: value.directLowPrice ?? undefined,
    };
  }
  return {
    url:       productId ? `https://www.tcgplayer.com/product/${productId}` : undefined,
    updatedAt: typeof tp.updated === "string" ? tp.updated : undefined,
    prices,
  };
}

function toCard(raw: RawCard, set: PokemonSet): PokemonCard {
  return {
    id:     raw.id,
    name:   raw.name,
    number: raw.localId,
    rarity: raw.rarity && raw.rarity !== "None" ? raw.rarity : undefined,
    illustrator: raw.illustrator ?? undefined,
    images: { small: cardImage(raw, set.id, "low"), large: cardImage(raw, set.id, "high") },
    set,
    variants: raw.variants ? VARIANT_ORDER.filter((v) => raw.variants![v]) : undefined,
    tcgplayer: toTcgplayer(raw.pricing),
  };
}

// Drops cards from sets outside the catalog (TCG Pocket).
async function toCards(raws: RawCard[]): Promise<PokemonCard[]> {
  const catalog = await getSetCatalog();
  const cards: PokemonCard[] = [];
  for (const raw of raws) {
    const set = catalog.get(raw.set.id);
    if (set) cards.push(toCard(raw, set));
  }
  return cards;
}

function compareCards(a: PokemonCard, b: PokemonCard) {
  return (
    a.set.releaseDate.localeCompare(b.set.releaseDate) ||
    a.set.id.localeCompare(b.set.id) ||
    a.number.localeCompare(b.number, undefined, { numeric: true })
  );
}

// TCGdex name/illustrator filters match substrings ("mew" finds "Mewtwo");
// keep only whole-word matches so a master set holds just that Pokémon.
/** Whether a search matched this card by its artist rather than its name. */
export function artistMatch(card: PokemonCard, query: string) {
  const q = query.trim();
  return !!card.illustrator && q.length >= 3 && matchesWord(card.illustrator, q) && !matchesWord(card.name, q);
}

export function matchesWord(text: string | null | undefined, word: string) {
  if (!text) return false;
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

async function cardsByName(name: string): Promise<RawCard[]> {
  const { cards } = await gql<{ cards: RawCard[] }>(
    `query ($name: String) { cards(filters: { name: $name }) { ${CARD_FIELDS} } }`,
    { name }
  );
  return cards;
}

async function cardsByIllustrator(artist: string): Promise<RawCard[]> {
  const { cards } = await gql<{ cards: RawCard[] }>(
    `query ($artist: String) { cards(filters: { illustrator: $artist }) { ${CARD_FIELDS} } }`,
    { artist }
  );
  return cards;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Image of the newest card that has a real scan (lists are sorted oldest first). */
export function thumbnail(cards: PokemonCard[]): string {
  return cards.findLast((c) => c.images.small !== PLACEHOLDER_IMAGE)?.images.small ?? PLACEHOLDER_IMAGE;
}

export interface SearchResult {
  type: "pokemon" | "set" | "artist";
  id: string;
  label: string;
  image: string;
  subtitle: string;
  setData?: PokemonSet;
}

export async function searchAll(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();

  const [setsRes, pokemonRes, artistRes, jaSetsRes] = await Promise.allSettled([
    getSetCatalog().then((catalog) =>
      [...catalog.values()]
        .filter((s) => s.name.toLowerCase().includes(lower))
        .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
        .slice(0, 8)
    ),
    getCardsForPokemon(trimmed),
    getCardsForArtist(trimmed),
    searchJaSets(trimmed),
  ]);

  // If every request failed, the API is down — surface that instead of "No results".
  if (setsRes.status === "rejected" && pokemonRes.status === "rejected" && artistRes.status === "rejected") {
    throw setsRes.reason;
  }

  const results: SearchResult[] = [];

  if (setsRes.status === "fulfilled") {
    for (const set of setsRes.value) {
      results.push({
        type: "set",
        id: set.id,
        label: set.name,
        image: set.images.logo || set.images.symbol || "",
        subtitle: `${set.series} · ${set.printedTotal ?? set.total} cards`,
        setData: set,
      });
    }
  }

  // Japanese sets, matched by code ("SV2a") or name.
  if (jaSetsRes.status === "fulfilled") {
    for (const set of jaSetsRes.value) {
      results.push({
        type: "set",
        id: set.id,
        label: set.name,
        image: "",
        subtitle: `Japanese set · ${set.printedTotal} cards`,
        setData: set,
      });
    }
  }

  if (pokemonRes.status === "fulfilled" && pokemonRes.value.length > 0) {
    results.push({
      type: "pokemon",
      id: trimmed,
      label: trimmed,
      image: thumbnail(pokemonRes.value),
      subtitle: "All cards across every set",
    });
  }

  if (artistRes.status === "fulfilled" && artistRes.value.length > 0) {
    results.push({
      type: "artist",
      id: trimmed,
      label: trimmed,
      image: thumbnail(artistRes.value),
      subtitle: `Artist · ${artistRes.value.length} cards`,
    });
  }

  return results;
}

export async function getCardsForPokemon(name: string): Promise<PokemonCard[]> {
  const raws = (await cardsByName(name)).filter((c) => matchesWord(c.name, name));
  return (await toCards(raws)).sort(compareCards);
}

export async function getCardsForArtist(artist: string): Promise<PokemonCard[]> {
  const raws = (await cardsByIllustrator(artist)).filter((c) => matchesWord(c.illustrator, artist));
  return (await toCards(raws)).sort(compareCards);
}

// "025" → "25", "TG01" → "TG1", "swsh001" → "SWSH1": compares card numbers across padding styles.
export function normalizeNumber(num: string) {
  return num.toUpperCase().replace(/^([A-Z]*)0*(?=\d)/, "$1");
}

/** Cards matching a name, a number ("25", "025/165", "TG01") or a Japanese set code and number ("SV2a 025"). English cards first, then Japanese. */
export async function searchCards(query: string): Promise<PokemonCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // "SV2a 025" / "SV2a-025": a Japanese card by set code and number.
  const coded = /^([A-Za-z0-9]+)[\s-]+([A-Za-z]{0,3}\d+)$/.exec(trimmed);
  if (coded) {
    const set = await findJaSetCode(coded[1]).catch(() => undefined);
    if (set && set.id.slice(JA_PREFIX.length).toUpperCase() === coded[1].toUpperCase()) {
      return searchJaByNumber(coded[2]).then((cards) => cards.filter((c) => c.set.id === set.id)).catch(() => []);
    }
  }

  const [english, japanese] = await Promise.all([
    searchEnglishCards(trimmed),
    searchJapaneseCards(trimmed).catch((e) => { console.error("Japanese search failed", e); return []; }),
  ]);
  return [...english, ...japanese.slice(0, 10)];
}

function searchJapaneseCards(query: string): Promise<PokemonCard[]> {
  const m = /^(\d+)(?:\/(\d+))?$/.exec(query);
  if (m) return searchJaByNumber(m[1], m[2] ? parseInt(m[2], 10) : undefined);
  return searchJaByName(query);
}

async function searchEnglishCards(trimmed: string): Promise<PokemonCard[]> {
  // Card number pattern: "25", "057", "25/102", "057/102", "TG01", "TG01/TG30", "SWSH001"
  const isNumberQuery = /^[A-Za-z]{0,5}\d+(?:\/[A-Za-z]{0,5}\d+)?$/.test(trimmed);

  let cards: PokemonCard[];
  if (isNumberQuery) {
    const [rawNum, rawTotal] = trimmed.split("/");
    const cardNumber = normalizeNumber(rawNum);
    // When the total is a plain integer, pin results to sets with that printed total
    // (e.g. "57/102" → card 57 in a 102-card set).
    const totalNum = rawTotal !== undefined ? parseInt(rawTotal, 10) : NaN;
    // The filter matches substrings ("25" also finds "025" and "125"); exact matching
    // happens below. REST briefs are used because they're the smallest response.
    const briefs = await restFetch<{ id: string; localId: string; name: string; image?: string }[]>(
      `/cards?localId=${encodeURIComponent(/^\d+$/.test(cardNumber) ? cardNumber : rawNum)}`
    );
    const raws = briefs.map((c) => ({ ...c, set: { id: c.id.slice(0, c.id.length - c.localId.length - 1) } }));
    cards = (await toCards(raws)).filter(
      (c) => normalizeNumber(c.number) === cardNumber && (isNaN(totalNum) || c.set.printedTotal === totalNum)
    );
  } else {
    // A name, or an artist ("Mitsuhiro Arita", "Arita"): cards named it come
    // first, then cards the artist drew. Each list is newest first.
    const [named, drawn] = await Promise.all([
      cardsByName(trimmed).then(toCards),
      /[a-z]{3}/i.test(trimmed) ? getCardsForArtist(trimmed).catch(() => []) : Promise.resolve([]),
    ]);
    const first = named.sort((a, b) => compareCards(b, a)).slice(0, 20);
    const ids = new Set(first.map((c) => c.id));
    return [...first, ...drawn.filter((c) => !ids.has(c.id)).sort((a, b) => compareCards(b, a)).slice(0, 20)];
  }

  return cards.sort((a, b) => compareCards(b, a)).slice(0, 20);
}

export async function getCard(id: string): Promise<PokemonCard> {
  if (isJapaneseId(id)) return getJaCard(id);
  const raw = await restFetch<RawCard & { set: { id: string; name: string } }>(`/cards/${encodeURIComponent(id)}`);
  const catalog = await getSetCatalog();
  const set = catalog.get(raw.set.id);
  if (!set) throw new Error(`Card ${id} is not part of the physical TCG`);
  const card = toCard(raw, set);
  // Some cards (often promos) have no TCGplayer price on TCGdex but do have a
  // Cardmarket one: use that, converted to dollars and labelled as such.
  if (!card.tcgplayer && raw.pricing?.cardmarket) {
    const prices = cardmarketPrices(raw.pricing.cardmarket, card.variants ?? ["normal"], await eurToUsdRate());
    if (prices) return { ...card, tcgplayer: prices, priceSource: "cardmarket" };
  }
  return card;
}

export async function getSet(id: string): Promise<PokemonSet> {
  if (isJapaneseId(id)) return getJaSet(id);
  const set = (await getSetCatalog()).get(id);
  if (!set) throw new Error(`Set ${id} not found`);
  return set;
}

export async function getCardsForSet(setId: string): Promise<PokemonCard[]> {
  if (isJapaneseId(setId)) return getJaCardsForSet(setId);
  // REST gives the set's cards in printed order; GraphQL adds each card's variants,
  // rarity and artist (the ID filter matches substrings, hence the set check). If
  // GraphQL fails the set still loads, with every card counted as a single version.
  const [set, raw, withVariants] = await Promise.all([
    getSet(setId),
    restFetch<{ cards: { id: string; localId: string; name: string; image?: string }[] }>(`/sets/${encodeURIComponent(setId)}`),
    gql<{ cards: Pick<RawCard, "id" | "set" | "variants" | "rarity" | "illustrator">[] }>(
      `query ($prefix: ID) { cards(filters: { id: $prefix }) { id set { id } rarity illustrator variants { normal reverse holo firstEdition } } }`,
      { prefix: `${setId}-` }
    ).catch((e) => { console.error("Couldn't load variants", e); return { cards: [] }; }),
  ]);
  const extra = new Map(withVariants.cards.filter((c) => c.set?.id === setId).map((c) => [c.id, c]));
  return raw.cards.map((c) => {
    const more = extra.get(c.id);
    return toCard({ ...c, set: { id: setId }, variants: more?.variants, rarity: more?.rarity, illustrator: more?.illustrator }, set);
  });
}

// Fetches full cards (with prices) a few at a time. Unknown IDs are skipped.
export async function getCardsByIds(ids: string[]): Promise<PokemonCard[]> {
  if (ids.length === 0) return [];
  const CONCURRENCY = 10;
  const cards: PokemonCard[] = [];
  let firstError: unknown = null;
  let next = 0;

  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        cards.push(await getCard(id));
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) firstError ??= e;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

  // Only fail when nothing loaded; otherwise show what we have.
  if (cards.length === 0 && firstError) throw firstError;
  return cards;
}
