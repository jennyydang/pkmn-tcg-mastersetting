"use client";

import { useSyncExternalStore } from "react";

// Whether the device reports a network connection. Works in browsers and in the
// iOS app's web view. "Online" can still mean a server is unreachable, so data
// code also falls back to saved copies when a request fails.

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

export function useOnline() {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
