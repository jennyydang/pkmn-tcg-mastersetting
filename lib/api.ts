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

export interface PokemonEntry {
  name: string;
  image: string;
  cardCount: number;
}

export async function searchPokemon(query: string): Promise<PokemonEntry[]> {
  const data = await apiFetch<{ data: PokemonCard[] }>(
    `/cards?q=name:"${encodeURIComponent(query)}"&pageSize=250&orderBy=name`
  );

  const byName = new Map<string, { image: string; count: number }>();
  for (const card of data.data) {
    if (!byName.has(card.name)) {
      byName.set(card.name, { image: card.images.small, count: 0 });
    }
    byName.get(card.name)!.count++;
  }

  return Array.from(byName.entries()).map(([name, { image, count }]) => ({
    name,
    image,
    cardCount: count,
  }));
}

export async function getCardsForPokemon(name: string): Promise<PokemonCard[]> {
  const pageSize = 250;
  let page = 1;
  const all: PokemonCard[] = [];

  while (true) {
    const data = await apiFetch<{ data: PokemonCard[]; totalCount: number }>(
      `/cards?q=name:"${encodeURIComponent(name)}"&pageSize=${pageSize}&page=${page}&orderBy=set.releaseDate`
    );
    all.push(...data.data);
    if (all.length >= data.totalCount) break;
    page++;
  }

  return all;
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
