"use client";

import { useCallback, useSyncExternalStore } from "react";

// Per-device display preferences, kept in localStorage (they don't change saved data).

const CHANGE_EVENT = "pkmn-prefs-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function usePref<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (value: T) => void] {
  const read = () => {
    try {
      const v = localStorage.getItem(key);
      return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const set = useCallback((v: T) => {
    try {
      localStorage.setItem(key, v);
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key]);
  return [value, set];
}

const ON_OFF = ["1", "0"] as const;

/**
 * Whether master sets count every printed version (reverse holo, 1st Edition, ...)
 * or one of each card. Off by default so existing progress doesn't change.
 */
export function useIncludeVariants(): [boolean, (on: boolean) => void] {
  const [v, set] = usePref("pkmn-include-variants", "0", ON_OFF);
  return [v === "1", useCallback((on: boolean) => set(on ? "1" : "0"), [set])];
}

export type CardView = "grid" | "binder";

/** How set pages lay out cards: a grid, or 9-pocket binder pages. */
export function useCardView() {
  return usePref<CardView>("pkmn-card-view", "grid", ["grid", "binder"]);
}

export type ScanMode = "single" | "batch";

/** Scanner: show each card's prices, or scan many in a row and add them together. */
export function useScanMode() {
  return usePref<ScanMode>("pocketi-scan-mode", "single", ["single", "batch"]);
}

export type CollectionSort = "recent" | "name" | "value-desc" | "value-asc" | "set" | "release";

/** How My Collection is ordered. */
export function useCollectionSort() {
  return usePref<CollectionSort>("pocketi-collection-sort", "recent", ["recent", "name", "value-desc", "value-asc", "set", "release"]);
}
