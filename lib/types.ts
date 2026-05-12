export interface PokemonSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  images: {
    symbol: string;
    logo: string;
  };
}

export interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: {
    small: string;
    large: string;
  };
  set: PokemonSet;
}

export interface TrackedMasterSet {
  type: "pokemon" | "set";
  id: string;        // Pokémon name  OR  set.id from the API
  label: string;     // display name
  image: string;
  totalCards: number;
  ownedCards: string[];
  subtitle?: string; // e.g. "Scarlet & Violet · 165 cards"
}
