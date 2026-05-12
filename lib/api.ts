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
  const data = await apiFetch<{ data: PokemonSet[] }>(
    `/sets?q=name:"${encodeURIComponent(query)}"&orderBy=releaseDate`
  );
  return data.data;
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
