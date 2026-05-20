import { PokemonCard, PokemonSet } from "./types";

const BASE_URL = "https://api.pokemontcg.io/v2";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
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

  const [setsRes, pokemonRes, artistRes] = await Promise.allSettled([
    apiFetch<{ data: PokemonSet[] }>(
      `/sets?q=name:${encodeURIComponent(trimmed)}&pageSize=8&orderBy=-releaseDate`
    ),
    apiFetch<{ data: PokemonCard[] }>(
      `/cards?q=name:"${encodeURIComponent(trimmed)}"&pageSize=1&orderBy=-set.releaseDate`
    ),
    apiFetch<{ data: PokemonCard[]; totalCount: number }>(
      `/cards?q=artist:"${encodeURIComponent(trimmed)}"&pageSize=1`
    ),
  ]);

  const results: SearchResult[] = [];

  if (setsRes.status === "fulfilled") {
    for (const set of setsRes.value.data) {
      results.push({
        type: "set",
        id: set.id,
        label: set.name,
        image: set.images?.logo || set.images?.symbol || "",
        subtitle: `${set.series} · ${set.printedTotal ?? set.total} cards`,
        setData: set,
      });
    }
  }

  if (pokemonRes.status === "fulfilled" && pokemonRes.value.data.length > 0) {
    results.push({
      type: "pokemon",
      id: trimmed,
      label: trimmed,
      image: pokemonRes.value.data[0].images.small,
      subtitle: "All cards across every set",
    });
  }

  if (artistRes.status === "fulfilled" && artistRes.value.data.length > 0) {
    results.push({
      type: "artist",
      id: trimmed,
      label: trimmed,
      image: artistRes.value.data[0].images.small,
      subtitle: `Artist · ${artistRes.value.totalCount} cards`,
    });
  }

  return results;
}

export async function getCardsForPokemon(name: string): Promise<PokemonCard[]> {
  const pageSize = 250;
  let page = 1;
  const all: PokemonCard[] = [];
  while (true) {
    const data = await apiFetch<{ data: PokemonCard[]; totalCount: number }>(
      `/cards?q=name:${encodeURIComponent(name)}&pageSize=${pageSize}&page=${page}&orderBy=set.releaseDate,number`
    );
    all.push(...data.data);
    if (all.length >= data.totalCount) break;
    page++;
  }
  return all;
}

export async function getCardsForArtist(artist: string): Promise<PokemonCard[]> {
  const pageSize = 250;
  let page = 1;
  const all: PokemonCard[] = [];
  while (true) {
    const data = await apiFetch<{ data: PokemonCard[]; totalCount: number }>(
      `/cards?q=artist:"${encodeURIComponent(artist)}"&pageSize=${pageSize}&page=${page}&orderBy=set.releaseDate,number`
    );
    all.push(...data.data);
    if (all.length >= data.totalCount) break;
    page++;
  }
  return all;
}

export async function searchCards(query: string): Promise<PokemonCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Card number pattern: "25", "057", "25/102", "057/102", "TG01", "TG01/TG30", "SWSH001"
  const isNumberQuery = /^[A-Za-z]{0,5}\d+(?:\/[A-Za-z]{0,5}\d+)?$/.test(trimmed);

  let q: string;
  if (isNumberQuery) {
    const [rawNum, rawTotal] = trimmed.split("/");
    // Strip leading zeros from purely numeric card numbers ("057" → "57")
    const cardNumber = /^\d+$/.test(rawNum) ? String(parseInt(rawNum, 10)) : rawNum;
    // When the total is a plain integer, include set.printedTotal to pin results
    // to the specific set (e.g. "57/102" → number:57 set.printedTotal:102)
    const totalNum = rawTotal !== undefined ? parseInt(rawTotal, 10) : NaN;
    q = !isNaN(totalNum)
      ? `number:${cardNumber} set.printedTotal:${totalNum}`
      : `number:${cardNumber}`;
  } else {
    q = `name:${trimmed}`;
  }

  const data = await apiFetch<{ data: PokemonCard[] }>(
    `/cards?q=${encodeURIComponent(q)}&pageSize=20&orderBy=-set.releaseDate`
  );
  return data.data;
}

export async function getCard(id: string): Promise<PokemonCard> {
  const data = await apiFetch<{ data: PokemonCard }>(`/cards/${id}`);
  return data.data;
}

export async function getSet(id: string): Promise<PokemonSet> {
  const data = await apiFetch<{ data: PokemonSet }>(`/sets/${id}`);
  return data.data;
}

export async function getCardsByIds(ids: string[]): Promise<PokemonCard[]> {
  if (ids.length === 0) return [];
  const CHUNK = 50;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

  const results = await Promise.all(
    chunks.map((chunk) => {
      const q = chunk.map((id) => `id:${id}`).join(" OR ");
      return apiFetch<{ data: PokemonCard[] }>(
        `/cards?q=${encodeURIComponent(q)}&pageSize=250`
      ).then((r) => r.data);
    })
  );
  return results.flat();
}

export async function getCardsForSet(setId: string): Promise<PokemonCard[]> {
  const pageSize = 250;
  let page = 1;
  const all: PokemonCard[] = [];
  while (true) {
    const data = await apiFetch<{ data: PokemonCard[]; totalCount: number }>(
      `/cards?q=set.id:${setId}&pageSize=${pageSize}&page=${page}&orderBy=number`
    );
    all.push(...data.data);
    if (all.length >= data.totalCount) break;
    page++;
  }
  return all;
}
