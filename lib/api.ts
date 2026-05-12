import { PokemonCard } from "./types";

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
}

export async function searchPokemon(query: string): Promise<PokemonEntry | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const data = await apiFetch<{ data: PokemonCard[] }>(
    `/cards?q=name:"${encodeURIComponent(trimmed)}"&pageSize=1&orderBy=-set.releaseDate`
  );
  if (data.data.length === 0) return null;
  return { name: trimmed, image: data.data[0].images.small };
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
