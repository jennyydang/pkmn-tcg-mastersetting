"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { TrackedPokemon } from "./types";

const STORAGE_KEY = "pkmn-tcg-mastersetting-v2";

interface StoreContextValue {
  trackedPokemon: TrackedPokemon[];
  addPokemon: (name: string, image: string) => void;
  removePokemon: (name: string) => void;
  toggleCard: (pokemonName: string, cardId: string) => void;
  isCardOwned: (pokemonName: string, cardId: string) => boolean;
  hasPokemon: (name: string) => boolean;
  updateTotal: (pokemonName: string, total: number) => void;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [trackedPokemon, setTrackedPokemon] = useState<TrackedPokemon[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTrackedPokemon(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedPokemon));
  }, [trackedPokemon, hydrated]);

  function addPokemon(name: string, image: string) {
    setTrackedPokemon((prev) => {
      if (prev.some((p) => p.name === name)) return prev;
      return [...prev, { name, image, totalCards: 0, ownedCards: [] }];
    });
  }

  function removePokemon(name: string) {
    setTrackedPokemon((prev) => prev.filter((p) => p.name !== name));
  }

  function toggleCard(pokemonName: string, cardId: string) {
    setTrackedPokemon((prev) =>
      prev.map((p) => {
        if (p.name !== pokemonName) return p;
        const owned = p.ownedCards.includes(cardId)
          ? p.ownedCards.filter((id) => id !== cardId)
          : [...p.ownedCards, cardId];
        return { ...p, ownedCards: owned };
      })
    );
  }

  function isCardOwned(pokemonName: string, cardId: string) {
    return trackedPokemon.find((p) => p.name === pokemonName)?.ownedCards.includes(cardId) ?? false;
  }

  function hasPokemon(name: string) {
    return trackedPokemon.some((p) => p.name === name);
  }

  function updateTotal(pokemonName: string, total: number) {
    setTrackedPokemon((prev) =>
      prev.map((p) => (p.name === pokemonName && p.totalCards !== total ? { ...p, totalCards: total } : p))
    );
  }

  return (
    <StoreContext.Provider value={{ trackedPokemon, addPokemon, removePokemon, toggleCard, isCardOwned, hasPokemon, updateTotal }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
