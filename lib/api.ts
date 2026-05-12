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

export async function searchSets(query: string): Promise<PokemonSet[]> {
  // Search cards by Pokémon name, then deduplicate the sets they belong to.
  // This lets the user type a Pokémon name (e.g. "Pidgey") and see every set
  // that contains a card with that name.
  const data = await apiFetch<{ data: PokemonCard[] }>(
    `/cards?q=name:"${encodeURIComponent(query)}"&pageSize=250&select=id,set`
  );

  const seen = new Set<string>();
  const sets: PokemonSet[] = [];
  for (const card of data.data) {
    if (!seen.has(card.set.id)) {
      seen.add(card.set.id);
      // card.set is a partial object; cast to PokemonSet — full data is fetched
      // in getSet() when the user navigates to the set page.
      sets.push(card.set);
    }
  }
  return sets;
}

export async function getSet(id: string): Promise<PokemonSet> {
  const data = await apiFetch<{ data: PokemonSet }>(`/sets/${id}`);
  return data.data;
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
