"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { TrackedSet, PokemonSet } from "./types";

const STORAGE_KEY = "pkmn-tcg-mastersetting";

interface StoreContextValue {
  trackedSets: TrackedSet[];
  addSet: (set: PokemonSet) => void;
  removeSet: (setId: string) => void;
  toggleCard: (setId: string, cardId: string) => void;
  isCardOwned: (setId: string, cardId: string) => boolean;
  hasSet: (setId: string) => boolean;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [trackedSets, setTrackedSets] = useState<TrackedSet[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTrackedSets(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedSets));
  }, [trackedSets, hydrated]);

  function addSet(set: PokemonSet) {
    setTrackedSets((prev) => {
      if (prev.some((t) => t.set.id === set.id)) return prev;
      return [...prev, { set, ownedCards: [] }];
    });
  }

  function removeSet(setId: string) {
    setTrackedSets((prev) => prev.filter((t) => t.set.id !== setId));
  }

  function toggleCard(setId: string, cardId: string) {
    setTrackedSets((prev) =>
      prev.map((t) => {
        if (t.set.id !== setId) return t;
        const owned = t.ownedCards.includes(cardId)
          ? t.ownedCards.filter((id) => id !== cardId)
          : [...t.ownedCards, cardId];
        return { ...t, ownedCards: owned };
      })
    );
  }

  function isCardOwned(setId: string, cardId: string) {
    return trackedSets.find((t) => t.set.id === setId)?.ownedCards.includes(cardId) ?? false;
  }

  function hasSet(setId: string) {
    return trackedSets.some((t) => t.set.id === setId);
  }

  return (
    <StoreContext.Provider value={{ trackedSets, addSet, removeSet, toggleCard, isCardOwned, hasSet }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
