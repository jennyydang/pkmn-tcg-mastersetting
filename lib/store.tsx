"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { TrackedMasterSet } from "./types";

const STORAGE_KEY = "pkmn-tcg-mastersetting-v3";

interface StoreContextValue {
  trackedItems: TrackedMasterSet[];
  addItem: (item: TrackedMasterSet) => void;
  removeItem: (id: string) => void;
  toggleCard: (id: string, cardId: string) => void;
  isCardOwned: (id: string, cardId: string) => boolean;
  hasItem: (id: string) => boolean;
  updateTotal: (id: string, total: number) => void;
  reorderItems: (fromId: string, toId: string) => void;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [trackedItems, setTrackedItems] = useState<TrackedMasterSet[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTrackedItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedItems));
  }, [trackedItems, hydrated]);

  function addItem(item: TrackedMasterSet) {
    setTrackedItems((prev) => {
      if (prev.some((t) => t.id === item.id)) return prev;
      return [...prev, item];
    });
  }

  function removeItem(id: string) {
    setTrackedItems((prev) => prev.filter((t) => t.id !== id));
  }

  function toggleCard(id: string, cardId: string) {
    setTrackedItems((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const owned = t.ownedCards.includes(cardId)
          ? t.ownedCards.filter((c) => c !== cardId)
          : [...t.ownedCards, cardId];
        return { ...t, ownedCards: owned };
      })
    );
  }

  function isCardOwned(id: string, cardId: string) {
    return trackedItems.find((t) => t.id === id)?.ownedCards.includes(cardId) ?? false;
  }

  function hasItem(id: string) {
    return trackedItems.some((t) => t.id === id);
  }

  function updateTotal(id: string, total: number) {
    setTrackedItems((prev) =>
      prev.map((t) => (t.id === id && t.totalCards !== total ? { ...t, totalCards: total } : t))
    );
  }

  function reorderItems(fromId: string, toId: string) {
    setTrackedItems((prev) => {
      const from = prev.findIndex((t) => t.id === fromId);
      const to   = prev.findIndex((t) => t.id === toId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <StoreContext.Provider value={{ trackedItems, addItem, removeItem, toggleCard, isCardOwned, hasItem, updateTotal, reorderItems }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
