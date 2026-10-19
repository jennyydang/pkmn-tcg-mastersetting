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

export interface TCGPlayerPrice {
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  directLow?: number;
}

export type CardVariant = "normal" | "holo" | "reverse" | "firstEdition";

export interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  illustrator?: string;
  images: {
    small: string;
    large: string;
  };
  set: PokemonSet;
  /** Printed versions, base first (see lib/variants.ts). Missing = unknown, treated as one. */
  variants?: CardVariant[];
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, TCGPlayerPrice>;
  };
}

export interface CustomCardDef {
  id: string;
  name: string;
  imageSmall: string;
  setName: string;
}

export interface TrackedMasterSet {
  type: "pokemon" | "set" | "artist" | "custom";
  id: string;        // Pokémon name  OR  set.id  OR  artist name  OR  uuid
  label: string;     // display name
  image: string;
  totalCards: number;
  ownedCards: string[];
  subtitle?: string;
  customCards?: CustomCardDef[]; // only populated for type === "custom"
}
