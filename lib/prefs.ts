"use client";

import { useCallback, useSyncExternalStore } from "react";

// Per-device display preferences, kept in localStorage (they don't change saved data).

const INCLUDE_VARIANTS_KEY = "pkmn-include-variants";
const CHANGE_EVENT = "pkmn-prefs-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): boolean {
  try {
    return localStorage.getItem(INCLUDE_VARIANTS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Whether master sets count every printed version (reverse holo, 1st Edition, ...)
 * or one of each card. Off by default so existing progress doesn't change.
 */
export function useIncludeVariants(): [boolean, (on: boolean) => void] {
  const value = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((on: boolean) => {
    try {
      localStorage.setItem(INCLUDE_VARIANTS_KEY, on ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [value, set];
}
